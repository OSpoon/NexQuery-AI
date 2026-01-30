import SseService from '#services/sse_service'

export default class NotificationService {
  /**
   * Send a system notification via SSE
   */
  public static push(userId: number, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', action?: any) {
    SseService.dispatchToUser(userId, {
      type: 'notification',
      payload: {
        title,
        message,
        type,
        action,
        timestamp: new Date().toISOString(),
      },
    })
  }

  /**
   * Send progress update for a specific task
   */
  public static pushTaskProgress(userId: number, taskId: string, progress: number, message: string) {
    SseService.dispatchToUser(userId, {
      type: 'task_progress',
      payload: {
        taskId,
        progress,
        message,
        timestamp: new Date().toISOString(),
      },
    })
  }
}
