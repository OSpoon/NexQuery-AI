import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'scheduled_queries'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('parameters').nullable().after('webhook_url')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('parameters')
    })
  }
}
