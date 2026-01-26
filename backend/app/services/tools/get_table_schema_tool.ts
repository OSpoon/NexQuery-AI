import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'
import DbHelper from '#services/db_helper'

export class GetTableSchemaTool extends StructuredTool {
  name = 'get_table_schema'
  description
    = 'Get the schema (columns, types, keys) for a specific table. Use this to understand table structure before writing SQL.'

  schema = z.object({
    dataSourceId: z.number(),
    tableName: z.string().describe('The name of the table to inspect'),
  })

  async _call({ dataSourceId, tableName }: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { client, dbType } = await DbHelper.getConnection(dataSourceId)
      let schemaDescription = ''

      const sensitiveFields = [
        'password',
        'pwd',
        'secret',
        'token',
        'key',
        'iv',
        'salt',
        'recovery_code',
        'two_factor_secret',
        'api_key',
        'access_token',
        'refresh_token',
      ]
      const isSensitive = (name: string) =>
        sensitiveFields.some(f => name.toLowerCase().includes(f))

      if (dbType === 'postgresql') {
        const columns = await client.rawQuery(
          `
            SELECT
                a.attname AS column_name,
                format_type(a.atttypid, a.atttypmod) AS data_type,
                CASE
                    WHEN (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid AND a.attnum = ANY(i.indkey) AND i.indisprimary) > 0 THEN 'PRI'
                    WHEN (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid AND a.attnum = ANY(i.indkey) AND i.indisunique) > 0 THEN 'UNI'
                    ELSE ''
                END AS key,
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

        if (columns.rows.length === 0)
          return `Table '${tableName}' not found.`

        schemaDescription = `Table: ${tableName}\nColumns:\n${columns.rows
          .map((c: any) => {
            const sensitiveTag = isSensitive(c.column_name) ? ' [SENSITIVE]' : ''
            return `- ${c.column_name} (${c.data_type}${c.key ? `, ${c.key}` : ''})${sensitiveTag}${c.comment ? ` // ${c.comment}` : ''}`
          })
          .join('\n')}`
      } else {
        // MySQL
        try {
          // SHOW FULL COLUMNS returns specific 'Comment' field
          const columns = await client.rawQuery(`SHOW FULL COLUMNS FROM \`${tableName}\``)
          // MySQL driver result format check
          const rows = Array.isArray(columns[0]) ? columns[0] : columns

          // MySQL SHOW FULL COLUMNS fields: Field, Type, Collation, Null, Key, Default, Extra, Privileges, Comment
          schemaDescription = `Table: ${tableName}\nColumns:\n${rows
            .map((c: any) => {
              const sensitiveTag = isSensitive(c.Field) ? ' [SENSITIVE]' : ''
              return `- ${c.Field} (${c.Type}${c.Key ? `, ${c.Key}` : ''})${sensitiveTag}${c.Comment ? ` // ${c.Comment}` : ''}`
            })
            .join('\n')}`
        } catch (e) {
          return `Table '${tableName}' not found or error describing: ${e.message}`
        }
      }

      return schemaDescription
    } catch (error: any) {
      return `Error getting schema: ${error.message}`
    }
  }
}
