import Setting from '#models/setting'
import env from '#start/env'
import { ChatOpenAI } from '@langchain/openai'
import { CallbackHandler } from 'langfuse-langchain'
import { CryptoHelper } from '#services/crypto_helper'

export interface AiConfig {
  baseUrl: string
  apiKey: string
  chatModel: string
  embeddingModel: string
  timeoutMs: number
  embeddingBaseUrl: string
  embeddingApiKey: string
  transcriptionBaseUrl?: string
  transcriptionApiKey?: string
  transcriptionModel?: string
}

export default class AiProviderService {
  /**
   * Fetch all AI related settings from database
   */
  public async getConfig(): Promise<AiConfig> {
    const [
      baseUrlSetting,
      apiKeySetting,
      chatModelSetting,
      embeddingModelSetting,
      timeoutSetting,
      embeddingBaseUrlSetting,
      embeddingApiKeySetting,
      transcriptionBaseUrlSetting,
      transcriptionApiKeySetting,
      transcriptionModelSetting,
    ] = await Promise.all([
      Setting.findBy('key', 'ai_base_url'),
      Setting.findBy('key', 'ai_api_key'),
      Setting.findBy('key', 'ai_chat_model'),
      Setting.findBy('key', 'ai_embedding_model'),
      Setting.findBy('key', 'ai_timeout_sec'),
      Setting.findBy('key', 'ai_embedding_base_url'),
      Setting.findBy('key', 'ai_embedding_api_key'),
      Setting.findBy('key', 'ai_transcription_base_url'),
      Setting.findBy('key', 'ai_transcription_api_key'),
      Setting.findBy('key', 'ai_transcription_model'),
    ])

    const baseUrl = (baseUrlSetting?.value || '').trim()
    const rawApiKey = apiKeySetting?.value
    const apiKey = rawApiKey && rawApiKey !== 'null' ? CryptoHelper.tryDecrypt(rawApiKey) || '' : ''

    const chatModel = chatModelSetting?.value || 'glm-4.5-flash'
    const embeddingModel = embeddingModelSetting?.value || 'embedding-3'
    const timeoutMs = (Number(timeoutSetting?.value) || 600) * 1000

    if (!apiKey || apiKey === 'null') {
      throw new Error('AI API Key not configured (ai_api_key)')
    }

    // Hybrid Config
    const embeddingBaseUrl = (embeddingBaseUrlSetting?.value || baseUrl).trim()
    const rawEmbeddingApiKey = embeddingApiKeySetting?.value
    const embeddingApiKey
      = rawEmbeddingApiKey && rawEmbeddingApiKey !== 'null'
        ? CryptoHelper.tryDecrypt(rawEmbeddingApiKey) || apiKey
        : apiKey

    // Transcription Config
    const transcriptionBaseUrl = transcriptionBaseUrlSetting?.value?.trim()
    const rawTranscriptionApiKey = transcriptionApiKeySetting?.value
    const transcriptionApiKey
      = rawTranscriptionApiKey && rawTranscriptionApiKey !== 'null'
        ? CryptoHelper.tryDecrypt(rawTranscriptionApiKey) ?? undefined
        : undefined
    const transcriptionModel = transcriptionModelSetting?.value

    return {
      baseUrl,
      apiKey,
      chatModel,
      embeddingModel,
      timeoutMs,
      embeddingBaseUrl,
      embeddingApiKey,
      transcriptionBaseUrl,
      transcriptionApiKey,
      transcriptionModel,
    }
  }

  /**
   * Get Langfuse Callback Handler for tracing
   */
  public getLangfuseHandler(
    options: {
      tags?: string[]
      metadata?: Record<string, any>
      sessionId?: string
      userId?: string
    } = {},
  ) {
    if (env.get('LANGFUSE_PUBLIC_KEY')) {
      return new CallbackHandler(options)
    }
    return null
  }

  /**
   * Get a ChatOpenAI instance for LangChain
   */
  public async getChatModel(
    options: {
      stream?: boolean
      tags?: string[]
      metadata?: Record<string, any>
      temperature?: number
      [key: string]: any
    } = {},
  ) {
    const config = await this.getConfig()

    const callbacks = []
    const langfuseHandler = this.getLangfuseHandler({
      tags: options.tags,
      metadata: options.metadata,
    })

    if (langfuseHandler) {
      callbacks.push(langfuseHandler)
    }

    return new ChatOpenAI({
      apiKey: config.apiKey,
      configuration: {
        baseURL: config.baseUrl,
      },
      modelName: config.chatModel,
      streaming: options.stream ?? true,
      temperature: options.temperature ?? 0.7,
      timeout: config.timeoutMs,
      callbacks,
      ...options, // Pass through any other LangChain options
    })
  }

  /**
   * Generate embedding for text
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    const config = await this.getConfig()

    // Use specific embedding config or fallback to main
    const endpoint = `${config.embeddingBaseUrl}embeddings`
    const apiKey = config.embeddingApiKey

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.embeddingModel,
        input: text,
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

  /**
   * Transcribe audio to text (Whisper compatible)
   */
  public async transcribe(file: { path: string, clientName: string }): Promise<string> {
    const config = await this.getConfig()
    const { readFileSync } = await import('node:fs')
    const { Blob } = await import('node:buffer')

    // Resolve transcription config with fallback
    let baseUrl = (config.transcriptionBaseUrl || config.baseUrl).trim()
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/'
    }

    const apiKey = config.transcriptionApiKey || config.apiKey
    const model = config.transcriptionModel || 'whisper-1'

    // OpenAI and many providers (including Zhipu AI's compatible layer)
    // usually want /v1/audio/transcriptions.
    let endpoint = `${baseUrl}audio/transcriptions`
    if (baseUrl.includes('/v4/') && !baseUrl.includes('/v1/')) {
      endpoint = `${baseUrl.replace('/v4/', '/v4/v1/')}audio/transcriptions`
    }

    // Use standard Web API FormData (Available globally in Node 22)
    const formData = new FormData()

    // Read file and wrap in Blob (More compatible than File in some Node environments)
    const buffer = readFileSync(file.path)
    const blob = new Blob([buffer], { type: 'audio/webm' })

    // Provide filename as 3rd argument (Standard FormData API)
    formData.append('file', blob, file.clientName)
    formData.append('model', model)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error body')
        throw new Error(
          `Transcription API request failed: ${response.status} ${response.statusText} - ${errorText}`,
        )
      }

      const data = (await response.json()) as any
      return data.text || ''
    } catch (error: any) {
      console.error(`[AiProviderService.transcribe] Failed to call ${endpoint}:`, error.message)
      throw error
    }
  }
}
