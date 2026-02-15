import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import DiscoveryService from '#services/discovery_service'

/**
 * Tool to search for related business knowledge and few-shot examples
 */
export class SearchRelatedKnowledgeTool extends StructuredTool {
  name = 'search_related_knowledge'
  description = 'Search for related business knowledge, domain terms, and few-shot SQL examples in the Knowledge Base. Use this when facing complex logic, ambiguous terms, or when you need a syntax template.'

  schema = z.object({
    query: z.string().describe('The natural language query or keywords to search for in the Knowledge Base'),
    limit: z.number().optional().default(3).describe('Maximum number of results to return'),
  })

  protected async _call({ query, limit }: z.infer<typeof this.schema>): Promise<string> {
    try {
      return await DiscoveryService.searchRelatedKnowledge(query, limit)
    } catch (error: any) {
      return `Error searching knowledge: ${error.message}`
    }
  }
}
