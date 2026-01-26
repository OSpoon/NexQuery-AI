import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'

export class SubmitSqlTool extends StructuredTool {
  name = 'submit_sql_solution'
  description
    = 'Use this tool to submit your final SQL solution. Do NOT output markdown code blocks. Use this tool ONLY after you have verified the SQL with validate_sql.'

  schema = z.object({
    sql: z.string().describe('The final, valid SQL query.'),
    explanation: z.string().describe('A concise explanation of the query in Chinese.'),
    risk_level: z
      .enum(['safe', 'modification'])
      .describe('Set to \'modification\' if the query changes data (UPDATE/DELETE/INSERT).'),
    chart_recommendation: z
      .enum(['table', 'bar', 'line', 'pie', 'number'])
      .optional()
      .describe('Optional: Recommend a chart type for the data results.'),
    chart_config: z
      .object({
        x: z.string().describe('Column name to use for X axis or categories.'),
        y: z.string().describe('Column name(s) to use for Y axis or values.'),
      })
      .optional()
      .describe('Optional: Configuration for the recommended chart.'),
  })

  // This tool is a signal, not a functional tool. The loop intercepts it.
  async _call(_input: any) {
    return 'Solution submitted.'
  }
}
