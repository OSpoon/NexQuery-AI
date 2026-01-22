import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'query_tasks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.text('description').nullable()
      table.text('sql_template').notNullable()
      table.json('form_schema').nullable()
      table
        .integer('data_source_id')
        .unsigned()
        .references('id')
        .inTable('data_sources')
        .onDelete('CASCADE')
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
