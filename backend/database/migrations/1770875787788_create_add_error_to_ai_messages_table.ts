import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'add_error_to_ai_messages'

  async up() {
    this.schema.alterTable('ai_messages', (table) => {
      table.text('error').nullable()
    })
  }

  async down() {
    this.schema.alterTable('ai_messages', (table) => {
      table.dropColumn('error')
    })
  }
}
