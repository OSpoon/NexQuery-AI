import Setting from '#models/setting'

import env from '#start/env'
import { ChatOpenAI } from '@langchain/openai'
import { CallbackHandler } from 'langfuse-langchain'

export interface AiConfig {
  baseUrl: string
  apiKey: string
  chatModel: string
  embeddingModel: string
  timeoutMs: number
}

export default class AiProviderService {
  private static readonly DEFAULT_API_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/'

  /**
   * Fetch all AI related settings from database
   */
  public async getConfig(): Promise<AiConfig> {
    const [baseUrlSetting, apiKeySetting, chatModelSetting, embeddingModelSetting, timeoutSetting] = await Promise.all([
      Setting.findBy('key', 'ai_base_url'),
      Setting.findBy('key', 'ai_api_key'),
      Setting.findBy('key', 'ai_chat_model'),
      Setting.findBy('key', 'ai_embedding_model'),
      Setting.findBy('key', 'ai_timeout_sec'),
    ])

    const baseUrl = baseUrlSetting?.value || AiProviderService.DEFAULT_API_BASE_URL
    const apiKey = apiKeySetting?.value
    const chatModel = chatModelSetting?.value || 'glm-4.5-flash'
    const embeddingModel = embeddingModelSetting?.value || 'embedding-3'
    const timeoutMs = (Number(timeoutSetting?.value) || 600) * 1000

    if (!apiKey) {
      throw new Error('AI API Key not configured (ai_api_key)')
    }

    return {
      baseUrl,
      apiKey,
      chatModel,
      embeddingModel,
      timeoutMs,
    }
  }

  /**
   * Check if a specific AI skill is enabled in database settings
   */
  public async isSkillEnabled(skillKey: string): Promise<boolean> {
    const setting = await Setting.findBy('key', `ai_skill_${skillKey}`)
    return setting?.value !== 'false'
  }

  /**
   * Get Langfuse Callback Handler
   */
  public getLangfuseHandler() {
    return new CallbackHandler({
      publicKey: env.get('LANGFUSE_PUBLIC_KEY', ''),
      secretKey: env.get('LANGFUSE_SECRET_KEY', ''),
      baseUrl: env.get('LANGFUSE_HOST', 'https://cloud.langfuse.com'),
    })
  }

  /**
   * Get a ChatOpenAI model instance
   */
  public async getChatModel(options: { streaming?: boolean, temperature?: number } = {}) {
    const config = await this.getConfig()

    // Ensure API Key is in env for some tool integrations if needed
    process.env.OPENAI_API_KEY = config.apiKey

    return new ChatOpenAI({
      apiKey: config.apiKey,
      configuration: { baseURL: config.baseUrl },
      modelName: config.chatModel,
      temperature: options.temperature ?? 0.1,
      timeout: config.timeoutMs,
      streaming: options.streaming ?? false,
      streamUsage: true,
      callbacks: [this.getLangfuseHandler()],
    })
  }

  /**
   * Generate embedding via direct API call (Standard format)
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    const config = await this.getConfig()

    let baseUrl = config.baseUrl
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/'
    }

    const endpoint = `${baseUrl}embeddings`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.embeddingModel,
        input: text.substring(0, 4000),
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
      return data.data[0].embedding
    }

    throw new Error('Invalid response format from Embedding API')
  }
}
