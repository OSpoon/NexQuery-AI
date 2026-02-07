import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'
import DiscoveryService from '#services/discovery_service'

export class ListEntitiesTool extends StructuredTool {
  name = 'list_entities'
  description = 'List all available entities (tables or indices) in the data source. Use this to get an overview of the data structure.'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source to explore'),
  })

  async _call({ dataSourceId }: z.infer<typeof this.schema>): Promise<string> {
    try {
      const entities = await DiscoveryService.listEntities(dataSourceId)

      if (entities.length === 0) {
        return 'No entities found in this data source.'
      }

      return entities.map(e => `- ${e.name} (${e.type})${e.description ? `: ${e.description}` : ''}`).join('\n')
    } catch (error: any) {
      return `Error listing entities: ${error.message}`
    }
  }
}
