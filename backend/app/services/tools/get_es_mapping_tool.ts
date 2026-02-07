import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import encryption from '@adonisjs/core/services/encryption'
import DataSource from '#models/data_source'
import ElasticsearchService from '#services/elasticsearch_service'

export class GetEsMappingTool extends StructuredTool {
  name = 'get_es_mapping'
  description = 'Get the field mapping (schema) for a specific Elasticsearch index'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source'),
    index: z.string().describe('The name of the index to get mapping for'),
  })

  async _call(input: { dataSourceId: number, index: string }) {
    try {
      const dataSource = await DataSource.findOrFail(input.dataSourceId)
      const esService = new ElasticsearchService({
        node: dataSource.host.includes('://') ? `${dataSource.host}:${dataSource.port}` : `http://${dataSource.host}:${dataSource.port}`,
        auth: {
          username: dataSource.username,
          password: dataSource.password ? (encryption.decrypt(dataSource.password) as string) : undefined,
          apiKey: dataSource.config?.apiKey,
        },
      })
      const mapping: any = await esService.getMapping(input.index)

      // Simplify mapping structure to reduce context size: only return field name and type
      const properties = mapping[input.index]?.mappings?.properties || {}
      const simplified: Record<string, string> = {}
      for (const [key, value] of Object.entries(properties)) {
        const fieldInfo = value as any
        simplified[key] = fieldInfo.type || (fieldInfo.properties ? 'object' : 'unknown')
      }
      return JSON.stringify(simplified)
    } catch (error: any) {
      return `Failed to get mapping: ${error.message}`
    }
  }
}
