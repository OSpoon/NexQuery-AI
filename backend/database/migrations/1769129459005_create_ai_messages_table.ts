import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ai_messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('conversation_id')
        .unsigned()
        .references('ai_conversations.id')
        .onDelete('CASCADE')
        .notNullable()
      table.enum('role', ['user', 'assistant']).notNullable()
      table.text('content').notNullable()
      table.json('agent_steps').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
