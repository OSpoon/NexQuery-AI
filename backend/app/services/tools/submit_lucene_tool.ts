import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'

export class SubmitLuceneTool extends StructuredTool {
  name = 'submit_lucene_solution'
  description
    = 'Use this tool to submit your final Lucene query solution. Do NOT output markdown code blocks.'

  schema = z.object({
    lucene: z.string().describe('The final Lucene query string (e.g., "level:ERROR AND message:failed").'),
    explanation: z.string().describe('A concise explanation of the query in Chinese.'),
    index: z.string().optional().describe('The index name to search against.'),
  })

  async _call(_input: any) {
    return 'Solution submitted.'
  }
}
