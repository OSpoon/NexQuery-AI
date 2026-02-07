import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'

export class SubmitLuceneTool extends StructuredTool {
  name = 'submit_lucene_solution'
  description
    = 'Use this tool to submit your final Lucene solution. [IMPORTANT] The `explanation` field is what the user sees - it MUST contain the Lucene query inside a ```lucene code block.'

  schema = z.object({
    lucene: z.string().describe('The final Lucene query string (used for execution).'),
    explanation: z.string().describe('The formatted response for the user. MUST include a ```lucene code block containing the final query.'),
    index: z.string().describe('The index name to search against.').optional(),
  })

  async _call(_input: any) {
    return 'Solution submitted.'
  }
}
