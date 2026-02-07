import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'
import DiscoveryService from '#services/discovery_service'
import logger from '@adonisjs/core/services/logger'

export class SearchRelatedKnowledgeTool extends StructuredTool {
  name = 'search_related_knowledge'
  description
    = 'Search for business logic definitions, calculation rules, and previously successful query examples. Use this when you encounter unfamiliar terms or need guidance on complex logic.'

  schema = z.object({
    query: z.string().describe('The topic or business term to search for (e.g., "VIP customer criteria", "active user definition")'),
  })

  async _call({ query }: z.infer<typeof this.schema>): Promise<string> {
    try {
      logger.info(`[SearchRelatedKnowledgeTool] Searching for: "${query}"`)
      return await DiscoveryService.searchRelatedKnowledge(query)
    } catch (error: any) {
      return `Error searching knowledge base: ${error.message}`
    }
  }
}
