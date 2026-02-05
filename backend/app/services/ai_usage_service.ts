import AiUsageLog from '#models/ai_usage_log'
import ModelCostService from '#services/model_cost_service'
import logger from '@adonisjs/core/services/logger'

export default class AiUsageService {
  /**
   * Record AI Usage from any context
   */
  public static async recordUsage(params: {
    userId?: number
    conversationId?: number | null
    modelName: string
    provider: string
    promptTokens: number
    completionTokens: number
    context: string
  }) {
    if (params.promptTokens <= 0 && params.completionTokens <= 0) {
      return
    }

    try {
      const totalTokens = params.promptTokens + params.completionTokens
      const estimatedCost = ModelCostService.calculateCost(params.modelName, {
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        totalTokens,
      })

      await AiUsageLog.create({
        ...params,
        totalTokens,
        estimatedCost,
      })

      logger.info(`[AiUsageService] Recorded: ${params.modelName}, Cost: ${estimatedCost}, Tokens: ${totalTokens}, Context: ${params.context}`)
    } catch (e) {
      logger.error({ error: e }, '[AiUsageService] Failed to record AI usage log')
    }
  }

  /**
   * Extract and record usage from LangChain response/chunk
   */
  public static async recordFromLangChain(
    response: any,
    options: {
      userId?: number
      conversationId?: number | null
      context: string
      modelName?: string
      provider?: string
    },
  ) {
    if (!response)
      return

    const usage = response.usage_metadata || response.response_metadata?.tokenUsage
    if (!usage)
      return

    const actualModelName = response.response_metadata?.model_name || options.modelName || 'gpt-4o'

    await this.recordUsage({
      userId: options.userId,
      conversationId: options.conversationId,
      modelName: actualModelName,
      provider: options.provider || 'openai',
      promptTokens: usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? 0,
      completionTokens: usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens ?? 0,
      context: options.context,
    })
  }
}
