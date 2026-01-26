import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'
import DbHelper from '#services/db_helper'

export class SampleTableDataTool extends StructuredTool {
  name = 'sample_table_data'
  description
    = 'Get the first 3 rows of data from a table to understand the actual values (e.g., status codes, date formats).'

  schema = z.object({
    dataSourceId: z.number(),
    tableName: z.string(),
  })

  protected sensitiveFields = [
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

  async _call({ dataSourceId, tableName }: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { client, dbType } = await DbHelper.getConnection(dataSourceId)

      let rows: any[] = []
      if (dbType === 'postgresql') {
        const res = await client.rawQuery(`SELECT * FROM "${tableName}" LIMIT 3`)
        rows = res.rows
      } else {
        const res = await client.rawQuery(`SELECT * FROM \`${tableName}\` LIMIT 3`)
        rows = res[0]
      }

      if (!rows || rows.length === 0)
        return `Table '${tableName}' is empty.`

      // Filter out sensitive data
      const filteredRows = rows.map((row) => {
        const filtered: any = {}
        for (const key in row) {
          const lowKey = key.toLowerCase()
          if (this.sensitiveFields.some(f => lowKey.includes(f))) {
            filtered[key] = '[HIDDEN-FOR-SECURITY]'
          } else {
            filtered[key] = row[key]
          }
        }
        return filtered
      })

      return JSON.stringify(filteredRows, null, 2)
    } catch (error: any) {
      return `Error sampling data: ${error.message}`
    }
  }
}
