import Setting from '#models/setting'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { ChatOpenAI } from '@langchain/openai'
import { CallbackHandler } from 'langfuse-langchain'

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
    const apiKey = rawApiKey && rawApiKey !== 'null' ? rawApiKey : ''

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
        ? rawEmbeddingApiKey || apiKey
        : apiKey

    // Transcription Config
    const transcriptionBaseUrl = transcriptionBaseUrlSetting?.value?.trim()
    const rawTranscriptionApiKey = transcriptionApiKeySetting?.value
    const transcriptionApiKey
      = rawTranscriptionApiKey && rawTranscriptionApiKey !== 'null'
        ? rawTranscriptionApiKey || apiKey
        : apiKey
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

    // Resolve transcription config with fallback
    let baseUrl = (config.transcriptionBaseUrl || config.baseUrl).trim()
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/'
    }

    const apiKey = config.transcriptionApiKey || config.apiKey
    const model = config.transcriptionModel || 'whisper-1'

    // OpenAI and many providers (including Zhipu AI's compatible layer)
    // usually want /v1/audio/transcriptions.
    // NOTE: Zhipu AI v4 ASR endpoint is exactly /api/paas/v4/audio/transcriptions (no /v1/ injection)
    const endpoint = `${baseUrl}audio/transcriptions`

    const formData = new FormData()

    const { exec } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const { unlink } = await import('node:fs')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')
    const execPromise = promisify(exec)

    // Dynamically resolve MIME type based on extension
    const ext = file.clientName.split('.').pop()?.toLowerCase() || ''
    const mimeMap: Record<string, string> = {
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      webm: 'audio/webm',
      ogg: 'audio/ogg',
    }
    let contentType = mimeMap[ext] || 'application/octet-stream'

    let finalPath = file.path
    let finalName = file.clientName
    let isConverted = false

    // Zhipu AI (and possibly others) only support wav/mp3 consistently
    if (ext !== 'wav' && ext !== 'mp3') {
      const tempWavPath = join(tmpdir(), `converted_${Date.now()}.wav`)
      try {
        const inputSize = readFileSync(file.path).length
        logger.info(`[AiProviderService.transcribe] Converting ${file.path} (${inputSize} bytes) to ${tempWavPath}`)

        // Use 16kHz, mono, and stronger volume + highpass to cut low-end noise
        const { stderr } = await execPromise(
          `ffmpeg -i "${file.path}" -ar 16000 -ac 1 -af "highpass=f=200,volume=2.5" -c:a pcm_s16le "${tempWavPath}" -y`,
        )
        if (stderr && stderr.includes('error')) {
          logger.warn(`[AiProviderService.transcribe] ffmpeg error: ${stderr}`)
        }

        const outputSize = readFileSync(tempWavPath).length
        logger.info(`[AiProviderService.transcribe] Created ${tempWavPath} (${outputSize} bytes)`)

        finalPath = tempWavPath
        finalName = 'recording.wav'
        contentType = 'audio/wav'
        isConverted = true
      } catch (err: any) {
        logger.error(`[AiProviderService.transcribe] Conversion failed: ${err.message}`)
      }
    }

    // Read file and wrap in Blob (Use Global Blob in Node 22+ for better fetch compatibility)
    const buffer = readFileSync(finalPath)
    const blob = new globalThis.Blob([buffer], { type: contentType })

    // Provide filename as 3rd argument (Standard FormData API)
    formData.append('file', blob, finalName)
    formData.append('model', model)
    formData.append('stream', 'false')

    try {
      logger.info(
        `[AiProviderService.transcribe] POST ${endpoint} (Model: ${model}, Format: ${contentType}, Converted: ${isConverted})`,
      )
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error body')
        logger.error(`[AiProviderService.transcribe] Provider Error (${response.status}): ${errorText}`)
        throw new Error(
          `Transcription API request failed: ${response.status} ${response.statusText} - ${errorText}`,
        )
      }

      const contentTypeHeader = response.headers.get('content-type') || ''
      if (!contentTypeHeader.includes('application/json')) {
        const text = await response.text()
        logger.error(
          `[AiProviderService.transcribe] Unexpected content type: ${contentTypeHeader}, Body: ${text}`,
        )
        throw new Error(`Unexpected response format from AI Provider: ${contentTypeHeader}`)
      }

      const data = (await response.json()) as any
      return data.text || ''
    } catch (error: any) {
      logger.error(`[AiProviderService.transcribe] Fatal Exception: ${error.message}`)
      throw error
    } finally {
      // Clean up converted file if created
      if (isConverted) {
        unlink(finalPath, (err) => {
          if (err)
            logger.warn(`[AiProviderService.transcribe] Cleanup failed for ${finalPath}: ${err.message}`)
        })
      }
    }
  }
}
