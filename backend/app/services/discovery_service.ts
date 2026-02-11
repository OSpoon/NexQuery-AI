import DataSource from '#models/data_source'
import DbHelper from '#services/db_helper'
import EmbeddingService from '#services/embedding_service'
import VectorStoreService from '#services/vector_store_service'
import TableMetadata from '#models/table_metadata'

export interface EntityMetadata {
  name: string
  type: 'table' | 'view' | 'index' | 'data_stream'
  description?: string
}

export interface EntitySchema {
  entityName: string
  fields: Array<{
    name: string
    type: string
    isPrimary?: boolean
    isNullable?: boolean
    comment?: string
    isSensitive?: boolean
  }>
  foreignKeys?: Array<{
    column: string
    referencedTable: string
    referencedColumn: string
  }>
}

export default class DiscoveryService {
  private static sensitiveKeywords = [
    'password',
    'pwd',
    'secret',
    'token',
    'key',
    'iv',
    'salt',
    'recovery',
    '2fa',
    'two_factor',
    'api_key',
    'access_token',
  ]

  private static isSensitive(name: string): boolean {
    return this.sensitiveKeywords.some(keyword => name.toLowerCase().includes(keyword))
  }

  /**
   * List all discoverable entities (tables or indices)
   */
  static async listEntities(dataSourceId: number): Promise<EntityMetadata[]> {
    if (dataSourceId === 9999) {
      const { client } = await DbHelper.getConnection(dataSourceId)
      const results = await client.rawQuery('SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\'')
      return results.map((row: any) => ({
        name: row.name,
        type: 'table',
      }))
    }

    const dataSource = await DataSource.findOrFail(dataSourceId)

    if (dataSource.type === 'elasticsearch') {
      const es = await DbHelper.getESService(dataSourceId)
      const indices = await es.listIndices()
      return indices.map(idx => ({
        name: idx.name,
        type: idx.isDataStream ? 'data_stream' : 'index',
        description: `Docs: ${idx.docsCount}, Size: ${idx.storeSize}`,
      }))
    }

    // SQL Flow
    const { client, dbType } = await DbHelper.getConnection(dataSourceId)
    let query = ''
    if (dbType === 'postgresql') {
      query = 'SELECT tablename as name FROM pg_catalog.pg_tables WHERE schemaname = \'public\''
    } else {
      query = 'SHOW TABLES'
    }

    const results = await client.rawQuery(query)
    const rows = dbType === 'postgresql' ? results.rows : (Array.isArray(results[0]) ? results[0] : results)

    return rows.map((row: any) => ({
      name: row.name || Object.values(row)[0] as string,
      type: 'table',
    }))
  }

  /**
   * Search for entities using semantic search (Vector Store)
   */
  static async searchEntities(dataSourceId: number, query: string): Promise<string> {
    const embeddingService = new EmbeddingService()
    const vectorStore = new VectorStoreService()
    const queryEmbedding = await embeddingService.generate(query)

    const results = await vectorStore.searchTables(dataSourceId, queryEmbedding, 20)

    if (results.length === 0) {
      const hasData = await TableMetadata.query().where('dataSourceId', dataSourceId).first()
      if (hasData) {
        return 'No results found in Vector Database. Please Sync Schema to populate the Vector Database.'
      }
      return 'No metadata found. Please Sync Schema for this data source.'
    }

    return JSON.stringify(
      results.map(t => ({
        entity: t.payload?.tableName,
        description: `${(t.payload?.fullSchema as string)?.slice(0, 200)}...`,
        relevance: t.score.toFixed(4),
      })),
    )
  }

  /**
   * Search for actual values in a specific field (fuzzy keyword)
   */
  static async searchFieldValues(
    dataSourceId: number,
    entityName: string,
    fieldName: string,
    keyword: string,
    limit: number = 5,
  ): Promise<string> {
    if (dataSourceId === 9999) {
      return 'Vector search is not supported for evaluation data source.'
    }
    const dataSource = await DataSource.findOrFail(dataSourceId)

    if (dataSource.type === 'elasticsearch') {
      const es = await DbHelper.getESService(dataSourceId)
      // Elasticsearch fuzzy search on a field
      const res = await es.client.search({
        index: entityName,
        size: limit,
        body: {
          query: {
            wildcard: {
              [`${fieldName}.keyword`]: `*${keyword}*`,
            },
          },
        },
      })
      const values = res.hits.hits.map((hit: any) => hit._source[fieldName]).filter(Boolean)
      return JSON.stringify({ found: values.length > 0, values })
    }

    // SQL Flow
    const { client } = await DbHelper.getConnection(dataSourceId)
    // Basic SQL Injection prevention for table/column names (already checked in tool usually, but good to be safe)
    if (!/^\w+$/.test(entityName) || !/^\w+$/.test(fieldName)) {
      throw new Error('Invalid active entity or field name format.')
    }

    const results = await client
      .from(entityName)
      .select(fieldName)
      .where(fieldName, 'like', `%${keyword}%`)
      .distinct(fieldName)
      .limit(limit)

    const values = results.map(row => row[fieldName])
    return JSON.stringify({
      found: values.length > 0,
      values,
      note: values.length === 0 ? 'No matches found.' : undefined,
    })
  }

  /**
   * Search for related business knowledge and few-shot examples (Vector Store)
   */
  static async searchRelatedKnowledge(query: string, limit: number = 3): Promise<string> {
    const embeddingService = new EmbeddingService()
    const vectorStore = new VectorStoreService()
    const queryEmbedding = await embeddingService.generate(query)

    const results = await vectorStore.searchKnowledge(queryEmbedding, limit)

    if (results.length === 0) {
      return 'No related business knowledge or examples found in the Knowledge Base.'
    }

    return JSON.stringify(
      results.map(k => ({
        topic: k.payload?.keyword,
        logic: k.payload?.description,
        example_code: k.payload?.exampleSql || k.payload?.exampleLucene,
        relevance: k.score.toFixed(4),
      })),
    )
  }

  /**
   * Get detailed schema for an entity
   */
  static async getEntitySchema(dataSourceId: number, entityName: string): Promise<EntitySchema> {
    if (dataSourceId === 9999) {
      const { client } = await DbHelper.getConnection(dataSourceId)
      const result = await client.rawQuery(`PRAGMA table_info(\`${entityName}\`)`)
      const fields = result.map((r: any) => ({
        name: r.name,
        type: r.type,
        isPrimary: r.pk === 1,
        isNullable: r.notnull === 0,
        isSensitive: this.isSensitive(r.name),
      }))

      // Discover Foreign Keys for SQLite
      const fkResult = await client.rawQuery(`PRAGMA foreign_key_list(\`${entityName}\`)`)
      const foreignKeys = fkResult.map((fk: any) => ({
        column: fk.from,
        referencedTable: fk.table,
        referencedColumn: fk.to,
      }))

      return { entityName, fields, foreignKeys }
    }

    const dataSource = await DataSource.findOrFail(dataSourceId)

    if (dataSource.type === 'elasticsearch') {
      const es = await DbHelper.getESService(dataSourceId)
      const mapping: any = await es.getMapping(entityName)
      const properties = mapping[entityName]?.mappings?.properties || {}

      const fields = Object.entries(properties).map(([name, value]: [string, any]) => ({
        name,
        type: value.type || (value.properties ? 'object' : 'unknown'),
        isSensitive: this.isSensitive(name),
      }))

      return { entityName, fields }
    }

    // SQL Flow
    const { client, dbType } = await DbHelper.getConnection(dataSourceId)
    const fields: any[] = []
    const foreignKeys: any[] = []

    if (dbType === 'postgresql') {
      const result = await client.rawQuery(`
        SELECT 
          a.attname AS name,
          format_type(a.atttypid, a.atttypmod) AS type,
          (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid AND a.attnum = ANY(i.indkey) AND i.indisprimary) > 0 AS is_primary,
          NOT a.attnotnull AS is_nullable,
          d.description AS comment
        FROM pg_attribute a
        JOIN pg_class c ON a.attrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum
        WHERE c.relname = ? AND n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped;
      `, [entityName])

      fields.push(...result.rows.map((r: any) => ({
        name: r.name,
        type: r.type,
        isPrimary: r.is_primary,
        isNullable: r.is_nullable,
        comment: r.comment,
        isSensitive: this.isSensitive(r.name),
      })))

      // Foreign Keys for Postgres
      const fkQuery = `
        SELECT
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name=? AND tc.table_schema='public';
      `
      const fkRes = await client.rawQuery(fkQuery, [entityName])
      foreignKeys.push(...fkRes.rows.map((r: any) => ({
        column: r.column_name,
        referencedTable: r.foreign_table_name,
        referencedColumn: r.foreign_column_name,
      })))
    } else {
      const result = await client.rawQuery(`SHOW FULL COLUMNS FROM \`${entityName}\``)
      const rows = Array.isArray(result[0]) ? result[0] : result
      fields.push(...rows.map((r: any) => ({
        name: r.Field,
        type: r.Type,
        isPrimary: r.Key === 'PRI',
        isNullable: r.Null === 'YES',
        comment: r.Comment,
        isSensitive: this.isSensitive(r.Field),
      })))

      // Foreign Keys for MySQL
      const fkQuery = `
        SELECT 
          COLUMN_NAME, 
          REFERENCED_TABLE_NAME, 
          REFERENCED_COLUMN_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL;
      `
      const fkRes = await client.rawQuery(fkQuery, [entityName])
      const fkRows = Array.isArray(fkRes[0]) ? fkRes[0] : fkRes
      foreignKeys.push(...fkRows.map((r: any) => ({
        column: r.COLUMN_NAME,
        referencedTable: r.REFERENCED_TABLE_NAME,
        referencedColumn: r.REFERENCED_COLUMN_NAME,
      })))
    }

    return { entityName, fields, foreignKeys }
  }

  /**
   * Sample data from an entity
   */
  static async sampleData(dataSourceId: number, entityName: string, limit: number = 3): Promise<any[]> {
    if (dataSourceId === 9999) {
      const { client } = await DbHelper.getConnection(dataSourceId)
      return await client.from(entityName).limit(limit)
    }

    const dataSource = await DataSource.findOrFail(dataSourceId)

    if (dataSource.type === 'elasticsearch') {
      const es = await DbHelper.getESService(dataSourceId)
      return await es.sampleData(entityName, limit)
    }

    const { client, dbType } = await DbHelper.getConnection(dataSourceId)
    let query = ''
    if (dbType === 'postgresql') {
      query = `SELECT * FROM "${entityName}" LIMIT ${limit}`
    } else {
      query = `SELECT * FROM \`${entityName}\` LIMIT ${limit}`
    }

    const result = await client.rawQuery(query)
    return dbType === 'postgresql' ? result.rows : (Array.isArray(result[0]) ? result[0] : result)
  }

  /**
   * Get statistical summary (count, min, max, nulls, top values) for an entity
   */
  static async getEntityStatistics(dataSourceId: number, entityName: string): Promise<any> {
    const schema = await this.getEntitySchema(dataSourceId, entityName)
    const { client, dbType } = await DbHelper.getConnection(dataSourceId)

    // For ES, return basic stats and attempt aggregation for counts
    if (dbType === 'elasticsearch') {
      const es = await DbHelper.getESService(dataSourceId)
      const indices = await es.listIndices()
      const stats = indices.find(idx => idx.name === entityName)

      // Simple ES aggregation for counts if we have fields
      return {
        entityName,
        totalRecords: stats?.docsCount || 'unknown',
        storageSize: stats?.storeSize,
        note: 'Elasticsearch profiling provides document counts. Use search tools for deep value analysis.',
      }
    }

    // Identify fields for different types of stats
    const numericAndDateFields = schema.fields.filter((f) => {
      const type = f.type.toLowerCase()
      return type.includes('int') || type.includes('decimal') || type.includes('float')
        || type.includes('double') || type.includes('date') || type.includes('time')
        || type.includes('year') || type.includes('timestamp')
    })

    const categoricalFields = schema.fields
      .filter((f) => {
        const type = f.type.toLowerCase()
        return (type.includes('char') || type.includes('text') || type.includes('string') || type.includes('enum'))
          && !this.isSensitive(f.name)
      })
      .slice(0, 5) // Limit to first 5 potential categorical fields

    // 1. Initial MIN/MAX/COUNT query
    const minMaxSelect = numericAndDateFields.map((f) => {
      const quoted = dbType === 'postgresql' ? `"${f.name}"` : `\`${f.name}\``
      return `MIN(${quoted}) as "${f.name}_min", MAX(${quoted}) as "${f.name}_max", COUNT(${quoted}) as "${f.name}_non_null"`
    }).join(', ')

    const baseQuery = dbType === 'postgresql'
      ? `SELECT COUNT(*) as count ${minMaxSelect ? `, ${minMaxSelect}` : ''} FROM "${entityName}"`
      : `SELECT COUNT(*) as count ${minMaxSelect ? `, ${minMaxSelect}` : ''} FROM \`${entityName}\``

    const result = await client.rawQuery(baseQuery)
    const row = dbType === 'postgresql' ? result.rows[0] : (Array.isArray(result[0]) ? result[0][0] : result[0])

    const totalRecords = Number.parseInt(row.count)
    const fieldStats = numericAndDateFields.map(f => ({
      name: f.name,
      type: f.type,
      min: row[`${f.name}_min`],
      max: row[`${f.name}_max`],
      nullCount: totalRecords - Number.parseInt(row[`${f.name}_non_null`] || 0),
    }))

    // 2. Fetch Top Values for Categorical Fields (Separate queries for safety/simplicity)
    const profiling: any[] = []
    for (const f of categoricalFields) {
      try {
        const quoted = dbType === 'postgresql' ? `"${f.name}"` : `\`${f.name}\``
        const topRes = await client
          .from(entityName)
          .select(f.name)
          .count(`${f.name} as count`)
          .groupBy(f.name)
          .orderBy('count', 'desc')
          .limit(5)

        profiling.push({
          name: f.name,
          topValues: topRes.map((r: any) => ({ value: r[f.name], count: Number.parseInt(r.count) })),
        })
      } catch (e) {
        // Skip if query fails (e.g. unsupported type for group by)
      }
    }

    return {
      entityName,
      totalRecords,
      fields: schema.fields,
      foreignKeys: foreignKeys || [],
      numericStats: fieldStats,
      categoricalProfiling: profiling,
    }
  }
}
