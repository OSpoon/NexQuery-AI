import DbHelper from '#services/db_helper'
import EmbeddingService from '#services/embedding_service'
import TableMetadata from '#models/table_metadata'
import VectorStoreService from '#services/vector_store_service'

export default class SchemaSyncService {
  /**
   * Sync all tables from a data source to the vector store (TableMetadata)
   */
  public async syncDataSource(dataSourceId: number) {
    console.log(`[SchemaSync] Starting sync for DS: ${dataSourceId}`)
    const { client, dbType } = await DbHelper.getConnection(dataSourceId)
    const embeddingService = new EmbeddingService()
    const vectorStore = new VectorStoreService()

    // 1. List all tables
    let tables: string[] = []
    if (dbType === 'postgresql') {
      const query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      const result = await client.rawQuery(query)
      tables = result.rows.map((r: any) => r.table_name)
    } else {
      const query = 'SHOW TABLES'
      const result = await client.rawQuery(query)
      const rows = result[0]
      tables = rows.map((r: any) => Object.values(r)[0])
    }

    console.log(`[SchemaSync] Found ${tables.length} tables. Processing...`)

    // 2. Process each table
    for (const tableName of tables) {
      try {
        const schemaText = await this.getTableSchemaText(client, dbType, tableName)

        // 3. Generate or Reuse Embedding
        // Check if we already have metadata for this table
        const existingMetadata = await TableMetadata.query()
          .where('dataSourceId', dataSourceId)
          .where('tableName', tableName)
          .first()

        let embedding: number[] = []

        // If the schema text hasn't changed and we have an embedding, reuse it (Cache hit)
        if (
          existingMetadata &&
          existingMetadata.description === schemaText &&
          existingMetadata.embedding &&
          existingMetadata.embedding.length > 0
        ) {
          console.log(`[SchemaSync] Cache hit for table: ${tableName}. Reusing Database embedding.`)
          embedding = existingMetadata.embedding
        } else {
          // Cache miss: Generate new embedding via API
          console.log(
            `[SchemaSync] Cache miss for table: ${tableName}. Generating new embedding...`
          )
          embedding = await embeddingService.generate(schemaText)
        }

        // 4. Upsert to DB (Update timestamp or content)
        await TableMetadata.updateOrCreate(
          { dataSourceId, tableName },
          {
            description: schemaText,
            embedding: embedding,
          }
        )

        // 5. Upsert to Vector Store
        if (embedding && embedding.length > 0) {
          await vectorStore.upsertTable(dataSourceId, tableName, schemaText, embedding)
        }

        console.log(`[SchemaSync] Synced: ${tableName}`)
      } catch (e) {
        console.error(`[SchemaSync] Failed to sync table ${tableName}`, e)
      }
    }

    console.log(`[SchemaSync] Completed sync for DS: ${dataSourceId}`)
  }

  private async getTableSchemaText(
    client: any,
    dbType: string,
    tableName: string
  ): Promise<string> {
    let columnsDesc = ''
    let tableComment = ''

    if (dbType === 'postgresql') {
      // Get table comment
      const tableCommentRes = await client.rawQuery(
        `SELECT d.description 
         FROM pg_class c 
         JOIN pg_namespace n ON c.relnamespace = n.oid 
         LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = 0
         WHERE c.relname = ? AND n.nspname = 'public'`,
        [tableName]
      )
      if (tableCommentRes.rows.length > 0 && tableCommentRes.rows[0].description) {
        tableComment = tableCommentRes.rows[0].description
      }

      const columns = await client.rawQuery(
        `
          SELECT
              a.attname AS column_name,
              format_type(a.atttypid, a.atttypmod) AS data_type,
              d.description AS comment
          FROM
              pg_attribute a
          JOIN
              pg_class c ON a.attrelid = c.oid
          JOIN
              pg_namespace n ON c.relnamespace = n.oid
          LEFT JOIN
              pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum
          WHERE
              c.relname = ?
              AND n.nspname = 'public'
              AND a.attnum > 0
              AND NOT a.attisdropped;
      `,
        [tableName]
      )

      columnsDesc = columns.rows
        .map(
          (c: any) => `- ${c.column_name} (${c.data_type})${c.comment ? ` // ${c.comment}` : ''}`
        )
        .join('\n')
    } else {
      // MySQL
      // Get Table Comment
      const tableInfo = await client.rawQuery(`SHOW TABLE STATUS LIKE ?`, [tableName])
      if (tableInfo[0] && tableInfo[0][0] && tableInfo[0][0].Comment) {
        tableComment = tableInfo[0][0].Comment
      }

      const columnsRes = await client.rawQuery(`SHOW FULL COLUMNS FROM \`${tableName}\``)
      const rows = Array.isArray(columnsRes[0]) ? columnsRes[0] : columnsRes

      columnsDesc = rows
        .map((c: any) => `- ${c.Field} (${c.Type})${c.Comment ? ` // ${c.Comment}` : ''}`)
        .join('\n')
    }

    return `Table: ${tableName}${tableComment ? `\nComment: ${tableComment}` : ''}\nColumns:\n${columnsDesc}`
  }
}
