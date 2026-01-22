import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'menus'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('parent_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('menus')
        .onDelete('CASCADE')
      table.string('title').notNullable()
      table.string('path').notNullable()
      table.string('icon').nullable()
      table.string('permission').nullable()
      table.integer('sort_order').defaultTo(0)
      table.boolean('is_active').defaultTo(true)

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
