<script setup lang="ts">
import { onMounted } from 'vue'
import GlobalWatermark from '@/components/common/GlobalWatermark.vue'
import { Toaster } from '@/components/ui/sonner'

const authStore = useAuthStore()
const settingsStore = useSettingsStore()

// Initialize auth state on app mount
onMounted(() => {
  authStore.initAuth()
  settingsStore.fetchSettings()
  settingsStore.initTheme()
})
</script>

<template>
  <GlobalWatermark />
  <RouterView />
  <Toaster />
</template>
