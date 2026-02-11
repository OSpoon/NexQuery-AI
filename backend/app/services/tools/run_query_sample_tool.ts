import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'
import DbHelper from '#services/db_helper'
import { ValidateSqlTool } from '#services/tools/validate_sql_tool'

export class RunQuerySampleTool extends StructuredTool {
  name = 'run_query_sample'
  description = 'Safely execute a SELECT query to preview the FIRST 5 rows of results. Use this to verify your query logic, JOIN results, or data correctness before final submission. [STRICT] Only SELECT queries are allowed.'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source'),
    sql: z.string().describe('The SQL SELECT query to sample. Should include a LIMIT (it will be forced to 5 anyway).'),
  })

  async _call({ dataSourceId, sql }: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { client, dbType } = await DbHelper.getConnection(dataSourceId)

      // 1. Safety Check (Reuse AST validation from ValidateSqlTool)
      const validationError = ValidateSqlTool.validateAst(sql, dbType)
      if (validationError) {
        return `Safety Block: ${validationError}`
      }

      const trimmedSql = sql.trim().toLowerCase()
      const isSelect = trimmedSql.startsWith('select') || trimmedSql.startsWith('with')

      if (!isSelect) {
        return 'Safety Block: run_query_sample only supports SELECT or WITH statements. Use other specialized tools if needed.'
      }

      // 2. Force Limit for performance and safety
      // Regex to remove existing limit or handle complex cases might be brittle,
      // so we use a subquery approach or just append if simple.
      // Easiest is to wrap in a subquery: SELECT * FROM ( {sql} ) as sample_sub LIMIT 5
      const samplingSql = dbType === 'postgresql'
        ? `SELECT * FROM (${sql.replace(/;$/, '')}) as sample_sub LIMIT 5`
        : `SELECT * FROM (${sql.replace(/;$/, '')}) as sample_sub LIMIT 5`

      const result = await client.rawQuery(samplingSql)
      const rows = dbType === 'postgresql' ? result.rows : (Array.isArray(result[0]) ? result[0] : result)

      if (rows.length === 0) {
        return 'Query returned 0 rows. Please verify your JOIN conditions or WHERE clauses.'
      }

      // 3. Format result as a markdown table or simple list
      let output = `Sample results (Top ${rows.length} rows):\n\n`
      const headers = Object.keys(rows[0])
      output += `| ${headers.join(' | ')} |\n`
      output += `| ${headers.map(() => '---').join(' | ')} |\n`

      rows.forEach((row: any) => {
        const values = headers.map((h) => {
          const val = row[h]
          if (val === null)
            return 'NULL'
          if (typeof val === 'object')
            return JSON.stringify(val)
          return String(val)
        })
        output += `| ${values.join(' | ')} |\n`
      })

      return output
    } catch (error: any) {
      return `Execution Error: ${error.message}. Action: Review the error message and check your JOIN/FILTER logic.`
    }
  }
}
