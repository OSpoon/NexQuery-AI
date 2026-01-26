import type { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class AiFeedback extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare conversationId: number | null

  @column()
  declare question: string

  @column()
  declare generatedSql: string

  @column()
  declare isHelpful: boolean

  @column()
  declare userCorrection: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
