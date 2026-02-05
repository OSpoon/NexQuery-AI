import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import encryption from '@adonisjs/core/services/encryption'
import DataSource from '#models/data_source'
import ElasticsearchService from '#services/elasticsearch_service'

export class GetEsIndexSummaryTool extends StructuredTool {
  name = 'get_es_index_summary'
  description = 'Get a high-level summary of an Elasticsearch index, including doc count, storage size, and time range.'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source'),
    index: z.string().describe('The name of the index to get summary for'),
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
      const summary = await esService.getIndexSummary(input.index)
      return JSON.stringify(summary, null, 2)
    } catch (error: any) {
      return `Failed to get index summary: ${error.message}`
    }
  }
}
