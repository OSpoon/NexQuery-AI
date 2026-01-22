import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ai_feedbacks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.text('question').notNullable()
      table.text('generated_sql').notNullable()
      table.boolean('is_helpful').notNullable()
      table.text('user_correction').nullable()

      table.timestamp('created_at').defaultTo(this.now())
      table.timestamp('updated_at').defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
