import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import AiConversation from '#models/ai_conversation'

export default class AiUsageLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare conversationId: number | null

  @column()
  declare modelName: string

  @column()
  declare provider: string

  @column()
  declare promptTokens: number

  @column()
  declare completionTokens: number

  @column()
  declare totalTokens: number

  @column()
  declare estimatedCost: number

  @column()
  declare context: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => AiConversation)
  declare conversation: BelongsTo<typeof AiConversation>
}
