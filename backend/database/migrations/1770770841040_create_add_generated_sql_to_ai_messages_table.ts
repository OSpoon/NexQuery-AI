import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ai_messages'

  async up() {
    const hasSql = await this.schema.hasColumn(this.tableName, 'generated_sql')
    const hasLucene = await this.schema.hasColumn(this.tableName, 'generated_lucene')

    this.schema.alterTable(this.tableName, (table) => {
      if (!hasSql) {
        table.text('generated_sql').nullable()
      } else {
        table.text('generated_sql').nullable().alter()
      }

      if (!hasLucene) {
        table.text('generated_lucene').nullable()
      } else {
        table.text('generated_lucene').nullable().alter()
      }
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('generated_sql')
      table.dropColumn('generated_lucene')
    })
  }
}
