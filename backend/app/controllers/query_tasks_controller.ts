import type { HttpContext } from '@adonisjs/core/http'
import QueryTask from '#models/query_task'
import { createQueryTaskValidator, updateQueryTaskValidator } from '#validators/query_task'
import { PERMISSIONS } from '@nexquery/shared'

export default class QueryTasksController {
  /**
   * Display a list of resource
   */
  async index({ request, response, auth }: HttpContext) {
    const search = request.input('search')
    const tag = request.input('tag')
    const user = auth.user!

    const query = QueryTask.query()
      .preload('dataSource')
      .preload('creator')
      .orderBy('createdAt', 'desc')

    const hasManageTasks = await user.hasPermission(PERMISSIONS.MANAGE_TASKS)

    // Always enforce visibility rules
    if (!hasManageTasks) {
      query.where((q) => {
        q.where('visibility', 'public').orWhere('createdBy', user.id)
      })
    }

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
      visibility: payload.visibility ?? 'private',
      tags: payload.tags || null,
      createdBy: user.id,
    })

    return response.created(task)
  }

  /**
   * Show individual record
   */
  async show({ params, response, auth }: HttpContext) {
    const user = auth.user!
    const task = await QueryTask.query()
      .where('id', params.id)
      .preload('dataSource')
      .preload('creator')
      .firstOrFail()

    const hasManageTasks = await user.hasPermission(PERMISSIONS.MANAGE_TASKS)
    if (!hasManageTasks) {
      if (task.visibility !== 'public' && task.createdBy !== user.id) {
        return response.forbidden({ message: 'Not authorized to view this task' })
      }
    }

    return response.ok(task)
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, response, auth }: HttpContext) {
    const user = auth.user!
    const task = await QueryTask.findOrFail(params.id)

    const hasManageTasks = await user.hasPermission(PERMISSIONS.MANAGE_TASKS)

    // Only creators or admins can edit
    if (!hasManageTasks && task.createdBy !== user.id) {
      return response.forbidden({ message: 'You can only edit your own query tasks' })
    }

    const payload = await request.validateUsing(updateQueryTaskValidator)

    if (payload.name !== undefined)
      task.name = payload.name
    if (payload.description !== undefined)
      task.description = payload.description
    if (payload.sqlTemplate !== undefined)
      task.sqlTemplate = payload.sqlTemplate
    if (payload.formSchema !== undefined)
      task.formSchema = payload.formSchema
    if (payload.dataSourceId !== undefined)
      task.dataSourceId = payload.dataSourceId
    if (payload.storeResults !== undefined)
      task.storeResults = payload.storeResults
    if (payload.visibility !== undefined)
      task.visibility = payload.visibility
    if (payload.tags !== undefined)
      task.tags = payload.tags

    await task.save()

    return response.ok(task)
  }

  /**
   * Delete record
   */
  async destroy({ params, response, auth }: HttpContext) {
    const user = auth.user!
    const task = await QueryTask.findOrFail(params.id)

    const hasManageTasks = await user.hasPermission(PERMISSIONS.MANAGE_TASKS)

    // Only creators or admins can delete
    if (!hasManageTasks && task.createdBy !== user.id) {
      return response.forbidden({ message: 'You can only delete your own query tasks' })
    }

    await task.delete()
    return response.noContent()
  }
}
