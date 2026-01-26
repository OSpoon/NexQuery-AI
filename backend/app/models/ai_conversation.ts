import type { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import DataSource from '#models/data_source'
import AiMessage from '#models/ai_message'

export default class AiConversation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare title: string | null

  @column()
  declare dataSourceId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => DataSource)
  declare dataSource: BelongsTo<typeof DataSource>

  @hasMany(() => AiMessage, {
    foreignKey: 'conversationId',
  })
  declare messages: HasMany<typeof AiMessage>
}
