import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class SchemaSync extends BaseCommand {
  static commandName = 'schema:sync'
  static description = 'Sync database schema to vector store for RAG'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Data Source ID' })
  declare dataSourceId: string

  async run() {
    const { default: SchemaSyncService } = await import('#services/schema_sync_service')
    const service = new SchemaSyncService()

    this.logger.info(`Starting schema sync for Data Source ID: ${this.dataSourceId}`)
    try {
      await service.syncDataSource(Number(this.dataSourceId))
      this.logger.success('Schema sync completed successfully!')
    } catch (error) {
      this.logger.error(`Schema sync failed: ${error.message}`)
      this.exitCode = 1
    }
  }
}
