import type { HttpContext } from '@adonisjs/core/http'
import AiFeedback from '#models/ai_feedback'

export default class AiFeedbacksController {
  /**
   * Store feedback
   */
  async store({ request, response }: HttpContext) {
    const data = request.only([
      'question',
      'generatedSql',
      'isHelpful',
      'userCorrection',
      'conversationId',
    ])

    const feedback = await AiFeedback.create({
      conversationId: data.conversationId || null,
      question: data.question,
      generatedSql: data.generatedSql,
      isHelpful: data.isHelpful,
      userCorrection: data.userCorrection || null,
    })

    // Learning is now handled manually via Promotion to Knowledge Base (Pending Review)
    /*
    if (data.userCorrection) {
      try {
        const langChainService = new LangChainService()
        langChainService.learnInteraction(data.question, data.userCorrection)
      } catch (error) {
        console.error('Failed to trigger learning from feedback:', error)
      }
    }
    */

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
