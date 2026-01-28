import type { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import QueryTask from '#models/query_task'
import DataSource from '#models/data_source'

export default class QueryLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number | null

  @column()
  declare taskId: number | null

  @column({ columnName: 'process_instance_id' })
  declare processInstanceId: string | null

  @column({ columnName: 'approval_comment' })
  declare approvalComment: string | null

  @column()
  declare dataSourceId: number | null

  @column({
    prepare: (value: any) => JSON.stringify(value),
  })
  declare parameters: any

  @column()
  declare executedSql: string

  @column()
  declare executionTimeMs: number | null

  @column()
  declare ipAddress: string | null

  @column()
  declare userAgent: string | null

  @column({
    prepare: (value: any) => JSON.stringify(value),
  })
  declare deviceInfo: any

  @column()
  declare isInternalIp: boolean

  @column({
    prepare: (value: any) => JSON.stringify(value),
  })
  declare results: any

  @column()
  declare status: string

  @column()
  declare errorMessage: string | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => QueryTask, {
    foreignKey: 'taskId',
  })
  declare task: BelongsTo<typeof QueryTask>

  @belongsTo(() => DataSource, {
    foreignKey: 'dataSourceId',
  })
  declare dataSource: BelongsTo<typeof DataSource>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
