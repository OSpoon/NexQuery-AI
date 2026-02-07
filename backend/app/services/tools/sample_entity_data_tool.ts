import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'
import DiscoveryService from '#services/discovery_service'

export class SampleEntityDataTool extends StructuredTool {
  name = 'sample_entity_data'
  description = 'Get a few sample records from an entity (table or index) to understand the data format and content.'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source'),
    entityName: z.string().describe('The name of the entity to sample'),
    limit: z.number().optional().default(3).describe('Number of records to return'),
  })

  async _call({ dataSourceId, entityName, limit }: z.infer<typeof this.schema>): Promise<string> {
    try {
      const data = await DiscoveryService.sampleData(dataSourceId, entityName, limit)

      if (data.length === 0) {
        return `No data found in entity '${entityName}'.`
      }

      return JSON.stringify(data, null, 2)
    } catch (error: any) {
      return `Error sampling data: ${error.message}`
    }
  }
}
