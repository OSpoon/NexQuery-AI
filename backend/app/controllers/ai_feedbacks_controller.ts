import type { HttpContext } from '@adonisjs/core/http'
import AiFeedback from '#models/ai_feedback'
import LangChainService from '#services/lang_chain_service'

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
      isAdopted: data.isHelpful === true, // Auto-adopt if helpful
    })

    // If auto-adopted, promote to knowledge base immediately
    if (feedback.isAdopted) {
      try {
        const langChainService = new LangChainService()
        await langChainService.learnInteraction(feedback.question, feedback.generatedSql)
      } catch (error) {
        console.error('Failed to auto-learn from helpful feedback:', error)
      }
    }

    return response.created(feedback)
  }

  /**
   * List all feedbacks (Paginated)
   */
  async index({ request, auth, response }: HttpContext) {
    if (!auth.user!.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    const page = request.input('page', 1)
    const limit = request.input('limit', 10)
    const showAdopted = request.input('showAdopted')

    const query = AiFeedback.query().orderBy('created_at', 'desc')

    if (showAdopted !== undefined) {
      query.where('is_adopted', showAdopted === 'true' || showAdopted === true)
    }

    const feedbacks = await query.paginate(page, limit)

    return feedbacks
  }

  /**
   * Mark feedback as adopted
   */
  async adopt({ params, response, auth }: HttpContext) {
    if (!auth.user!.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    const feedback = await AiFeedback.findOrFail(params.id)
    feedback.isAdopted = true
    await feedback.save()

    // Promote to knowledge base
    try {
      const langChainService = new LangChainService()
      await langChainService.learnInteraction(
        feedback.question,
        feedback.userCorrection || feedback.generatedSql,
        feedback.userCorrection ? `User correction for: ${feedback.question}` : undefined,
      )
    } catch (error) {
      console.error('Failed to learn from adopted feedback:', error)
    }

    return response.ok(feedback)
  }

  /**
   * Delete feedback
   */
  async destroy({ params, response, auth }: HttpContext) {
    if (!auth.user!.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }
    const feedback = await AiFeedback.findOrFail(params.id)
    await feedback.delete()

    return response.noContent()
  }
}
