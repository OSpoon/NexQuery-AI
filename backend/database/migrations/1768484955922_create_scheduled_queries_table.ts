import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'scheduled_queries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('query_task_id')
        .unsigned()
        .references('id')
        .inTable('query_tasks')
        .onDelete('CASCADE')
      table.string('cron_expression').notNullable()
      table.text('recipients').notNullable().comment('JSON array of email addresses')
      table.boolean('is_active').defaultTo(true)
      table.integer('created_by').unsigned().references('id').inTable('users')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
