import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notifications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE').nullable()
      table.string('type', 50).notNullable().defaultTo('info') // info, success, warning, error
      table.string('title', 255).notNullable()
      table.text('content').notNullable()
      table.boolean('is_read').defaultTo(false)
      table.json('meta_data').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['user_id', 'is_read'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
