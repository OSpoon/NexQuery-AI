import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'knowledge_bases'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('keyword').notNullable().unique().index()
      table.text('description').notNullable()
      table.text('example_sql').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
