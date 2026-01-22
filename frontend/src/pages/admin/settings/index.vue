<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Save, Settings, Globe, Shield, Database, Mail, Send, Cpu, Key } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import ApiKeysManager from '@/components/profile/ApiKeysManager.vue'
import { useAuthStore } from '@/stores/auth'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'
import { toast } from 'vue-sonner'
import { useSettingsStore } from '@/stores/settings'
import { Switch } from '@/components/ui/switch'
import { CryptoService } from '@nexquery/shared'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const encryptionKey = import.meta.env.API_ENCRYPTION_KEY
const cryptoService = encryptionKey ? new CryptoService(encryptionKey) : null

const settings = ref([
  {
    key: 'platform_name',
    value: 'NexQuery AI',
    group: 'general',
  },
  {
    key: 'require_2fa',
    value: 'true',
    group: 'general',
  },
  {
    key: 'system_timezone',
    value: '', // Will be filled by backend
    group: 'general',
  },
  {
    key: 'query_timeout_ms',
    value: '30000',
    group: 'execution',
  },
  {
    key: 'allow_export',
    value: 'true',
    group: 'general',
  },
  {
    key: 'glm_api_key',
    value: '',
    group: 'integration',
    type: 'password',
  },
  {
    key: 'ai_chat_model',
    value: 'glm-4.5-flash',
    group: 'integration',
  },
  {
    key: 'ai_embedding_model',
    value: 'embedding-3',
    group: 'integration',
  },
])

const loading = ref(true)
const saving = ref(false)

const fetchSettings = async () => {
  loading.value = true
  try {
    const response = await api.get('/settings')
    if (response.data && response.data.length > 0) {
      // Merge fetched settings with our local definitions for labels/descriptions
      response.data.forEach((s: any) => {
        const existing = settings.value.find((local) => local.key === s.key)
        if (existing) {
          // Decrypt if necessary
          if (['glm_api_key'].includes(s.key) && cryptoService && s.value) {
            try {
              const decrypted = cryptoService.decrypt(s.value)
              existing.value = decrypted || s.value
            } catch (e) {
              console.error(`Failed to decrypt ${s.key}`, e)
              existing.value = String(s.value)
            }
          } else {
            existing.value = String(s.value)
          }
        } else {
          settings.value.push(s)
        }
      })
    }
  } catch (error) {
    toast.error('Failed to load settings')
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  try {
    // Process settings before saving (encrypt sensitive fields)
    const settingsToSave = settings.value.map((s) => {
      if (['glm_api_key'].includes(s.key) && cryptoService && s.value) {
        return {
          ...s,
          value: cryptoService.encrypt(s.value),
        }
      }
      return s
    })

    await api.patch('/settings', { settings: settingsToSave })

    // Refresh global store immediately
    const settingsStore = useSettingsStore()
    await settingsStore.fetchSettings()

    toast.success('Settings saved successfully')
  } catch (error) {
    toast.error('Failed to save settings')
  } finally {
    saving.value = false
  }
}

const authStore = useAuthStore()

onMounted(fetchSettings)
</script>

<template>
  <div class="container p-6 mx-auto max-w-4xl space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">{{ t('settings.title') }}</h1>
        <p class="text-muted-foreground">{{ t('settings.desc') }}</p>
      </div>
      <Button @click="saveSettings" :disabled="saving">
        <Save class="mr-2 h-4 w-4" /> {{ saving ? t('settings.saving') : t('settings.save') }}
      </Button>
    </div>

    <div class="space-y-6">
      <Card>
        <CardHeader>
          <div class="flex items-center space-x-2">
            <Globe class="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{{ t('settings.general') }}</CardTitle>
              <CardDescription>{{ t('settings.general_desc') }}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div v-for="s in settings.filter((s) => s.group === 'general')" :key="s.key" class="grid gap-2">
            <div v-if="['allow_export', 'require_2fa', 'show_watermark'].includes(s.key)"
              class="flex items-center justify-between py-2">
              <div class="space-y-0.5">
                <Label :for="s.key">{{ t(`settings.keys.${s.key}`) }}</Label>
                <p class="text-xs text-muted-foreground">{{ t(`settings.keys.${s.key}_desc`) }}</p>
              </div>
              <Switch :id="s.key" :model-value="s.value === 'true'"
                @update:model-value="(val) => (s.value = val ? 'true' : 'false')" />
            </div>
            <div v-else class="grid gap-2">
              <Label :for="s.key">{{ t(`settings.keys.${s.key}`) }}</Label>
              <Input :id="s.key" v-model="s.value" />
              <p class="text-xs text-muted-foreground">{{ t(`settings.keys.${s.key}_desc`) }}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div class="flex items-center space-x-2">
            <Database class="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{{ t('settings.execution') }}</CardTitle>
              <CardDescription>{{ t('settings.execution_desc') }}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div v-for="s in settings.filter((s) => s.group === 'execution')" :key="s.key" class="grid gap-2">
            <Label :for="s.key">{{ t(`settings.keys.${s.key}`) }}</Label>
            <Input :id="s.key" v-model="s.value" type="number" />
            <p class="text-xs text-muted-foreground">{{ t(`settings.keys.${s.key}_desc`) }}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div class="flex items-center space-x-2">
            <Cpu class="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{{ t('settings.integration') }}</CardTitle>
              <CardDescription>{{ t('settings.integration_desc') }}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div v-for="s in settings.filter((s) => s.group === 'integration')" :key="s.key" class="grid gap-2">
            <div class="flex items-center justify-between">
              <Label :for="s.key">{{ t(`settings.keys.${s.key}`) }}</Label>
              <span v-if="s.key === 'glm_api_key' && !s.value"
                class="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-bold animate-pulse">
                MISSING
              </span>
            </div>
            <Input :id="s.key" v-model="s.value" :type="s.type || 'text'" :class="{
              'border-destructive/50 focus-visible:ring-destructive':
                s.key === 'glm_api_key' && !s.value,
            }" />
            <p class="text-xs text-muted-foreground">{{ t(`settings.keys.${s.key}_desc`) }}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
