import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import encryption from '@adonisjs/core/services/encryption'
import DataSource from '#models/data_source'
import ElasticsearchService from '#services/elasticsearch_service'

export class SampleEsDataTool extends StructuredTool {
  name = 'sample_es_data'
  description = 'Get the first 3 documents from an Elasticsearch index to understand the data structure and values.'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source'),
    index: z.string().describe('The name of the index to sample'),
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

      const results = await esService.search({
        index: input.index,
        size: 3,
      })

      if (results.length === 0) {
        return `Index '${input.index}' is empty.`
      }

      // Return only the source data (without metadata for brevity)
      const samples = results.map(r => r.source)
      return JSON.stringify(samples, null, 2)
    } catch (error: any) {
      return `Error sampling ES data: ${error.message}`
    }
  }
}
