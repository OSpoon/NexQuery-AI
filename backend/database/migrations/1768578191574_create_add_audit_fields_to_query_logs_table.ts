import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'query_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('ip_address', 45).nullable()
      table.text('user_agent').nullable()
      table.json('device_info').nullable()
      table.boolean('is_internal_ip').defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('ip_address')
      table.dropColumn('user_agent')
      table.dropColumn('device_info')
      table.dropColumn('is_internal_ip')
    })
  }
}
