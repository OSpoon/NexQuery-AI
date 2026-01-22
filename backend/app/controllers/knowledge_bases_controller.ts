import type { HttpContext } from '@adonisjs/core/http'
import KnowledgeBase from '#models/knowledge_base'
import EmbeddingService from '#services/embedding_service'
import VectorStoreService from '#services/vector_store_service'

export default class KnowledgeBasesController {
  public async index({ request, response }: HttpContext) {
    const status = request.input('status')
    const query = KnowledgeBase.query().orderBy('created_at', 'desc')

    if (status) {
      query.where('status', status)
    }

    const items = await query.exec()
    return response.json(items)
  }

  public async store({ request, response, auth }: HttpContext) {
    const user = auth.user!
    // RBAC: Check admin role
    if (!(await this.checkAdminRole(user))) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    const data = request.only(['keyword', 'description', 'exampleSql'])

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
      embedding: embedding,
      status: 'approved', // Manually created items are auto-approved
    })

    // Sync to Qdrant immediately if approved
    if (item.embedding && item.embedding.length > 0) {
      try {
        const vectorStore = new VectorStoreService()
        await vectorStore.upsertKnowledge(
          item.keyword,
          item.description,
          item.exampleSql,
          item.embedding
        )
      } catch (e) {
        console.error('Failed to sync manual knowledge to Qdrant', e)
      }
    }

    return response.created(item)
  }

  public async update({ params, request, response, auth }: HttpContext) {
    const user = auth.user!
    // RBAC: Check admin role
    if (!(await this.checkAdminRole(user))) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    const item = await KnowledgeBase.findOrFail(params.id)
    const data = request.only(['keyword', 'description', 'exampleSql', 'status'])

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
      (data.keyword && data.keyword !== item.keyword) ||
      (data.description && data.description !== item.description)
    ) {
      try {
        const embeddingService = new EmbeddingService()
        embedding = await embeddingService.generate(
          `${data.keyword || item.keyword}: ${data.description || item.description}`
        )
      } catch (e) {
        console.warn('[KnowledgeBasesController] Embedding generation failed on update', e)
      }
    }

    const oldStatus = item.status

    item.merge({
      keyword: data.keyword,
      description: data.description,
      exampleSql: data.exampleSql,
      status: data.status,
      embedding: embedding,
    })
    await item.save()

    const vectorStore = new VectorStoreService()

    // Handle Keyword Change: Delete old keyword if keyword changed
    if (oldKeyword !== item.keyword) {
      await vectorStore.deleteKnowledge(oldKeyword)
    }

    // Sync logic:
    // If Status is APPROVED -> Push to Qdrant
    // If Status changed FROM APPROVED TO (PENDING/REJECTED) -> Delete from Qdrant
    if (item.status === 'approved' && item.embedding && item.embedding.length > 0) {
      try {
        await vectorStore.upsertKnowledge(
          item.keyword,
          item.description,
          item.exampleSql,
          item.embedding
        )
      } catch (e) {
        console.error('Failed to sync updated knowledge to Qdrant', e)
      }
    } else if (oldStatus === 'approved' && item.status !== 'approved') {
      // Was approved, now rejected/pending -> Remove from Vector Store
      await vectorStore.deleteKnowledge(item.keyword)
    }

    return response.json(item)
  }

  public async destroy({ params, response, auth }: HttpContext) {
    const user = auth.user!
    // RBAC: Check admin role
    if (!(await this.checkAdminRole(user))) {
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

  private async checkAdminRole(user: any): Promise<boolean> {
    // Check if user has admin role
    // Since roles are loaded async, we use the method on User model or load manually
    await user.load('roles')
    const roles = user.roles as any[]
    return roles.some((r: any) => r.slug === 'admin')
  }
}
