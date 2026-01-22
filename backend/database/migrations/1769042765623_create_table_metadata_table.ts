import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'table_metadata'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('data_source_id').unsigned().notNullable().index()
      table.string('table_name').notNullable()
      table.text('description').nullable()
      // Use JSON/text storage for embeddings, depending on DB support.
      // For broad compatibility in this project (MySQL/PG), we use JSON.
      table.json('embedding').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['data_source_id', 'table_name'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
