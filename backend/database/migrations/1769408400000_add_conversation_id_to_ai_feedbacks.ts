import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ai_feedbacks'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('conversation_id')
        .unsigned()
        .references('ai_conversations.id')
        .onDelete('SET NULL')
        .nullable()
        .after('id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('conversation_id')
    })
  }
}
