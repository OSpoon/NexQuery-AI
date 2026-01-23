import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import AiConversation from '#models/ai_conversation'

export default class AiMessage extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare conversationId: number

  @column()
  declare role: 'user' | 'assistant'

  @column()
  declare content: string

  @column({
    consume: (value: string | object) => (typeof value === 'string' ? JSON.parse(value) : value),
    prepare: (value: any) => (typeof value === 'string' ? value : JSON.stringify(value)),
  })
  declare agentSteps: any

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => AiConversation, {
    foreignKey: 'conversationId',
  })
  declare conversation: BelongsTo<typeof AiConversation>
}