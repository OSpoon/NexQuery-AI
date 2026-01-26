import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ai_messages'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('prompt').nullable().after('content')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('prompt')
    })
  }
}
