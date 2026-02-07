import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'

export class SubmitLuceneTool extends StructuredTool {
  name = 'submit_lucene_solution'
  description
    = 'Use this tool to submit your final Lucene query solution. The `explanation` field MUST follow this format: ### 优化分析\n(Your analysis)\n\n### 查询语句\n```lucene\n(Lucene query)\n```'

  schema = z.object({
    lucene: z.string().describe('The final Lucene query string (e.g., "level:ERROR AND message:failed").'),
    explanation: z.string().describe('The complete, formatted Markdown response. MUST include: ### 优化分析\n(content)\n\n### 查询语句\n```lucene\n(lucene)\n```'),
    index: z.string().describe('The index name to search against.').optional(),
  })

  async _call(_input: any) {
    return 'Solution submitted.'
  }
}
