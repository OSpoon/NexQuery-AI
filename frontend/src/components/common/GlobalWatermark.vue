<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useWatermark } from '@/lib/useWatermark'
import { watch, onMounted, computed } from 'vue'

const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const { watermarkUrl, createWatermark, clearWatermark } = useWatermark()

const isDark = computed(() => document.documentElement.classList.contains('dark'))

let tamperObserver: MutationObserver | null = null

// Generate watermark content based on user info
const updateWatermark = () => {
  if (authStore.user && settingsStore.showWatermark) {
    const textColor = isDark.value ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
    createWatermark({
      content: [
        authStore.user.fullName || authStore.user.email,
        authStore.user.email,
        'NexQuery AI',
      ],
      color: textColor,
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
  { immediate: true },
)

// Tamper-proof logic: Monitor DOM changes
const initTamperProof = () => {
  if (tamperObserver) tamperObserver.disconnect()

  tamperObserver = new MutationObserver((mutations) => {
    if (!authStore.user || !settingsStore.showWatermark) return

    for (const mutation of mutations) {
      // 1. Detect if the watermark element itself was removed from body
      if (mutation.type === 'childList') {
        const removed = Array.from(mutation.removedNodes).some(
          (node) => node instanceof HTMLElement && node.id === 'global-watermark-overlay',
        )
        if (removed) updateWatermark()
      }

      // 2. Detect if attributes (style/class) were modified on the element
      if (
        mutation.type === 'attributes' &&
        mutation.target instanceof HTMLElement &&
        mutation.target.id === 'global-watermark-overlay'
      ) {
        const target = mutation.target
        // Simple check: if background-image is missing or pointer-events is changed
        if (!target.style.backgroundImage || target.style.pointerEvents !== 'none') {
          updateWatermark()
        }
      }
    }
  })

  tamperObserver.observe(document.body, {
    childList: true,
    attributes: true,
    subtree: true,
    attributeFilter: ['style', 'class', 'id'],
  })
}

// Theme observer
const themeObserver = new MutationObserver(() => {
  updateWatermark()
})

onMounted(() => {
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  initTamperProof()
})
</script>

<template>
  <div
    v-if="watermarkUrl"
    id="global-watermark-overlay"
    class="fixed inset-0 z-[9999] pointer-events-none"
    :style="{ backgroundImage: `url(${watermarkUrl})` }"
  ></div>
</template>
