import { onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { useNotificationStore } from '@/stores/notification'

export function useNotificationStream() {
  const store = useNotificationStore()
  let eventSource: EventSource | null = null

  const connect = () => {
    const token = localStorage.getItem('auth_token')
    const url = `/api/notifications/stream${token ? `?token=${token}` : ''}`
    eventSource = new EventSource(url, { withCredentials: true })

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'notification') {
          // data.data is the JSON of the Notification model
          const notification = data.data
          const { title, content, type } = notification

          // 1. Add to Store
          store.addNotification(notification)

          // 2. Show Toast (Sonner)
          if (type === 'success')
            toast.success(title, { description: content })
          else if (type === 'error')
            toast.error(title, { description: content })
          else if (type === 'warning')
            toast.warning(title, { description: content })
          else toast.info(title, { description: content })

          // 3. Show Browser Notification
          if (Notification.permission === 'granted') {
            // eslint-disable-next-line no-new
            new Notification(title, {
              body: content,
              icon: '/favicon.ico',
            })
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
