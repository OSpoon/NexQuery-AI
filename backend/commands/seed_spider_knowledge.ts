import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import fs from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import KnowledgeBase from '#models/knowledge_base'
import EmbeddingService from '#services/embedding_service'
import VectorStoreService from '#services/vector_store_service'

export default class SeedSpiderKnowledge extends BaseCommand {
  static commandName = 'seed:spider-knowledge'
  static description = 'Seed Spider training data into Knowledge Base and Vector Store for few-shot RAG'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.number({ description: 'Limit number of samples to seed', alias: 'l' })
  declare limit: number

  async run() {
    this.logger.info('Starting Spider Knowledge seeding...')

    const spiderFilePath = app.makePath('storage/eval/spider/train_spider.json')

    try {
      const content = await fs.readFile(spiderFilePath, 'utf-8')
      const samples = JSON.parse(content)

      const toSeed = this.limit ? samples.slice(0, this.limit) : samples
      this.logger.info(`Found ${samples.length} samples. Seeding ${toSeed.length}...`)

      const embeddingService = new EmbeddingService()
      const vectorStore = new VectorStoreService()

      let count = 0
      for (const sample of toSeed) {
        // We use question as keyword and query as exampleSql
        const keyword = sample.question
        const description = `Spider Dataset Sample (DB: ${sample.db_id})`
        const exampleSql = sample.query

        // 1. Save to Database
        const kbItem = await KnowledgeBase.updateOrCreate(
          { keyword },
          {
            description,
            exampleSql,
            sourceType: 'spider',
            status: 'approved',
          },
        )

        // 2. Generate Embedding
        const embedding = await embeddingService.generate(`${keyword}: ${description}`)
        kbItem.embedding = embedding
        await kbItem.save()

        // 3. Sync to Vector Store
        await vectorStore.upsertKnowledge(
          keyword,
          description,
          exampleSql,
          embedding,
          'approved',
          'spider',
        )

        count++
        if (count % 10 === 0) {
          this.logger.info(`Processed ${count}/${toSeed.length} samples...`)
        }
      }

      this.logger.success(`Successfully seeded ${count} Spider samples into Knowledge Base.`)
    } catch (error) {
      this.logger.error(`Failed to seed Spider knowledge: ${error.message}`)
    }
  }
}
