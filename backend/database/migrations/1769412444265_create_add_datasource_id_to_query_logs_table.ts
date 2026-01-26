import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'query_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('data_source_id')
        .unsigned()
        .references('id')
        .inTable('data_sources')
        .onDelete('CASCADE')
        .nullable()
        .index()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('data_source_id')
    })
  }
}
