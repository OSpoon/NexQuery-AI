import EmbeddingService from '#services/embedding_service'
import TableMetadata from '#models/table_metadata'
import VectorStoreService from '#services/vector_store_service'
import logger from '@adonisjs/core/services/logger'
import { SchemaService } from '#services/schema_service'

export default class SchemaSyncService {
  /**
   * Sync all tables from a data source to the vector store (TableMetadata)
   */
  public async syncDataSource(dataSourceId: number) {
    logger.info(`[SchemaSync] Starting sync for DS: ${dataSourceId}`)
    const schemaService = new SchemaService()
    const tables = await schemaService.listTables(dataSourceId)

    logger.info(`[SchemaSync] Found ${tables.length} tables. Processing...`)

    const embeddingService = new EmbeddingService()
    const vectorStore = new VectorStoreService()

    // 2. Process each table
    for (const tableName of tables) {
      try {
        const schemaText = await schemaService.getFormattedSchemaText(dataSourceId, tableName)

        // 3. Generate or Reuse Embedding
        // Check if we already have metadata for this table
        const existingMetadata = await TableMetadata.query()
          .where('dataSourceId', dataSourceId)
          .where('tableName', tableName)
          .first()

        let embedding: number[] = []

        // If the schema text hasn't changed and we have an embedding, reuse it (Cache hit)
        if (
          existingMetadata
          && existingMetadata.description === schemaText
          && existingMetadata.embedding
          && existingMetadata.embedding.length > 0
        ) {
          logger.info(`[SchemaSync] Cache hit for table: ${tableName}. Reusing Database embedding.`)
          embedding = existingMetadata.embedding
        } else {
          // Cache miss: Generate new embedding via API
          logger.info(
            `[SchemaSync] Cache miss for table: ${tableName}. Generating new embedding...`,
          )
          embedding = await embeddingService.generate(schemaText)
        }

        // 4. Upsert to DB (Update timestamp or content)
        await TableMetadata.updateOrCreate(
          { dataSourceId, tableName },
          {
            description: schemaText,
            embedding,
          },
        )

        // 5. Upsert to Vector Store
        if (embedding && embedding.length > 0) {
          await vectorStore.upsertTable(dataSourceId, tableName, schemaText, embedding)
        }

        logger.info(`[SchemaSync] Synced: ${tableName}`)
      } catch (e) {
        logger.error({ error: e }, `[SchemaSync] Failed to sync table ${tableName}`)
      }
    }

    logger.info(`[SchemaSync] Completed sync for DS: ${dataSourceId}`)
  }
}
