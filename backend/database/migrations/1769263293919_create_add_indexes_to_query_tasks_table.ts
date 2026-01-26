import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'query_tasks'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Index for sorting by createdAt
      table.index(['created_at'], 'query_tasks_created_at_index')
    })

    // Index for JSONB tags (PostgreSQL only)
    this.defer(async (db) => {
      await db.rawQuery(
        'CREATE INDEX IF NOT EXISTS query_tasks_tags_gin_index ON query_tasks USING GIN (tags)',
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery('DROP INDEX IF EXISTS query_tasks_tags_gin_index')
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['created_at'], 'query_tasks_created_at_index')
    })
  }
}
