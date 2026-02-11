import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'
import DiscoveryService from '#services/discovery_service'

export class GetEntityStatisticsTool extends StructuredTool {
  name = 'get_entity_statistics'
  description = 'Get a comprehensive statistical summary (Data Profiling) for an entity. Includes total records, MIN/MAX for numeric/date fields, null counts, and TOP-N most frequent values for categorical fields. Use this to understand data ranges, distributions, and available categories without sampling.'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source'),
    entityName: z.string().describe('The name of the entity to analyze'),
  })

  async _call({ dataSourceId, entityName }: z.infer<typeof this.schema>): Promise<string> {
    try {
      const stats = await DiscoveryService.getEntityStatistics(dataSourceId, entityName)
      return JSON.stringify(stats, null, 2)
    } catch (error: any) {
      return `Error getting statistics: ${error.message}`
    }
  }
}
