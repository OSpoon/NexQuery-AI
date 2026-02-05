import type { HttpContext } from '@adonisjs/core/http'
import KnowledgeBase from '#models/knowledge_base'
import EmbeddingService from '#services/embedding_service'
import VectorStoreService from '#services/vector_store_service'

export default class KnowledgeBasesController {
  public async index({ request, response }: HttpContext) {
    const sourceType = request.input('sourceType')
    const query = KnowledgeBase.query().orderBy('created_at', 'desc')

    if (sourceType) {
      query.where('source_type', sourceType)
    }

    const items = await query.exec()
    return response.json(items)
  }

  public async store({ request, response, auth }: HttpContext) {
    if (!auth.user!.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    const data = request.only(['keyword', 'description', 'exampleSql', 'sourceType'])

    // Validate that keyword is unique
    const existing = await KnowledgeBase.findBy('keyword', data.keyword)
    if (existing) {
      return response.badRequest({ message: 'Keyword already exists' })
    }

    // Generate embedding
    let embedding: number[] = []
    try {
      const embeddingService = new EmbeddingService()
      embedding = await embeddingService.generate(`${data.keyword}: ${data.description}`)
    } catch (e) {
      console.warn('[KnowledgeBasesController] Embedding generation failed', e)
    }

    const item = await KnowledgeBase.create({
      keyword: data.keyword,
      description: data.description,
      exampleSql: data.exampleSql,
      sourceType: data.sourceType || 'sql',
      embedding,
      status: 'approved',
    })

    // Sync to Qdrant immediately if approved
    if (item.status === 'approved' && item.embedding && item.embedding.length > 0) {
      try {
        const vectorStore = new VectorStoreService()
        await vectorStore.upsertKnowledge(
          item.keyword,
          item.description,
          item.exampleSql,
          item.embedding,
          item.status,
        )
      } catch (e) {
        console.error('Failed to sync manual knowledge to Qdrant', e)
      }
    }

    return response.created(item)
  }

  public async update({ params, request, response, auth }: HttpContext) {
    if (!auth.user!.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    const item = await KnowledgeBase.findOrFail(params.id)
    const data = request.only(['keyword', 'description', 'exampleSql', 'status', 'sourceType'])

    // Store old keyword for deletion if needed (though changing keyword changes ID)
    const oldKeyword = item.keyword

    if (data.keyword && data.keyword !== item.keyword) {
      const existing = await KnowledgeBase.findBy('keyword', data.keyword)
      if (existing) {
        return response.badRequest({ message: 'Keyword already exists' })
      }
    }

    // Regen embedding if content changed
    let embedding = item.embedding
    if (
      (data.keyword && data.keyword !== item.keyword)
      || (data.description && data.description !== item.description)
    ) {
      try {
        const embeddingService = new EmbeddingService()
        embedding = await embeddingService.generate(
          `${data.keyword || item.keyword}: ${data.description || item.description}`,
        )
      } catch (e) {
        console.warn('[KnowledgeBasesController] Embedding generation failed on update', e)
      }
    }

    item.merge({
      keyword: data.keyword,
      description: data.description,
      exampleSql: data.exampleSql,
      sourceType: data.sourceType || item.sourceType,
      status: 'approved',
      embedding,
    })
    await item.save()

    const vectorStore = new VectorStoreService()

    // Handle Keyword Change: Delete old keyword if keyword changed
    if (oldKeyword !== item.keyword) {
      await vectorStore.deleteKnowledge(oldKeyword)
    }

    // Sync logic: Always Push to Qdrant (all entries are approved)
    if (item.embedding && item.embedding.length > 0) {
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
        console.error('Failed to sync updated knowledge to Qdrant', e)
      }
    }

    return response.json(item)
  }

  public async destroy({ params, response, auth }: HttpContext) {
    if (!auth.user!.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    const item = await KnowledgeBase.findOrFail(params.id)
    const keyword = item.keyword
    await item.delete()

    // Sync Deletion
    const vectorStore = new VectorStoreService()
    await vectorStore.deleteKnowledge(keyword)

    return response.json({ message: 'Deleted successfully' })
  }
}
