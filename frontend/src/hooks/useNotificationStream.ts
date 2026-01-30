import { onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'

export function useNotificationStream() {
  let eventSource: EventSource | null = null

  const connect = () => {
    // We need to pass the auth token if we want it to be secure,
    // but EventSource doesn't support headers by default.
    // However, our backend stream route is under auth() middleware.
    // Standard approach: Use a temporary token or session cookie.
    // Since we are using session-based auth (likely), it might work.
    // If using Bearer token, we need a workaround or a library like fetch-event-source.

    const token = localStorage.getItem('auth_token')
    // Use relative path to leverage Vite proxy and avoid hostname issues
    const url = `/api/notifications/stream${token ? `?token=${token}` : ''}`
    eventSource = new EventSource(url, { withCredentials: true })

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'notification') {
          const { title, message, type } = data.payload

          // 1. Show Toast (Sonner)
          if (type === 'success')
            toast.success(title, { description: message })
          else if (type === 'error')
            toast.error(title, { description: message })
          else if (type === 'warning')
            toast.warning(title, { description: message })
          else toast.info(title, { description: message })

          // 2. Show Browser Notification
          if (Notification.permission === 'granted') {
            const n = new Notification(title, {
              body: message,
              icon: '/favicon.ico', // Or any specific icon
            })
            n.close() // Clean up immediately or manage lifecycle
          }
        }
      }
      catch (e) {
        console.error('Failed to parse SSE message', e)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE connection error', err)
      eventSource?.close()
      // Reconnect after 5s
      setTimeout(connect, 5000)
    }
  }

  onMounted(() => {
    // Request notification permission if not already set
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission()
      }
    }
    connect()
  })

  onUnmounted(() => {
    eventSource?.close()
  })
}
