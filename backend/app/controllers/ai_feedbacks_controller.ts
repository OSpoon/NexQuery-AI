import type { HttpContext } from '@adonisjs/core/http'
import AiFeedback from '#models/ai_feedback'
import LangChainService from '#services/lang_chain_service'

export default class AiFeedbacksController {
  /**
   * Store feedback
   */
  async store({ request, response }: HttpContext) {
    const data = request.only(['question', 'generatedSql', 'isHelpful', 'userCorrection'])

    const feedback = await AiFeedback.create({
      question: data.question,
      generatedSql: data.generatedSql,
      isHelpful: data.isHelpful,
      userCorrection: data.userCorrection || null,
    })

    if (data.userCorrection) {
      try {
        const langChainService = new LangChainService()
        // Fire and forget learning
        langChainService.learnInteraction(data.question, data.userCorrection)
      } catch (error) {
        // Log error but don't fail the request
        console.error('Failed to trigger learning from feedback:', error)
      }
    }

    return response.created(feedback)
  }

  /**
   * List all feedbacks (Paginated)
   */
  async index({ request }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 10)

    const feedbacks = await AiFeedback.query().orderBy('created_at', 'desc').paginate(page, limit)

    return feedbacks
  }

  /**
   * Delete feedback
   */
  async destroy({ params, response }: HttpContext) {
    const feedback = await AiFeedback.findOrFail(params.id)
    await feedback.delete()

    return response.noContent()
  }
}
