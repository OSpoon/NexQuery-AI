import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'scheduled_queries'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('run_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('run_at')
    })
  }
}
