import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'scheduled_queries'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('cron_expression').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('cron_expression').notNullable().alter()
    })
  }
}
