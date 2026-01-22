import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'data_sources'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('type').notNullable() // mysql, pg, etc.
      table.string('host').notNullable()
      table.integer('port').notNullable()
      table.string('username').notNullable()
      table.string('password').notNullable() // Encrypted
      table.string('database').notNullable()
      table.text('description').nullable()
      table.boolean('is_active').defaultTo(true)

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
