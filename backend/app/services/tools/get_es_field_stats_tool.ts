import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import encryption from '@adonisjs/core/services/encryption'
import DataSource from '#models/data_source'
import ElasticsearchService from '#services/elasticsearch_service'

export class GetEsFieldStatsTool extends StructuredTool {
  name = 'get_es_field_stats'
  description = 'Get statistics for a specific field in an Elasticsearch index. For keyword fields, it returns top unique values. For numeric/date fields, it returns min/max/avg.'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source'),
    index: z.string().describe('The name of the index'),
    field: z.string().describe('The name of the field to get stats for'),
  })

  async _call(input: { dataSourceId: number, index: string, field: string }) {
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
      const stats = await esService.getFieldStats(input.index, input.field)
      return JSON.stringify(stats, null, 2)
    } catch (error: any) {
      return `Failed to get field stats: ${error.message}`
    }
  }
}
