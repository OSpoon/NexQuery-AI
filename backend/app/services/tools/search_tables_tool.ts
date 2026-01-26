import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'
import EmbeddingService from '#services/embedding_service'
import TableMetadata from '#models/table_metadata'
import VectorStoreService from '#services/vector_store_service'
import logger from '@adonisjs/core/services/logger'

export class SearchTablesTool extends StructuredTool {
  name = 'search_tables'
  description
    = 'Search for relevant tables using semantic search. Use this when you are unsure which tables contain the needed data. Provide a natural language description of what you are looking for.'

  schema = z.object({
    dataSourceId: z.number().describe('The ID of the data source to query'),
    query: z
      .string()
      .describe(
        'Natural language description of the data you are looking for (e.g., "customer orders", "employee salaries")',
      ),
  })

  async _call({ dataSourceId, query }: z.infer<typeof this.schema>): Promise<string> {
    try {
      logger.info(`[SearchTablesTool] Searching for: "${query}" in DS: ${dataSourceId}`)

      const embeddingService = new EmbeddingService()
      const vectorStore = new VectorStoreService()
      const queryEmbedding = await embeddingService.generate(query)

      // Search Vector Store
      const results = await vectorStore.searchTables(dataSourceId, queryEmbedding, 20)

      if (results.length === 0) {
        // Check if we have legacy data but no vector data
        const hasData = await TableMetadata.query().where('dataSourceId', dataSourceId).first()
        if (hasData) {
          return 'No results found in Vector Database. Please go to Data Source -> Sync Schema to populate the new Vector Database.'
        }
        return 'No metadata found. Please ask the administrator to run "Sync Schema" for this data source.'
      }

      return JSON.stringify(
        results.map(t => ({
          table: t.payload?.tableName,
          description: `${(t.payload?.fullSchema as string)?.slice(0, 200)}...`,
          relevance: t.score.toFixed(4),
        })),
      )
    } catch (error: any) {
      return `Error searching tables: ${error.message}`
    }
  }
}
