import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class KnowledgeBase extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare keyword: string

  @column()
  declare description: string

  @column()
  declare exampleSql: string | null

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
    serializeAs: null,
  })
  declare embedding: number[] | null

  @column()
  declare status: 'pending' | 'approved' | 'rejected'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
