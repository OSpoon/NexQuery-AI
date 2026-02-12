import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import KnowledgeBase from '#models/knowledge_base'
import EmbeddingService from '#services/embedding_service'

export default class ReindexKnowledgeBase extends BaseCommand {
  static commandName = 'knowledge:reindex'
  static description = 'Generate embeddings for knowledge base items'

  @flags.boolean({ description: 'Force re-index all items even if they already have embeddings' })
  declare force: boolean

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const mode = this.force ? 'Full Overwrite' : 'Incremental'
    this.logger.info(`Starting Knowledge Base re-indexing (${mode} mode)...`)

    const query = KnowledgeBase.query()
    if (!this.force) {
      query.whereNull('embedding')
    }

    const items = await query

    if (items.length === 0) {
      this.logger.success('No items found that require indexing.')
      return
    }

    this.logger.info(`Found ${items.length} items to process.`)

    const embeddingService = new EmbeddingService()
    let count = 0

    for (const item of items) {
      try {
        const text = `${item.keyword}: ${item.description}`
        this.logger.info(`[${count + 1}/${items.length}] Generating embedding for: ${item.keyword}`)

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
