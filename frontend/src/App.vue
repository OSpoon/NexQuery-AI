<script setup lang="ts">
import { onMounted, watch } from 'vue'
import GlobalWatermark from '@/components/common/GlobalWatermark.vue'
import { Toaster } from '@/components/ui/sonner'
import { useNotificationStream } from '@/composables/useNotificationStream'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'

const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const { connect, disconnect } = useNotificationStream()

// Initialize auth state on app mount
onMounted(() => {
  authStore.initAuth().then(() => {
    if (authStore.isAuthenticated) {
      connect()
    }
  })
  settingsStore.fetchSettings()
  settingsStore.initTheme()
})

watch(() => authStore.isAuthenticated, (newValue) => {
  if (newValue) {
    connect()
  }
  else {
    disconnect()
  }
})
</script>

<template>
  <GlobalWatermark />
  <RouterView />
  <Toaster />
</template>
