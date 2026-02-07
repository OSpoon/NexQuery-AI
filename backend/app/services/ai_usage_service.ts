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

      // 4. Budget Alert Check (FinOps)
      await this.checkBudgetAlert()
    } catch (e) {
      logger.error({ error: e }, '[AiUsageService] Failed to record AI usage log')
    }
  }

  /**
   * Check if daily budget threshold is reached and notify admins
   */
  private static async checkBudgetAlert() {
    try {
      const { DateTime } = await import('luxon')
      const today = DateTime.now().startOf('day').toSQL()

      const stats = await AiUsageLog.query()
        .where('createdAt', '>=', today!)
        .sum('estimatedCost as totalCost')
        .first()

      const dailyCost = Number.parseFloat(stats?.$extras.totalCost || '0')

      // Get threshold from Settings (fallback to 10 USD)
      const Setting = (await import('#models/setting')).default
      const thresholdSetting = await Setting.findBy('key', 'ai_daily_budget_alert_threshold')
      const threshold = thresholdSetting ? Number.parseFloat(thresholdSetting.value) : 10.0

      if (dailyCost >= threshold) {
        // Send alert to all admins
        const User = (await import('#models/user')).default
        const NotificationService = (await import('#services/notification_service')).default

        const admins = await User.query().whereHas('roles', (query) => {
          query.where('slug', 'admin')
        })

        for (const admin of admins) {
          // Check if we already sent a budget alert today to this user
          const luxonDate = DateTime.now().startOf('day').toJSDate()
          const existingAlert = await (await import('#models/notification')).default.query().where('userId', admin.id).where('title', 'AI 消耗预算预警').where('createdAt', '>=', luxonDate).first()

          if (!existingAlert) {
            await NotificationService.push(
              admin.id,
              'AI 消耗预算预警',
              `当日已累计消耗 AI 费用: $${dailyCost.toFixed(4)}，已达到或超过预警阈值 $${threshold.toFixed(2)}。`,
              'warning',
            )
          }
        }
      }
    } catch (e) {
      logger.error({ error: e }, '[AiUsageService] Budget alert check failed')
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
