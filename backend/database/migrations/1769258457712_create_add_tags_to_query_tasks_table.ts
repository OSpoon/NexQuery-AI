import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'query_tasks'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('tags').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('tags')
    })
  }
}