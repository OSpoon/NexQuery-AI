import { Buffer } from 'node:buffer'
import { Cron } from 'croner'
import ScheduledQuery from '#models/scheduled_query'
import type QueryExecutionService from '#services/query_execution_service'
import mail from '@adonisjs/mail/services/main'
import logger from '@adonisjs/core/services/logger'
import { inject } from '@adonisjs/core'

@inject()
export default class SchedulerService {
  private jobs: Map<number, Cron> = new Map()

  constructor(protected queryExecutionService: QueryExecutionService) {}

  public async init() {
    const db = await import('@adonisjs/lucid/services/db')
    logger.info(
      { connections: Array.from(db.default.manager.connections.keys()) },
      'Available database connections',
    )

    const schedules = await ScheduledQuery.query().where('isActive', true).preload('queryTask')
    for (const s of schedules) {
      this.scheduleJob(s)
    }
    logger.info(`Initialized ${schedules.length} scheduled queries`)
  }

  public scheduleJob(scheduledQuery: ScheduledQuery) {
    if (this.jobs.has(scheduledQuery.id)) {
      this.cancelJob(scheduledQuery.id)
    }

    if (!scheduledQuery.isActive)
      return

    let cronValue: string | Date | null = null
    if (scheduledQuery.runAt) {
      cronValue = scheduledQuery.runAt.toJSDate()
    } else if (scheduledQuery.cronExpression) {
      cronValue = scheduledQuery.cronExpression
    }

    if (!cronValue)
      return

    const job = new Cron(cronValue, async () => {
      await this.execute(scheduledQuery)

      // If it was a one-off job (runAt was set), disable it after execution
      if (scheduledQuery.runAt) {
        scheduledQuery.isActive = false
        await scheduledQuery.save()
        this.cancelJob(scheduledQuery.id)
        logger.info(`One-off job ${scheduledQuery.id} finished and disabled`)
      }
    })

    this.jobs.set(scheduledQuery.id, job)
  }

  public cancelJob(id: number) {
    const job = this.jobs.get(id)
    if (job) {
      job.stop()
      this.jobs.delete(id)
    }
  }

  private async execute(scheduledQuery: ScheduledQuery) {
    try {
      // 1. Double-check: Re-fetch status from DB to ensure it wasn't disabled by another process/node
      const freshSchedule = await ScheduledQuery.find(scheduledQuery.id)
      if (!freshSchedule || !freshSchedule.isActive) {
        logger.warn(`Scheduled query ${scheduledQuery.id} skipped (not active or deleted)`)
        return
      }

      // 2. Load Task
      const task = await scheduledQuery.related('queryTask').query().preload('dataSource').first()
      if (!task)
        return

      logger.info(
        {
          scheduleId: scheduledQuery.id,
          taskId: task.id,
          cron: scheduledQuery.cronExpression,
          runAt: scheduledQuery.runAt?.toISO(),
          parameters: scheduledQuery.parameters,
        },
        'Executing scheduled query job',
      )

      const result = await this.queryExecutionService.execute(
        task,
        scheduledQuery.parameters || {},
        { userId: scheduledQuery.createdBy || undefined },
      )

      logger.info(
        {
          scheduleId: scheduledQuery.id,
          resultCount: Array.isArray(result.data) ? result.data.length : 1,
        },
        'Query execution finished',
      )

      const csv = this.jsonToCsv(result.data)

      const recipients = scheduledQuery.recipients

      logger.info(
        {
          taskId: task.id,
          recipients,
          recipientsType: typeof recipients,
        },
        'Preparing to send scheduled email',
      )

      if (!recipients || recipients.length === 0) {
        logger.warn(`No recipients defined for scheduled query ${scheduledQuery.id}`)
        return
      }

      try {
        await mail.send((message) => {
          const recipientsList = recipients.map(r => ({ address: r }))
          recipientsList.forEach(r => message.to(r.address))
          message
            .subject(`[NexQuery AI] Results for: ${task.name}`)
            .htmlView('emails/scheduled_query_result', {
              taskName: task.name,
              taskId: task.id,
              executedAt: new Date().toLocaleString(),
            })
            .attachData(Buffer.from(csv, 'utf-8'), {
              filename: `results_${task.id}_${Date.now()}.csv`,
              contentType: 'text/csv',
            })
        })
      } catch (error: any) {
        logger.error(`Failed to send email for query ${scheduledQuery.id}: ${error.message}`)
      }

      if (scheduledQuery.webhookUrl) {
        try {
          await fetch(scheduledQuery.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId: task.id,
              taskName: task.name,
              executedAt: new Date().toISOString(),
              result: result.data,
            }),
          })
          logger.info(`Webhook sent to ${scheduledQuery.webhookUrl}`)
        } catch (error: any) {
          logger.error(`Failed to send webhook for query ${scheduledQuery.id}: ${error.message}`)
        }
      }

      logger.info(`Executed scheduled query ${scheduledQuery.id}`)

      // Notification Center: Notify the creator
      if (scheduledQuery.createdBy) {
        const { default: NotificationService } = await import('#services/notification_service')
        await NotificationService.push(
          scheduledQuery.createdBy,
          '计划任务执行成功',
          `您订阅的任务 [${task.name}] 已于 ${new Date().toLocaleString()} 执行成功，结果已发送至您的邮箱。`,
          'success',
        )
      }
    } catch (error: any) {
      logger.error(`Failed to execute scheduled query ${scheduledQuery.id}: ${error.message}`)

      // Notify on failure
      if (scheduledQuery.createdBy) {
        const { default: NotificationService } = await import('#services/notification_service')
        await NotificationService.push(
          scheduledQuery.createdBy,
          '计划任务执行失败',
          `您订阅的任务 [${scheduledQuery.id}] 执行失败: ${error.message}`,
          'error',
        )
      }
    }
  }

  private jsonToCsv(data: any): string {
    if (!Array.isArray(data) || data.length === 0)
      return ''
    // Handle case where data might be just strings (from API)
    if (typeof data[0] !== 'object')
      return data.join('\n')

    const headers = Object.keys(data[0])
    const csvRows = [headers.join(',')]

    for (const row of data) {
      const values = headers.map((header) => {
        const val = row[header] === null || row[header] === undefined ? '' : row[header]
        const escaped = (`${val}`).replace(/"/g, '""')
        return `"${escaped}"`
      })
      csvRows.push(values.join(','))
    }
    return csvRows.join('\n')
  }
}
