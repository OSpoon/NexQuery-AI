import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'
import DbHelper from '#services/db_helper'

export class ListTablesTool extends StructuredTool {
  name = 'list_tables'
  description = 'List all table names in the database. Use this to discover available tables.'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source to query'),
  })

  async _call({ dataSourceId }: z.infer<typeof this.schema>): Promise<string> {
    try {
      console.log(`[ListTablesTool] Called for DS: ${dataSourceId}`)
      const { client, dbType } = await DbHelper.getConnection(dataSourceId)

      let result: any
      if (dbType === 'postgresql') {
        const query =
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        result = await client.rawQuery(query)
        // PG returns { rows: [] }
        return JSON.stringify(result.rows.map((r: any) => r.table_name))
      } else {
        const query = 'SHOW TABLES'
        result = await client.rawQuery(query)
        // MySQL returns [ [RowDataPacket], [FieldPacket] ] usually, or just array of rows depending on driver
        // Adonis rawQuery usually returns [rows, fields] for MySQL
        const rows = result[0]
        const tables = rows.map((r: any) => Object.values(r)[0])
        return JSON.stringify(tables)
      }
    } catch (error: any) {
      return `Error listing tables: ${error.message}`
    }
  }
}
