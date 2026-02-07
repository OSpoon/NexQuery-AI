import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import ScheduledQuery from '#models/scheduled_query'
import SchedulerService from '#services/scheduler_service'
import { Cron } from 'croner'

@inject()
export default class ScheduledQueriesController {
  constructor(protected scheduler: SchedulerService) {}

  async index({ request, response }: HttpContext) {
    const queryTaskId = request.input('query_task_id')
    const query = ScheduledQuery.query().preload('creator')

    if (queryTaskId) {
      query.where('query_task_id', queryTaskId)
    }

    const schedules = await query.orderBy('created_at', 'desc')
    return response.ok(schedules)
  }

  async checkCron({ request, response }: HttpContext) {
    const expression = request.input('expression')
    try {
      const job = new Cron(expression)
      const nextRuns = job.nextRuns(5)
      const dates = nextRuns.map(date => date.toLocaleString())
      return response.ok({ valid: true, nextExecutions: dates })
    } catch (error: any) {
      return response.ok({ valid: false, error: error.message })
    }
  }

  async store({ request, response, auth }: HttpContext) {
    const data = request.only([
      'queryTaskId',
      'cronExpression',
      'runAt',
      'recipients',
      'webhookUrl',
      'isActive',
      'parameters',
    ])

    if (!data.queryTaskId || (!data.cronExpression && !data.runAt) || !data.recipients) {
      return response.badRequest({
        message: 'Missing required fields (need either cronExpression or runAt)',
      })
    }

    const isOneOff = !!data.runAt

    const schedule = await ScheduledQuery.create({
      queryTaskId: data.queryTaskId,
      cronExpression: isOneOff ? null : data.cronExpression || null,
      runAt: isOneOff ? DateTime.fromISO(data.runAt) : null,
      recipients: data.recipients,
      webhookUrl: data.webhookUrl || null,
      isActive: data.isActive ?? true,
      parameters: data.parameters || null,
      createdBy: auth.user!.id,
    })

    await schedule.load('queryTask')
    await schedule.refresh() // Ensure consume hooks run and we have clean data

    if (schedule.isActive) {
      this.scheduler.scheduleJob(schedule)
    }

    return response.created(schedule)
  }

  async show({ params, response }: HttpContext) {
    const schedule = await ScheduledQuery.findOrFail(params.id)
    return response.ok(schedule)
  }

  async update({ params, request, response }: HttpContext) {
    const schedule = await ScheduledQuery.findOrFail(params.id)
    const data = request.only(['cronExpression', 'runAt', 'recipients', 'webhookUrl', 'isActive', 'parameters'])

    if (data.runAt) {
      data.runAt = DateTime.fromISO(data.runAt)
      data.cronExpression = null
    } else if (data.cronExpression) {
      data.runAt = null
    }

    schedule.merge(data)
    await schedule.save()
    await schedule.load('queryTask')
    await schedule.refresh()

    // Refresh job
    this.scheduler.cancelJob(schedule.id)
    if (schedule.isActive) {
      this.scheduler.scheduleJob(schedule)
    }

    return response.ok(schedule)
  }

  async destroy({ params, response }: HttpContext) {
    const schedule = await ScheduledQuery.findOrFail(params.id)

    this.scheduler.cancelJob(schedule.id)
    await schedule.delete()

    return response.noContent()
  }

  async execute({ params, response }: HttpContext) {
    const schedule = await ScheduledQuery.findOrFail(params.id)

    // Trigger execution in background (fire and forget)
    this.scheduler.execute(schedule, true)

    return response.ok({ message: 'Execution started' })
  }
}
