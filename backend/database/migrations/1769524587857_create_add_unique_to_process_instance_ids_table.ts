import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'query_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // First drop the old index if it exists (it was created as index in previous migration)
      table.dropIndex(['process_instance_id'])
      // Add unique constraint
      table.unique(['process_instance_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
