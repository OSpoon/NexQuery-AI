import type { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import QueryTask from '#models/query_task'
import DataSource from '#models/data_source'
import { isInternalIP } from '../utils/ip_utils.js'
import type { HttpContext } from '@adonisjs/core/http'

export default class QueryLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number | null

  @column()
  declare taskId: number | null

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

  /**
   * Context-aware logging helper
   */
  public static async log(
    ctx: HttpContext | { request: any, auth?: any },
    data: {
      userId?: number
      taskId?: number
      dataSourceId: number
      executedSql: string
      parameters?: any
      executionTimeMs?: number
      results?: any
      status: 'success' | 'failed'
      errorMessage?: string
      deviceInfo?: any
    },
  ) {
    const { request, auth } = ctx
    const userId = data.userId || auth?.user?.id
    const ipAddress = request.ip()

    return await this.create({
      userId,
      taskId: data.taskId,
      dataSourceId: data.dataSourceId,
      executedSql: data.executedSql,
      parameters: data.parameters,
      executionTimeMs: data.executionTimeMs,
      results: data.results,
      status: data.status,
      errorMessage: data.errorMessage,
      ipAddress,
      userAgent: request.header('user-agent'),
      deviceInfo: data.deviceInfo,
      isInternalIp: isInternalIP(ipAddress),
    })
  }
}
