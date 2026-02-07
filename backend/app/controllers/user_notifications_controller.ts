import type { HttpContext } from '@adonisjs/core/http'
import Notification from '#models/notification'

export default class UserNotificationsController {
  /**
   * List user notifications
   */
  async index({ auth, request }: HttpContext) {
    const user = auth.user!
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const type = request.input('type')
    const onlyUnread = request.input('unread') === 'true'

    const query = Notification.query()
      .where('userId', user.id)
      .orderBy('createdAt', 'desc')

    if (type) {
      query.where('type', type)
    }

    if (onlyUnread) {
      query.where('isRead', false)
    }

    const notifications = await query.paginate(page, limit)

    // Also return unread count in meta
    const unreadCount = await Notification.query()
      .where('userId', user.id)
      .where('isRead', false)
      .count('* as total')

    const response = notifications.toJSON()
    response.meta.unreadCount = Number.parseInt(unreadCount[0].$extras.total)

    return response
  }

  /**
   * Mark notification as read
   */
  async markAsRead({ params, auth, response }: HttpContext) {
    const user = auth.user!
    const notification = await Notification.query()
      .where('id', params.id)
      .where('userId', user.id)
      .firstOrFail()

    notification.isRead = true
    await notification.save()

    return response.ok(notification)
  }

  /**
   * Mark all as read
   */
  async markAllAsRead({ auth, response }: HttpContext) {
    const user = auth.user!
    await Notification.query()
      .where('userId', user.id)
      .where('isRead', false)
      .update({ isRead: true })

    return response.ok({ message: 'All notifications marked as read' })
  }

  /**
   * Delete a notification
   */
  async destroy({ params, auth, response }: HttpContext) {
    const user = auth.user!
    const notification = await Notification.query()
      .where('id', params.id)
      .where('userId', user.id)
      .firstOrFail()

    await notification.delete()

    return response.noContent()
  }
}
