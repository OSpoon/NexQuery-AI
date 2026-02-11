import DbHelper from '#services/db_helper'
import encryption from '@adonisjs/core/services/encryption'
import DataSource from '#models/data_source'
import logger from '@adonisjs/core/services/logger'

export interface ColumnInfo {
  name: string
  type: string
  comment: string
}

export interface TableInfo {
  name: string
  columns: ColumnInfo[]
  comment?: string
}

export class SchemaService {
  /**
   * Fetch structured schema information from a data source
   */
  public async getPhysicalSchema(dataSourceId: number): Promise<TableInfo[]> {
    const ds = await DataSource.findOrFail(dataSourceId)
    if (ds.type === 'api') {
      return []
    }

    if (ds.type === 'elasticsearch') {
      return this.getESPhysicalSchema(ds)
    }

    const { client, dbType } = await DbHelper.getConnection(dataSourceId)
    let rows: any[] = []

    if (dbType === 'mysql') {
      const [result] = await client.rawQuery(`
        SELECT 
          TABLE_NAME as tableName, 
          COLUMN_NAME as columnName,
          DATA_TYPE as dataType,
          COLUMN_COMMENT as columnComment
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `)
      rows = result as any[]
    } else if (dbType === 'postgresql') {
      const result = await client.rawQuery(`
        SELECT 
          table_name as "tableName", 
          column_name as "columnName",
          data_type as "dataType",
          (
              SELECT description 
              FROM pg_description 
              WHERE objoid = (quote_ident(table_schema) || '.' || quote_ident(table_name))::regclass 
              AND objsubid = ordinal_position
          ) as "columnComment"
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `)
      rows = result.rows
    }

    const tableMap = new Map<string, ColumnInfo[]>()
    for (const row of rows) {
      const tableName = row.tableName
      const col = {
        name: row.columnName,
        type: row.dataType,
        comment: row.columnComment || '',
      }
      if (!tableMap.has(tableName)) {
        tableMap.set(tableName, [])
      }
      tableMap.get(tableName)?.push(col)
    }

    return Array.from(tableMap.entries()).map(([name, columns]) => ({
      name,
      columns,
    }))
  }

  /**
   * Fetch a formatted text description of a table's schema (for LLM/Sync)
   */
  public async getFormattedSchemaText(dataSourceId: number, tableName: string): Promise<string> {
    const { client, dbType } = await DbHelper.getConnection(dataSourceId)
    let columnsDesc = ''
    let tableComment = ''
    let fkDesc = ''

    if (dbType === 'postgresql') {
      // Get table comment
      const tableCommentRes = await client.rawQuery(
        `SELECT d.description 
         FROM pg_class c 
         JOIN pg_namespace n ON c.relnamespace = n.oid 
         LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = 0
         WHERE c.relname = ? AND n.nspname = 'public'`,
        [tableName],
      )
      if (tableCommentRes.rows.length > 0 && tableCommentRes.rows[0].description) {
        tableComment = tableCommentRes.rows[0].description
      }

      const columns = await client.rawQuery(
        `
          SELECT
              a.attname AS column_name,
              format_type(a.atttypid, a.atttypmod) AS data_type,
              d.description AS comment
          FROM
              pg_attribute a
          JOIN
              pg_class c ON a.attrelid = c.oid
          JOIN
              pg_namespace n ON c.relnamespace = n.oid
          LEFT JOIN
              pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum
          WHERE
              c.relname = ?
              AND n.nspname = 'public'
              AND a.attnum > 0
              AND NOT a.attisdropped;
      `,
        [tableName],
      )

      columnsDesc = columns.rows
        .map(
          (c: any) => `- ${c.column_name} (${c.data_type})${c.comment ? ` // ${c.comment}` : ''}`,
        )
        .join('\n')

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
      const fks = await client.rawQuery(fkQuery, [tableName])
      fkDesc = fks.rows.map((r: any) => `- ${r.column_name} -> ${r.foreign_table_name}.${r.foreign_column_name}`).join('\n')
    } else if (dbType === 'mysql') {
      const tableInfo = await client.rawQuery(`SHOW TABLE STATUS LIKE ?`, [tableName])
      if (tableInfo[0] && tableInfo[0][0] && tableInfo[0][0].Comment) {
        tableComment = tableInfo[0][0].Comment
      }

      const columnsRes = await client.rawQuery(`SHOW FULL COLUMNS FROM \`${tableName}\``)
      const rows = Array.isArray(columnsRes[0]) ? columnsRes[0] : columnsRes

      columnsDesc = rows
        .map((c: any) => `- ${c.Field} (${c.Type})${c.Comment ? ` // ${c.Comment}` : ''}`)
        .join('\n')

      const fkQuery = `
        SELECT 
          COLUMN_NAME, 
          REFERENCED_TABLE_NAME, 
          REFERENCED_COLUMN_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL;
      `
      const fkRes = await client.rawQuery(fkQuery, [tableName])
      const fkRows = Array.isArray(fkRes[0]) ? fkRes[0] : fkRes
      fkDesc = fkRows.map((r: any) => `- ${r.COLUMN_NAME} -> ${r.REFERENCED_TABLE_NAME}.${r.REFERENCED_COLUMN_NAME}`).join('\n')
    } else if (dbType === 'sqlite') {
      const columns = await client.rawQuery(`PRAGMA table_info(\`${tableName}\`)`)
      columnsDesc = columns.map((c: any) => `- ${c.name} (${c.type})${c.pk ? ' // PRIMARY KEY' : ''}`).join('\n')

      const fks = await client.rawQuery(`PRAGMA foreign_key_list(\`${tableName}\`)`)
      fkDesc = fks.map((fk: any) => `- ${fk.from} -> ${fk.table}.${fk.to}`).join('\n')
    }

    let output = `Table: ${tableName}`
    if (tableComment)
      output += `\nComment: ${tableComment}`
    output += `\nColumns:\n${columnsDesc}`
    if (fkDesc)
      output += `\nForeign Keys:\n${fkDesc}`

    return output
  }

  /**
   * List all table names for a data source
   */
  public async listTables(dataSourceId: number): Promise<string[]> {
    const { client, dbType } = await DbHelper.getConnection(dataSourceId)
    if (dbType === 'postgresql') {
      const query = 'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\''
      const result = await client.rawQuery(query)
      return result.rows.map((r: any) => r.table_name)
    } else if (dbType === 'mysql') {
      const query = 'SHOW TABLES'
      const result = await client.rawQuery(query)
      const rows = result[0]
      return rows.map((r: any) => Object.values(r)[0])
    }
    return []
  }

  private async getESPhysicalSchema(ds: DataSource): Promise<TableInfo[]> {
    try {
      const password = ds.password ? encryption.decrypt<string>(ds.password) : undefined
      const { default: ESClient } = await import('#services/elasticsearch_service')
      const esService = new ESClient({
        node: ds.host.startsWith('http') ? ds.host : `http://${ds.host}:${ds.port}`,
        auth: {
          username: ds.username,
          password: password ?? undefined,
        },
      })

      const mapping = await esService.getMapping(ds.database || '*')
      const fields: ColumnInfo[] = []

      const extractFields = (props: any, prefix = '') => {
        if (!props)
          return
        for (const [key, value] of Object.entries(props)) {
          const fieldName = prefix ? `${prefix}.${key}` : key
          const val = value as any
          const fieldType = val.type || (val.properties ? 'object' : 'unknown')

          fields.push({
            name: fieldName,
            type: fieldType,
            comment: fieldType,
          })

          if (val.properties) {
            extractFields(val.properties, fieldName)
          }
        }
      }

      for (const indexData of Object.values(mapping as any)) {
        const info = indexData as any
        if (info.mappings && info.mappings.properties) {
          extractFields(info.mappings.properties)
        }
      }

      const uniqueFields = Array.from(new Map(fields.map(f => [f.name, f])).values())

      return [
        {
          name: ds.database || 'Default Index',
          columns: uniqueFields,
        },
      ]
    } catch (error) {
      logger.error({ err: error, dataSourceId: ds.id }, '[Elasticsearch] Failed to fetch schema')
      return []
    }
  }
}
