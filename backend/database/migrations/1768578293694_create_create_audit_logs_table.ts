import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audit_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('action').notNullable()
      table.string('entity_type').nullable()
      table.string('entity_id').nullable()
      table.json('details').nullable()
      table.string('ip_address', 45).nullable()
      table.text('user_agent').nullable()
      table.boolean('is_internal_ip').defaultTo(false)
      table.string('status').defaultTo('success')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
