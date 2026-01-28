<script setup lang="ts">
import { onMounted } from 'vue'
import GlobalConfirmDialog from '@/components/common/GlobalConfirmDialog.vue'
import GlobalWatermark from '@/components/common/GlobalWatermark.vue'
import { Toaster } from '@/components/ui/sonner'
import { useAuthStore } from '@/stores/auth'

import { useSettingsStore } from '@/stores/settings'

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
  <GlobalConfirmDialog />
  <Toaster />
</template>
