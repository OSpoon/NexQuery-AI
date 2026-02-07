import type { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import QueryTask from '#models/query_task'
import User from '#models/user'

export default class ScheduledQuery extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'query_task_id' })
  declare queryTaskId: number

  @column({ columnName: 'cron_expression' })
  declare cronExpression: string | null

  @column.dateTime({ columnName: 'run_at' })
  declare runAt: DateTime | null

  @column({
    prepare: (value: any) => JSON.stringify(value),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare recipients: string[]

  @column({ columnName: 'webhook_url' })
  declare webhookUrl: string | null

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare parameters: any | null

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @belongsTo(() => QueryTask)
  declare queryTask: BelongsTo<typeof QueryTask>

  @belongsTo(() => User, {
    foreignKey: 'createdBy',
  })
  declare creator: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
