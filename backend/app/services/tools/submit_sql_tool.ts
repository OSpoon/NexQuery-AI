import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'

export class SubmitSqlTool extends StructuredTool {
    name = 'submit_sql_solution'
    description =
        'Use this tool to submit your final SQL solution. Do NOT output markdown code blocks. Use this tool ONLY after you have verified the SQL with validate_sql.'

    schema = z.object({
        sql: z.string().describe('The final, valid SQL query.'),
        explanation: z.string().describe('A concise explanation of the query in Chinese.'),
        risk_level: z
            .enum(['safe', 'modification'])
            .describe("Set to 'modification' if the query changes data (UPDATE/DELETE/INSERT)."),
    })

    // This tool is a signal, not a functional tool. The loop intercepts it.
    async _call(_input: any) {
        return 'Solution submitted.'
    }
}
