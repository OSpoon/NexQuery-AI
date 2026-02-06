import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'

export class SubmitSqlTool extends StructuredTool {
  name = 'submit_sql_solution'
  description
    = 'Use this tool to submit your final SQL solution. The `explanation` field MUST follow this format: ### 优化分析\n(Your analysis)\n\n### 优化后的查询语句\n```sql\n(SQL query)\n```'

  schema = z.object({
    sql: z.string().describe('The final, valid SQL query.'),
    explanation: z.string().describe('The complete, formatted Markdown response. MUST include: ### 优化分析\n(content)\n\n### 优化后的查询语句\n```sql\n(sql)\n```'),
    risk_level: z
      .enum(['safe', 'modification'])
      .describe('Set to \'modification\' if the query changes data (UPDATE/DELETE/INSERT).'),
  })

  // This tool is a signal, not a functional tool. The loop intercepts it.
  async _call(_input: any) {
    return 'Solution submitted.'
  }
}
