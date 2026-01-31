import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ai_usage_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('conversation_id').unsigned().references('id').inTable('ai_conversations').onDelete('SET NULL').nullable()
      table.string('model_name').notNullable()
      table.string('provider').notNullable()
      table.integer('prompt_tokens').defaultTo(0)
      table.integer('completion_tokens').defaultTo(0)
      table.integer('total_tokens').defaultTo(0)
      table.decimal('estimated_cost', 10, 6).defaultTo(0)
      table.string('context').notNullable() // e.g., 'chat', 'sql_optimization', etc.

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
