import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import encryption from '@adonisjs/core/services/encryption'
import DataSource from '#models/data_source'
import ElasticsearchService from '#services/elasticsearch_service'

export class ListEsIndicesTool extends StructuredTool {
  name = 'list_es_indices'
  description = 'List all indices in an Elasticsearch data source'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source to list indices from'),
  })

  async _call(input: { dataSourceId: number }) {
    try {
      const dataSource = await DataSource.findOrFail(input.dataSourceId)
      if (dataSource.type !== 'elasticsearch') {
        return 'Error: Data source is not an Elasticsearch type'
      }

      const esService = new ElasticsearchService({
        node: dataSource.host.includes('://') ? `${dataSource.host}:${dataSource.port}` : `http://${dataSource.host}:${dataSource.port}`,
        auth: {
          username: dataSource.username,
          password: dataSource.password ? (encryption.decrypt(dataSource.password) as string) : undefined,
          apiKey: dataSource.config?.apiKey,
        },
      })
      // Use _cat/indices for a simpler list
      const indices: any = await esService.client.cat.indices({ format: 'json' })

      const allCount = indices.length
      const filteredIndices = indices.filter((i: any) => {
        // Hide truly internal indices
        const internalPrefixes = ['.kibana', '.security', '.monitoring', '.async-search', '.apm', '.tasks', '.reporting']
        if (internalPrefixes.some(p => i.index.startsWith(p)))
          return false
        if (i.index === 'search-history')
          return false

        // Allow common data streams and business indices
        // In ES, data streams often start with '.ds-' but contain real log data
        if (i.index.startsWith('.ds-'))
          return true

        // Hide other generic dot-prefixed indices if they don't look like data streams
        if (i.index.startsWith('.') && !i.index.startsWith('.ds-'))
          return false

        return true
      })

      if (filteredIndices.length === 0 && allCount > 0) {
        return `No business indices found. Found ${allCount} system/internal indices (hidden).`
      }

      const limitedIndices = filteredIndices.slice(0, 50)

      return JSON.stringify(limitedIndices.map((i: any) => ({
        index: i.index,
        docsCount: i['docs.count'],
        size: i['store.size'],
      })))
    } catch (error: any) {
      return `Failed to list indices: ${error.message}`
    }
  }
}
