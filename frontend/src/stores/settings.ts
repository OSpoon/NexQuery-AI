import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/lib/api'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Record<string, string>>({})
  const loading = ref(false)

  // Theme State
  const themeColor = ref('theme-zinc')

  const setThemeColor = (color: string) => {
    themeColor.value = color
    // Remove existing theme classes
    document.documentElement.classList.remove(
      'theme-zinc',
      'theme-red',
      'theme-blue',
      'theme-green',
      'theme-orange',
      'theme-violet',
    )
    if (color !== 'theme-zinc' && color !== '') {
      document.documentElement.classList.add(color)
    }
    localStorage.setItem('theme-color', color)
  }

  const initTheme = () => {
    const savedColor = localStorage.getItem('theme-color')
    if (savedColor) {
      setThemeColor(savedColor)
    }
  }

  const fetchSettings = async () => {
    loading.value = true
    try {
      const response = await api.get('/settings')
      const data = response.data
      const settingsMap: Record<string, string> = {}
      data.forEach((s: any) => {
        settingsMap[s.key] = s.value
      })
      settings.value = settingsMap
    } catch (error) {
      console.error('Failed to fetch settings', error)
    } finally {
      loading.value = false
    }
  }

  const platformName = computed(() => settings.value['platform_name'] || 'NexQuery AI')
  const allowExport = computed(() => settings.value['allow_export'] === 'true')
  const queryTimeoutMs = computed(() => parseInt(settings.value['query_timeout_ms'] || '30000'))
  const systemTimezone = computed(() => settings.value['system_timezone'] || 'UTC')
  const require2fa = computed(() => settings.value['require_2fa'] !== 'false') // Default to true if not present
  const hasGlmKey = computed(() => !!settings.value['glm_api_key'])

  return {
    settings,
    loading,
    fetchSettings,
    platformName,
    allowExport,
    queryTimeoutMs,
    systemTimezone,
    require2fa,
    hasGlmKey,
    themeColor,
    setThemeColor,
    initTheme,
  }
})
