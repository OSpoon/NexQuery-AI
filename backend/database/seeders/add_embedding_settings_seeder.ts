import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Setting from '#models/setting'
import logger from '@adonisjs/core/services/logger'

export default class extends BaseSeeder {
  async run() {
    logger.info('Adding Hybrid Embedding Settings...')

    // Try to find existing API key to reuse as default fallback
    const oldApiKey = await Setting.findBy('key', 'ai_api_key')
    const defaultKey = oldApiKey ? oldApiKey.value : ''

    const newSettings = [
      {
        key: 'ai_embedding_base_url',
        value: 'https://open.bigmodel.cn/api/paas/v4/',
        type: 'string',
        group: 'ai',
        label: 'Embedding Base URL',
        description: 'Base URL for the Embedding Provider (e.g., Zhipu AI).',
      },
      {
        key: 'ai_embedding_api_key',
        value: defaultKey,
        type: 'string',
        group: 'ai',
        label: 'Embedding API Key',
        description: 'API Key for the Embedding Provider. Leave empty to use main AI API Key.',
      },
    ]

    for (const s of newSettings) {
      const existing = await Setting.findBy('key', s.key)
      if (!existing) {
        await Setting.create(s)
        logger.info(`Created setting: ${s.key}`)
      } else {
        logger.info(`Setting ${s.key} already exists. Skipping.`)
      }
    }

    // Ensure embedding model is set to Zhipu's default
    const embeddingModel = await Setting.findBy('key', 'ai_embedding_model')
    if (embeddingModel) {
      embeddingModel.value = 'embedding-3'
      await embeddingModel.save()
      logger.info('Reset ai_embedding_model to "embedding-3" (Zhipu)')
    }

    logger.info('Hybrid Settings added. Please check "ai_embedding_api_key".')
  }
}
