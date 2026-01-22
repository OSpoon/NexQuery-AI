import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'query_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table
        .integer('task_id')
        .unsigned()
        .references('id')
        .inTable('query_tasks')
        .onDelete('SET NULL')
      table.text('executed_sql').notNullable()
      table.integer('execution_time_ms').nullable()
      table.string('status').notNullable() // 'success', 'failed'
      table.text('error_message').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
