import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'knowledge_bases'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('embedding').nullable().after('example_sql')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('embedding')
    })
  }
}
