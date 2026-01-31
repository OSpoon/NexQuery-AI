import Setting from '#models/setting'
import AiUsageLog from '#models/ai_usage_log'
import ModelCostService from '#services/model_cost_service'
import logger from '@adonisjs/core/services/logger'

export default class EmbeddingService {
  /**
   * Generate embedding for a given text
   */
  public async generate(text: string, userId?: number): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return []
    }

    // 1. Get Base URL
    const baseUrlSetting = await Setting.findBy('key', 'ai_base_url')
    let baseUrl = baseUrlSetting?.value

    if (!baseUrl) {
      throw new Error('AI Base URL not configured (ai_base_url)')
    }

    if (!baseUrl.endsWith('/')) {
      baseUrl += '/'
    }

    // 2. Get API Key
    const apiKeySetting = await Setting.findBy('key', 'ai_api_key')
    const apiKey = apiKeySetting?.value

    if (!apiKey) {
      throw new Error('AI API Key not configured (ai_api_key)')
    }

    // 3. Get Embedding Model
    const embeddingModelSetting = await Setting.findBy('key', 'ai_embedding_model')
    const modelName = embeddingModelSetting?.value

    if (!modelName) {
      throw new Error('AI Embedding Model not configured (ai_embedding_model)')
    }

    try {
      const endpoint = `${baseUrl}embeddings`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          input: text.substring(0, 4000), // Increased standard limit
        }),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any
        throw new Error(
          errorData.error?.message || `Embedding API request failed: ${response.statusText}`,
        )
      }

      const data = (await response.json()) as any
      if (data.data && data.data[0] && data.data[0].embedding) {
        // --- Log Usage ---
        const usage = data.usage
        if (usage && userId) {
          const promptTokens = usage.prompt_tokens || usage.total_tokens || 0
          const totalTokens = usage.total_tokens || promptTokens
          const estimatedCost = ModelCostService.calculateCost(modelName, {
            promptTokens,
            completionTokens: 0,
            totalTokens,
          })

          await AiUsageLog.create({
            userId,
            modelName,
            provider: 'openai',
            promptTokens,
            completionTokens: 0,
            totalTokens,
            estimatedCost,
            context: 'embedding',
          })
        }

        return data.data[0].embedding
      }

      throw new Error('Invalid response format from Embedding API')
    } catch (error) {
      logger.error({ error }, 'EmbeddingService Error')
      throw error
    }
  }
}
