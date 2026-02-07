import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'
import DiscoveryService from '#services/discovery_service'
import logger from '@adonisjs/core/services/logger'

export class SearchEntitiesTool extends StructuredTool {
  name = 'search_entities'
  description
    = 'Search for relevant entities (tables or indices) using semantic search. Use this when you are unsure which entities contain the needed data. Provide a natural language description.'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source to search in'),
    query: z
      .string()
      .describe(
        'Natural language description of the data (e.g., "customer orders", "log events")',
      ),
  })

  async _call({ dataSourceId, query }: z.infer<typeof this.schema>): Promise<string> {
    try {
      logger.info(`[SearchEntitiesTool] Searching entities for: "${query}"`)
      return await DiscoveryService.searchEntities(dataSourceId, query)
    } catch (error: any) {
      return `Error searching entities: ${error.message}`
    }
  }
}
