import type { HttpContext } from '@adonisjs/core/http'
import QueryTask from '#models/query_task'
import { createQueryTaskValidator, updateQueryTaskValidator } from '#validators/query_task'
import logger from '@adonisjs/core/services/logger'

export default class QueryTasksController {
  /**
   * Display a list of resource
   */
  async index({ request, response }: HttpContext) {
    const search = request.input('search')
    const tag = request.input('tag')

    const allCountResult = await QueryTask.query().count('* as total')
    const totalInDb = allCountResult[0].$extras.total

    const query = QueryTask.query()
      .preload('dataSource')
      .preload('creator')
      .orderBy('createdAt', 'desc')

    if (search && search !== '' && search !== 'undefined') {
      query.where((q) => {
        q.where('name', 'like', `%${search}%`).orWhere('description', 'like', `%${search}%`)
      })
    }

    if (tag && tag !== 'undefined' && tag !== 'null' && tag !== '' && tag !== 'All') {
      // PostgreSQL jsonb check for array contains
      query.whereRaw('tags @> ?::jsonb', [JSON.stringify([tag])])
    }

    const tasks = await query
    return response.ok(tasks)
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(createQueryTaskValidator)
    const user = auth.user!

    const task = await QueryTask.create({
      name: payload.name,
      description: payload.description || null,
      sqlTemplate: payload.sqlTemplate,
      formSchema: payload.formSchema || null,
      dataSourceId: payload.dataSourceId,
      storeResults: payload.storeResults ?? false,
      tags: payload.tags || null,
      createdBy: user.id,
    })

    return response.created(task)
  }

  /**
   * Show individual record
   */
  async show({ params, response }: HttpContext) {
    const task = await QueryTask.query()
      .where('id', params.id)
      .preload('dataSource')
      .preload('creator')
      .firstOrFail()
    return response.ok(task)
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, response }: HttpContext) {
    const task = await QueryTask.findOrFail(params.id)
    const payload = await request.validateUsing(updateQueryTaskValidator)

    if (payload.name !== undefined) task.name = payload.name
    if (payload.description !== undefined) task.description = payload.description
    if (payload.sqlTemplate !== undefined) task.sqlTemplate = payload.sqlTemplate
    if (payload.formSchema !== undefined) task.formSchema = payload.formSchema
    if (payload.dataSourceId !== undefined) task.dataSourceId = payload.dataSourceId
    if (payload.storeResults !== undefined) task.storeResults = payload.storeResults
    if (payload.tags !== undefined) task.tags = payload.tags

    await task.save()

    return response.ok(task)
  }

  /**
   * Delete record
   */
  async destroy({ params, response }: HttpContext) {
    const task = await QueryTask.findOrFail(params.id)
    await task.delete()
    return response.noContent()
  }
}
