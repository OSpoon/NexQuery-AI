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
   * Get detailed schema for an entity
   */
  static async getEntitySchema(dataSourceId: number, entityName: string): Promise<EntitySchema> {
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
    }

    return { entityName, fields }
  }

  /**
   * Sample data from an entity
   */
  static async sampleData(dataSourceId: number, entityName: string, limit: number = 3): Promise<any[]> {
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
}
