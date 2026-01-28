import type { HttpContext } from '@adonisjs/core/http'
import NotificationService from '#services/notification_service'
import logger from '@adonisjs/core/services/logger'

export default class WebhookController {
  private notificationService: NotificationService

  constructor() {
    this.notificationService = new NotificationService()
  }

  /**
   * Handle incoming notification webhook from Flowable
   */
  async handleNotification({ request, response }: HttpContext) {
    const { type, recipient, processInstanceId, reason } = request.all()

    logger.info({ type, recipient, processInstanceId }, 'Received notification webhook')

    if (!recipient) {
      return response.badRequest({ message: 'Recipient is required' })
    }

    try {
      if (type === 'rejection') {
        await this.notificationService.sendRejectionNotification(recipient, processInstanceId, reason || 'No reason provided')
      } else if (type === 'approval') {
        await this.notificationService.sendApprovalNotification(recipient, processInstanceId)
      } else {
        // Generic fall back
        const subject = request.input('subject', 'Workflow Notification')
        const body = request.input('body', 'You have a new notification.')
        await this.notificationService.sendEmail(recipient, subject, body)
      }

      return response.ok({ message: 'Notification processed' })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to process notification webhook')
      return response.internalServerError({ message: 'Failed to process notification' })
    }
  }
}
