import { QdrantClient } from '@qdrant/js-client-rest'
import env from '#start/env'
import { createHash } from 'node:crypto'
import logger from '@adonisjs/core/services/logger'

export default class VectorStoreService {
  private client: QdrantClient
  // Collection for table metadata
  public static readonly TABLES_COLLECTION = 'tables_metadata_v1'
  // Collection for knowledge base (few-shot examples & domain terms)
  public static readonly KNOWLEDGE_COLLECTION = 'knowledge_base_v1'

  constructor() {
    const host = env.get('QDRANT_HOST')
    const port = env.get('QDRANT_PORT')
    const apiKey = env.get('QDRANT_API_KEY')

    this.client = new QdrantClient({
      url: `http://${host}:${port}`,
      apiKey,
    })
  }

  /**
   * Ensure collection exists
   */
  public async ensureCollection(collectionName: string, vectorSize: number) {
    try {
      const response = await this.client.getCollections()
      const exists = response.collections.some(c => c.name === collectionName)

      if (!exists) {
        await this.client.createCollection(collectionName, {
          vectors: {
            size: vectorSize,
            distance: 'Cosine',
          },
        })
        logger.info(`[VectorStore] Created collection: ${collectionName}`)
      }
    } catch (error) {
      logger.error({ error }, '[VectorStore] Error ensuring collection')
      // Do not throw, maybe qdrant is not ready, strict error handling might break sync
    }
  }

  /**
   * Generate a deterministic UUID from a string (Mock v5)
   * Qdrant requires UUID or Int ID.
   */
  private generateId(input: string): string {
    const hash = createHash('sha256').update(input).digest('hex')
    // Format as UUID: 8-4-4-4-12
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`
  }

  /**
   * Upsert table metadata
   */
  public async upsertTable(
    dataSourceId: number,
    tableName: string,
    description: string,
    vector: number[],
  ) {
    await this.ensureCollection(VectorStoreService.TABLES_COLLECTION, vector.length)

    const pointId = this.generateId(`ds_${dataSourceId}_tb_${tableName}`)

    await this.client.upsert(VectorStoreService.TABLES_COLLECTION, {
      wait: true,
      points: [
        {
          id: pointId,
          vector,
          payload: {
            dataSourceId,
            tableName,
            fullSchema: description,
          },
        },
      ],
    })
  }

  /**
   * Upsert knowledge base item
   */
  public async upsertKnowledge(
    keyword: string,
    description: string,
    exampleSql: string | null | undefined,
    vector: number[],
  ) {
    await this.ensureCollection(VectorStoreService.KNOWLEDGE_COLLECTION, vector.length)

    // Generate ID based on keyword to avoid duplicates
    const pointId = this.generateId(`kb_${keyword}`)

    await this.client.upsert(VectorStoreService.KNOWLEDGE_COLLECTION, {
      wait: true,
      points: [
        {
          id: pointId,
          vector,
          payload: {
            keyword,
            description,
            exampleSql: exampleSql || '',
          },
        },
      ],
    })
  }

  /**
   * Search tables
   */
  public async searchTables(dataSourceId: number, queryVector: number[], limit: number = 20) {
    try {
      const results = await this.client.search(VectorStoreService.TABLES_COLLECTION, {
        vector: queryVector,
        limit,
        filter: {
          must: [
            {
              key: 'dataSourceId',
              match: {
                value: dataSourceId,
              },
            },
          ],
        },
      })

      return results
    } catch (e: any) {
      // If collection doesn't exist (404), return empty
      if (e.message && e.message.includes('Not Found'))
        return []
      if ((e.status as number) === 404)
        return []
      throw e
    }
  }

  /**
   * Search Knowledge Base
   */
  public async searchKnowledge(
    queryVector: number[],
    limit: number = 5,
    status?: 'approved' | 'pending',
  ) {
    try {
      const filter: any = { must: [] }
      if (status) {
        filter.must.push({
          key: 'status',
          match: {
            value: status,
          },
        })
      }

      const results = await this.client.search(VectorStoreService.KNOWLEDGE_COLLECTION, {
        vector: queryVector,
        limit,
        filter: filter.must.length > 0 ? filter : undefined,
      })
      return results
    } catch (e: any) {
      if (e.message && e.message.includes('Not Found'))
        return []
      if ((e.status as number) === 404)
        return []
      throw e
    }
  }

  /**
   * Delete knowledge base item
   */
  public async deleteKnowledge(keyword: string) {
    try {
      const pointId = this.generateId(`kb_${keyword}`)
      await this.client.delete(VectorStoreService.KNOWLEDGE_COLLECTION, {
        points: [pointId],
      })
      logger.info(`[VectorStore] Deleted knowledge: ${keyword}`)
    } catch (e: any) {
      logger.error({ error: e }, '[VectorStore] Failed to delete knowledge')
      // Don't throw, as it might already be deleted or collection missing
    }
  }
}
