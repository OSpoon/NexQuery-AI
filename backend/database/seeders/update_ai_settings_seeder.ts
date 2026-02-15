import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Setting from '#models/setting'
import logger from '@adonisjs/core/services/logger'

export default class extends BaseSeeder {
  async run() {
    logger.info('Migrating AI Settings to DeepSeek...')

    const settings = [
      { key: 'ai_base_url', value: 'https://api.deepseek.com' },
      { key: 'ai_chat_model', value: 'deepseek-chat' },
      { key: 'ai_embedding_model', value: 'deepseek-chat' }, // Placeholder, as DeepSeek might separate embeddings or use same model
    ]

    for (const s of settings) {
      const setting = await Setting.findBy('key', s.key)
      if (setting) {
        setting.value = s.value
        await setting.save()
        logger.info(`Updated ${s.key} to ${s.value}`)
      } else {
        logger.warn(`Setting ${s.key} not found. Skipping.`)
      }
    }

    logger.info('Migration complete. Please manually update "ai_api_key".')
  }
}
