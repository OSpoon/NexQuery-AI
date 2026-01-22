import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import DataSource from '#models/data_source'
import User from '#models/user'

export default class QueryTask extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare sqlTemplate: string

  @column({
    columnName: 'form_schema',
    prepare: (value: any) => (value ? JSON.stringify(value) : value),
  })
  declare formSchema: any | null

  @column({
    columnName: 'store_results',
    prepare: (value: boolean) => (value ? 1 : 0),
    consume: (value: number) => Boolean(value),
  })
  declare storeResults: boolean

  @column({ columnName: 'data_source_id' })
  declare dataSourceId: number

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @belongsTo(() => DataSource)
  declare dataSource: BelongsTo<typeof DataSource>

  @belongsTo(() => User, {
    foreignKey: 'createdBy',
  })
  declare creator: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
