import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/lib/api'

export interface Notification {
  id: number
  userId: number
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  content: string
  isRead: boolean
  metaData: any
  createdAt: string
  updatedAt: string
}

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const total = ref(0)

  async function fetchNotifications(page = 1, limit = 20) {
    loading.value = true
    try {
      const response = await api.get('/user/notifications', {
        params: { page, limit },
      })
      if (page === 1) {
        notifications.value = response.data.data
      }
      else {
        notifications.value = [...notifications.value, ...response.data.data]
      }
      unreadCount.value = response.data.meta.unreadCount
      total.value = response.data.meta.total
    }
    finally {
      loading.value = false
    }
  }

  async function markAsRead(id: number) {
    try {
      await api.patch(`/user/notifications/${id}/read`)
      const notification = notifications.value.find(n => n.id === id)
      if (notification && !notification.isRead) {
        notification.isRead = true
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
    }
    catch (e) {
      console.error('Failed to mark notification as read', e)
    }
  }

  async function markAllAsRead() {
    try {
      await api.post('/user/notifications/read-all')
      notifications.value.forEach(n => n.isRead = true)
      unreadCount.value = 0
    }
    catch (e) {
      console.error('Failed to mark all as read', e)
    }
  }

  function addNotification(notification: Notification) {
    // Add to the beginning of the list
    notifications.value.unshift(notification)
    unreadCount.value++
    total.value++

    // Optionally keep the list size manageable
    if (notifications.value.length > 50) {
      notifications.value.pop()
    }
  }

  return {
    notifications,
    unreadCount,
    loading,
    total,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    addNotification,
  }
})
