import Setting from '#models/setting'
import env from '#start/env'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { CallbackHandler } from 'langfuse-langchain'
import logger from '@adonisjs/core/services/logger'
import { PII_DISCOVERY_SYSTEM_PROMPT } from '#prompts/index'

export interface PiiFieldConfig {
  name: string
  masking: {
    type: string
  }
}

export interface PiiTableConfig {
  table: string
  fields: PiiFieldConfig[]
}

export default class PiiDiscoveryService {
  private async getModel() {
    // 1. Get Base URL
    const baseUrlSetting = await Setting.findBy('key', 'ai_base_url')
    const baseUrl = baseUrlSetting?.value || 'https://open.bigmodel.cn/api/paas/v4/'

    // 2. Get API Key
    const apiKeySetting = await Setting.findBy('key', 'ai_api_key')
    const apiKey = apiKeySetting?.value

    if (!apiKey)
      throw new Error('AI API Key not configured')

    const chatModelSetting = await Setting.findBy('key', 'ai_chat_model')
    const chatModel = chatModelSetting?.value

    const timeoutSetting = await Setting.findBy('key', 'ai_timeout_sec')
    const timeoutMs = (Number(timeoutSetting?.value) || 600) * 1000

    // Initialize Langfuse Callback Handler
    const langfuseHandler = new CallbackHandler({
      publicKey: env.get('LANGFUSE_PUBLIC_KEY', ''),
      secretKey: env.get('LANGFUSE_SECRET_KEY', ''),
      baseUrl: env.get('LANGFUSE_HOST', 'https://cloud.langfuse.com'),
    })

    return new ChatOpenAI({
      apiKey,
      configuration: { baseURL: baseUrl },
      modelName: chatModel,
      temperature: 0.1,
      timeout: timeoutMs,
      maxRetries: 2,
      callbacks: [langfuseHandler],
    })
  }

  /**
   * Analyze schema to discover PII fields
   */
  public async discover(schema: any[]): Promise<PiiTableConfig[]> {
    try {
      const model = await this.getModel()

      const systemPrompt = PII_DISCOVERY_SYSTEM_PROMPT

      // Prepare a condensed version of schema to save tokens
      const condensedSchema = schema.map(t => ({
        table: t.name,
        columns: t.columns.map((c: any) => ({ name: c.name, comment: c.comment })),
      }))

      // Custom retry loop with backoff for 429 Concurrency errors
      let response
      let attempts = 0
      const maxAttempts = 5

      while (attempts < maxAttempts) {
        try {
          response = await model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(`Identify PII in this schema:\n${JSON.stringify(condensedSchema)}`),
          ])
          break // Success
        } catch (err: any) {
          attempts++
          // Check for 429 or concurrency error
          if (
            (err?.status === 429 || err?.message?.includes('429') || err?.error?.code === '1302')
            && attempts < maxAttempts
          ) {
            const delay = 2 ** attempts * 2000 // 4s, 8s, 16s, 32s...
            logger.warn(`[PiiDiscovery] Rate limit hit (Attempt ${attempts}/${maxAttempts}). Retrying in ${delay}ms...`)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
          throw err // Re-throw other errors immediately
        }
      }

      if (!response) {
        throw new Error('PII Discovery failed after max retries')
      }

      let content = response.content as string
      // Clean up markdown block if present
      content = content.replace(/```json/g, '').replace(/```/g, '').trim()

      const discovered = JSON.parse(content) as PiiTableConfig[]

      logger.info({ dataSourceId: (schema as any).dataSourceId, tablesFound: discovered.length }, 'PII Discovery completed successfully')
      return discovered
    } catch (e) {
      logger.error({ error: e, stack: e.stack }, 'PII Discovery failed')
      return []
    }
  }
}
