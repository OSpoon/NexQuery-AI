<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useWatermark } from '@/lib/useWatermark'
import { watch, onMounted, computed } from 'vue'

const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const { watermarkUrl, createWatermark, clearWatermark } = useWatermark()

const isDark = computed(() => document.documentElement.classList.contains('dark'))

// Generate watermark content based on user info
const updateWatermark = () => {
    if (authStore.user && settingsStore.showWatermark) {
        const textColor = isDark.value ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        createWatermark({
            content: [
                authStore.user.fullName || authStore.user.email,
                authStore.user.email,
                'NexQuery AI'
            ],
            color: textColor
        })
    } else {
        clearWatermark()
    }
}

// Watch for auth changes and settings changes
watch(
    [() => authStore.user, () => settingsStore.showWatermark],
    () => {
        updateWatermark()
    },
    { immediate: true }
)

// Watch for theme changes (optional, if you want it to adapt immediately)
const observer = new MutationObserver(() => {
    updateWatermark()
})

onMounted(() => {
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
    })
})
</script>

<template>
    <div v-if="watermarkUrl" class="fixed inset-0 z-[9999] pointer-events-none"
        :style="{ backgroundImage: `url(${watermarkUrl})` }"></div>
</template>
