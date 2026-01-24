import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'query_tasks'

  public async up() {
    if (!(await this.schema.hasColumn(this.tableName, 'tags'))) {
      this.schema.alterTable(this.tableName, (table) => {
        table.jsonb('tags').nullable()
      })
    } else {
      console.warn('Column "tags" already exists in "query_tasks", skipping addition.')
    }
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('tags')
    })
  }
}
