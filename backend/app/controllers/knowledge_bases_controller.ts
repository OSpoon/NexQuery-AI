import type { HttpContext } from '@adonisjs/core/http'
import KnowledgeBase from '#models/knowledge_base'
import KnowledgeBaseService from '#services/knowledge_base_service'

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

    const item = await KnowledgeBaseService.upsert({
      keyword: data.keyword,
      description: data.description,
      exampleSql: data.exampleSql,
      sourceType: data.sourceType,
      userId: auth.user!.id,
    })

    return response.created(item)
  }

  public async update({ params, request, response, auth }: HttpContext) {
    if (!auth.user!.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    const itemOriginal = await KnowledgeBase.findOrFail(params.id)
    const data = request.only(['keyword', 'description', 'exampleSql', 'status', 'sourceType'])

    const item = await KnowledgeBaseService.upsert({
      id: Number(params.id),
      keyword: data.keyword || itemOriginal.keyword,
      description: data.description || itemOriginal.description,
      exampleSql: data.exampleSql,
      status: data.status,
      sourceType: data.sourceType,
      userId: auth.user!.id,
    })

    return response.json(item)
  }

  public async destroy({ params, response, auth }: HttpContext) {
    if (!auth.user!.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    await KnowledgeBaseService.delete(params.id)

    return response.json({ message: 'Deleted successfully' })
  }
}
