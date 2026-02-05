import KnowledgeBase from '#models/knowledge_base'
import EmbeddingService from '#services/embedding_service'
import VectorStoreService from '#services/vector_store_service'
import logger from '@adonisjs/core/services/logger'

export default class KnowledgeBaseService {
  /**
   * Unified upsert: DB + Vector Store
   */
  public static async upsert(data: {
    keyword: string
    description: string
    exampleSql?: string | null
    sourceType?: string
    status?: 'approved'
    userId?: number
    id?: number // If providing ID, it's an update
  }) {
    const embeddingService = new EmbeddingService()
    const vectorStore = new VectorStoreService()

    let item: KnowledgeBase
    let isUpdate = false

    if (data.id) {
      item = await KnowledgeBase.findOrFail(data.id)
      isUpdate = true
    } else {
      // Check for duplication on new entry
      const existing = await KnowledgeBase.findBy('keyword', data.keyword)
      if (existing) {
        item = existing
        isUpdate = true
      } else {
        item = new KnowledgeBase()
      }
    }

    // Regen embedding if content changed or new
    let embedding = item.embedding
    if (!isUpdate || data.keyword !== item.keyword || data.description !== item.description) {
      try {
        embedding = await embeddingService.generate(`${data.keyword}: ${data.description}`, data.userId)
      } catch (e) {
        logger.warn(`[KnowledgeBaseService] Embedding generation failed: ${e.message}`)
      }
    }

    item.merge({
      keyword: data.keyword,
      description: data.description,
      exampleSql: data.exampleSql || item.exampleSql,
      sourceType: data.sourceType || item.sourceType || 'sql',
      embedding,
      status: data.status || item.status || 'approved',
    })

    await item.save()

    // Sync to Vector Store if approved and has embedding
    if (item.status === 'approved' && item.embedding && item.embedding.length > 0) {
      try {
        await vectorStore.upsertKnowledge(
          item.keyword,
          item.description,
          item.exampleSql,
          item.embedding,
          item.status,
          item.sourceType,
        )
      } catch (e) {
        logger.error({ error: e }, `[KnowledgeBaseService] Vector Store sync failed for ${item.keyword}`)
      }
    }

    return item
  }

  /**
   * Unified delete: DB + Vector Store
   */
  public static async delete(id: number) {
    const item = await KnowledgeBase.findOrFail(id)
    const keyword = item.keyword
    const vectorStore = new VectorStoreService()

    await item.delete()
    await vectorStore.deleteKnowledge(keyword)

    return true
  }
}
