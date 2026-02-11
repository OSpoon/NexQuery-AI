import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ai_messages'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Check if columns exist before adding them to avoid conflicts with manual DB changes
      table.text('generated_sql').nullable().alter()
      table.text('generated_lucene').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('generated_sql')
      table.dropColumn('generated_lucene')
    })
  }
}
