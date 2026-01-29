import { useEventBus } from '@vueuse/core'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
// Use the configured axios instance just for config, but we use fetch here
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

    // We use fetch instead of EventSource to support Bearer Token
    const url = '/api/workflow/notifications' // Relative to base not supported by fetch automatically if proxied?
    // Actually Vite proxy works for fetch too if relative.

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

              // Handle Events
              if (eventName === 'notification') {
                toast(data.subject, {
                  description: data.body,
                })
              }
              else if (eventName === 'workflow_approved') {
                // Broadcast event
                const bus = useEventBus<string>('workflow-event')
                bus.emit('approved')

                toast.success('Workflow Approved', {
                  description: `Process ${data.processInstanceId}`,
                  action: {
                    label: 'View',
                    onClick: () => window.location.href = `/workflow/history/${data.processInstanceId}`,
                  },
                })
              }
              else if (eventName === 'workflow_rejected') {
                // Broadcast event
                const bus = useEventBus<string>('workflow-event')
                bus.emit('rejected')

                toast.error('Workflow Rejected', {
                  description: `Reason: ${data.reason}`,
                  action: {
                    label: 'View',
                    onClick: () => window.location.href = `/workflow/history/${data.processInstanceId}`,
                  },
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
        // Auto-reconnect logic could go here (with backoff)
        // For now, simpliest: set flag false
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
