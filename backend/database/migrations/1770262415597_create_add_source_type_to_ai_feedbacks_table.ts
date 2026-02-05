import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ai_feedbacks'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('source_type').defaultTo('sql').notNullable().index()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('source_type')
    })
  }
}
