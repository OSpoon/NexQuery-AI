import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'query_tasks'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('store_results').defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('store_results')
    })
  }
}
