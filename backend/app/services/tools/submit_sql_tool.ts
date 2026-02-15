import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'

export class SubmitSqlTool extends StructuredTool {
  name = 'submit_sql_solution'
  description
    = 'Use this tool to submit your final SQL solution. [IMPORTANT] The `explanation` field is what the user sees - it MUST contain the SQL query inside a ```sql code block.'

  schema = z.object({
    sql: z.string().describe('The final, valid SQL query (used for execution).'),
    error: z.string().optional().describe('Optional explanation if the query cannot be validly constructed due to missing data or other constraints.'),
    explanation: z.string().describe('The formatted response for the user. MUST include a ```sql code block containing the final query.'),
    risk_level: z
      .enum(['safe', 'modification'])
      .describe('Set to \'modification\' if the query changes data (UPDATE/DELETE/INSERT).'),
  })

  // This tool is a signal, not a functional tool. The loop intercepts it.
  async _call(_input: any) {
    return 'Solution submitted.'
  }
}
