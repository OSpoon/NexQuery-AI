import Notification from '#models/notification'
import SseService from '#services/sse_service'
import logger from '@adonisjs/core/services/logger'

export interface NotificationPayload {
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  content: string
  metaData?: any
}

export default class NotificationService {
  /**
   * Send a notification to a specific user
   */
  public static async send(userId: number, payload: NotificationPayload) {
    try {
      // 1. Persist to Database
      const notification = await Notification.create({
        userId,
        type: payload.type,
        title: payload.title,
        content: payload.content,
        metaData: payload.metaData || {},
        isRead: false,
      })

      // 2. Dispatch via SSE
      SseService.dispatchToUser(userId, {
        type: 'notification',
        data: notification.toJSON(),
      })

      return notification
    } catch (e) {
      logger.error({ error: e }, `[NotificationService] Failed to send notification to user ${userId}`)
    }
  }

  /**
   * Compatibility wrapper for existing controllers
   */
  public static async push(userId: number, title: string, content: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    return this.send(userId, { title, content, type })
  }

  /**
   * Broadcast a notification to all connected users
   * Note: This version persists to DB for each user to track read status (optional behavior)
   * OR we can send it as a real-time only message.
   * For "Message Center", persistent is usually better.
   */
  public static async broadcast(payload: NotificationPayload, persistForAll: boolean = false) {
    try {
      if (persistForAll) {
        // This is expensive for many users, but fine for small teams
        // A better way would be a 'system_notification' table, but for simplicity:
        // We'll just dispatch real-time for now and maybe implement a GlobalNotification table later if needed.
        logger.info('[NotificationService] Global persistent broadcast is not yet optimized. Sending real-time only.')
      }

      // 1. Dispatch real-time to all
      SseService.dispatchToAll({
        type: 'notification',
        data: {
          ...payload,
          createdAt: new Date().toISOString(),
          isRead: false,
        },
      })
    } catch (e) {
      logger.error({ error: e }, '[NotificationService] Real-time broadcast failed')
    }
  }
}
