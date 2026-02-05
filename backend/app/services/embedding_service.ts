import AiUsageService from '#services/ai_usage_service'
import logger from '@adonisjs/core/services/logger'
import AiProviderService from '#services/ai_provider_service'

export default class EmbeddingService {
  /**
   * Generate embedding for a given text
   */
  public async generate(text: string, userId?: number): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return []
    }

    const aiProvider = new AiProviderService()
    const config = await aiProvider.getConfig()
    const modelName = config.embeddingModel

    try {
      const embedding = await aiProvider.generateEmbedding(text)

      // --- Log Usage ---
      if (userId) {
        const tokens = Math.ceil(text.length / 4)
        await AiUsageService.recordUsage({
          userId,
          modelName,
          provider: 'openai',
          promptTokens: tokens,
          completionTokens: 0,
          context: 'embedding',
        })
      }

      return embedding
    } catch (error) {
      logger.error({ error }, 'EmbeddingService Error')
      throw error
    }
  }
}
