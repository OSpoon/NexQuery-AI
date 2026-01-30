import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'

export function useNotificationStream() {
  const isConnected = ref(false)
  let controller: AbortController | null = null

  async function connect() {
    const authStore = useAuthStore()
    if (!authStore.token)
      return

    if (isConnected.value)
      return

    controller = new AbortController()

    // Fixed path for centralized notifications (e.g. general system broadcast)
    const url = '/api/notifications/stream'

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          Accept: 'text/event-stream',
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`SSE Error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader)
        return

      isConnected.value = true
      const decoder = new TextDecoder()

      // Simple loop to read stream
      while (true) {
        const { done, value } = await reader.read()
        if (done)
          break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        let eventName = 'message'

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.replace('event:', '').trim()
          }
          else if (line.startsWith('data:')) {
            const dataStr = line.replace('data:', '').trim()
            if (!dataStr)
              continue

            try {
              const data = JSON.parse(dataStr)

              // Handle General Notifications
              if (eventName === 'notification') {
                toast(data.subject, {
                  description: data.body,
                })
              }
            }
            catch {
              // Ignore ping or parse error
            }
          }
        }
      }
    }
    catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('SSE connection lost', error)
      }
    }
    finally {
      isConnected.value = false
    }
  }

  function disconnect() {
    if (controller) {
      controller.abort()
      controller = null
    }
    isConnected.value = false
  }

  return {
    connect,
    disconnect,
    isConnected,
  }
}
