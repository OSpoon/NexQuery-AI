import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import KnowledgeBase from '#models/knowledge_base'
import EmbeddingService from '#services/embedding_service'

export default class ReindexKnowledgeBase extends BaseCommand {
  static commandName = 'knowledge:reindex'
  static description = 'Generate missing embeddings for all knowledge base items'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Starting Knowledge Base re-indexing...')

    const items = await KnowledgeBase.query().whereNull('embedding')

    if (items.length === 0) {
      this.logger.success('All items already have embeddings.')
      return
    }

    this.logger.info(`Found ${items.length} items without embeddings.`)

    const embeddingService = new EmbeddingService()
    let count = 0

    for (const item of items) {
      try {
        const text = `${item.keyword}: ${item.description}`
        this.logger.info(`Generating embedding for: ${item.keyword}`)

        const embedding = await embeddingService.generate(text)
        item.embedding = embedding
        await item.save()

        count++
      } catch (error) {
        this.logger.error(`Failed to re-index ${item.keyword}: ${error.message}`)
      }
    }

    this.logger.success(`Successfully re-indexed ${count} items.`)
  }
}
