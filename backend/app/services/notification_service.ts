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

  /**
   * Send approval notification
   */
  async sendApprovalNotification(to: string, processInstanceId: string) {
    const subject = `✅ 工作流已批准: ${processInstanceId}`
    logger.info({ to, processInstanceId }, 'Sending approval notification')

    // SSE
    SseService.sendToUser(to, 'workflow_approved', {
      processInstanceId,
      status: 'APPROVED',
      message: 'Workflow Approved',
      timestamp: new Date().toISOString(),
    })

    try {
      await mail.send((message) => {
        message
          .to(to)
          .subject(subject)
          .htmlView('emails/workflow_notification', {
            title: '工作流审批通过',
            processInstanceId,
            isRejected: false,
            reason: null,
          })
      })
    } catch (error) {
      logger.error({ error: error.message, to }, 'Failed to send approval email')
    }
  }

  /**
   * Send rejection notification
   */
  async sendRejectionNotification(to: string, processInstanceId: string, reason: string) {
    const subject = `❌ 工作流已拒绝: ${processInstanceId}`
    logger.info({ to, processInstanceId, reason }, 'Sending rejection notification')

    // SSE
    SseService.sendToUser(to, 'workflow_rejected', {
      processInstanceId,
      status: 'REJECTED',
      message: 'Workflow Rejected',
      reason,
      timestamp: new Date().toISOString(),
    })

    try {
      await mail.send((message) => {
        message
          .to(to)
          .subject(subject)
          .htmlView('emails/workflow_notification', {
            title: '工作流审批被拒绝',
            processInstanceId,
            isRejected: true,
            reason,
          })
      })
    } catch (error) {
      logger.error({ error: error.message, to }, 'Failed to send rejection email')
    }
  }
}
