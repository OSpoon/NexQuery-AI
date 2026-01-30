import mail from '@adonisjs/mail/services/main'
import logger from '@adonisjs/core/services/logger'
import SseService from './sse_service.js'

export default class NotificationService {
  /**
   * Send a general notification email
   */
  async sendEmail(to: string, subject: string, body: string) {
    logger.info({ to, subject }, 'Sending notification email')

    // Also send SSE
    SseService.sendToUser(to, 'notification', { subject, body })

    try {
      await mail.send((message) => {
        message
          .to(to)
          .subject(subject)
          .htmlView('emails/notification', { body, subject })
      })
    } catch (error) {
      logger.error({ error: error.message, to }, 'Failed to send email')
    }
  }
}
