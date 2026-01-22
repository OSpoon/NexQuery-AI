import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'knowledge_bases'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum('status', ['pending', 'approved', 'rejected'])
        .defaultTo('pending')
        .notNullable()
        .after('embedding')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('status')
    })
  }
}
