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
      {
        key: 'ai_transcription_base_url',
        value: 'https://open.bigmodel.cn/api/paas/v4/',
        type: 'string',
        group: 'ai',
        label: 'Transcription Base URL',
        description: 'Base URL for Transcription (e.g., Zhipu AI).',
      },
      {
        key: 'ai_transcription_api_key',
        value: defaultKey,
        type: 'string',
        group: 'ai',
        label: 'Transcription API Key',
        description: 'API Key for Transcription. Leave empty to use main AI API Key.',
      },
      {
        key: 'ai_transcription_model',
        value: 'glm-asr-2512',
        type: 'string',
        group: 'ai',
        label: 'Transcription Model',
        description: 'Model name for transcription (e.g., glm-asr-2512).',
      },
    ]

    for (const s of newSettings) {
      await Setting.updateOrCreate({ key: s.key }, s)
      logger.info(`Updated/Created setting: ${s.key}`)
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
