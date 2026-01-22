import Setting from '#models/setting'

export default class EmbeddingService {
  private static readonly ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/embeddings'

  /**
   * Generate embedding for a given text
   */
  public async generate(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return []
    }

    const glmKeySetting = await Setting.findBy('key', 'glm_api_key')
    const apiKey = glmKeySetting?.value?.trim()

    if (!apiKey) {
      throw new Error('GLM API Key not configured in System Settings')
    }

    const embeddingModelSetting = await Setting.findBy('key', 'ai_embedding_model')
    const modelName = embeddingModelSetting?.value || 'embedding-3'

    try {
      const response = await fetch(EmbeddingService.ZHIPU_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          input: text.substring(0, 1000),
        }),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any
        throw new Error(
          errorData.error?.message || `Embedding API request failed: ${response.statusText}`
        )
      }

      const data = (await response.json()) as any
      if (data.data && data.data[0] && data.data[0].embedding) {
        return data.data[0].embedding
      }

      throw new Error('Invalid response format from Embedding API')
    } catch (error) {
      console.error('[EmbeddingService] Error:', error)
      throw error
    }
  }
}
