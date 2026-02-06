<script setup lang="ts">
import { CryptoService } from '@nexquery/shared'
import { Cpu, Database, Globe, Plug, Save, Shield } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import api from '@/lib/api'
import { useSettingsStore } from '@/stores/settings'

const { t } = useI18n()

const encryptionKey = import.meta.env.API_ENCRYPTION_KEY
const cryptoService = encryptionKey ? new CryptoService(encryptionKey) : null

const settings = ref([
  {
    key: 'platform_name',
    value: 'NexQuery AI',
    group: 'platform',
  },
  {
    key: 'require_2fa',
    value: 'true',
    group: 'security',
  },
  {
    key: 'allow_export',
    value: 'true',
    group: 'security',
  },
  {
    key: 'show_watermark',
    value: 'true',
    group: 'security',
  },
  {
    key: 'query_timeout_ms',
    value: '30000',
    group: 'engine',
  },
  {
    key: 'ai_base_url',
    value: 'https://api.openai.com/v1',
    group: 'ai',
  },
  {
    key: 'ai_api_key',
    value: '',
    group: 'ai',
    type: 'password',
  },
  {
    key: 'ai_chat_model',
    value: 'gpt-4o',
    group: 'ai',
  },
  {
    key: 'ai_embedding_model',
    value: 'text-embedding-3-small',
    group: 'ai',
  },
  {
    key: 'ai_timeout_sec',
    value: '600',
    group: 'ai',
  },
])

const testPayload = ref('')
const decryptedResult = computed(() => {
  if (!testPayload.value || !cryptoService)
    return ''
  try {
    const trimmed = testPayload.value.trim()
    let cipher = trimmed
    if (trimmed.startsWith('{')) {
      try {
        const json = JSON.parse(trimmed)
        if (json.data)
          cipher = json.data
      }
      catch {}
    }

    const decrypted = cryptoService.decrypt(cipher)
    if (decrypted === null)
      return 'Decryption failed: Result is null'
    return typeof decrypted === 'object' ? JSON.stringify(decrypted, null, 2) : decrypted
  }
  catch (e: any) {
    return `Error: ${e.message}`
  }
})

const loading = ref(true)
const saving = ref(false)
const availableRoles = ref<{ id: number, name: string, slug: string }[]>([])

// AI Connection Testing
const isTestingConnection = ref(false)

async function testConnection() {
  const baseUrl = settings.value.find(s => s.key === 'ai_base_url')?.value
  const apiKey = settings.value.find(s => s.key === 'ai_api_key')?.value

  if (!baseUrl) {
    toast.error('Please configure AI Base URL first')
    return
  }

  isTestingConnection.value = true
  try {
    await api.post('/ai/test-connection', { baseUrl, apiKey })
    toast.success(t('settings.connection_success'))
  }
  catch (e: any) {
    toast.error(e.response?.data?.message || t('settings.connection_failed'))
  }
  finally {
    isTestingConnection.value = false
  }
}

async function fetchRoles() {
  try {
    const response = await api.get('/roles')
    availableRoles.value = response.data
  }
  catch (e) {
    console.error('Failed to fetch roles', e)
  }
}

async function fetchSettings() {
  loading.value = true
  try {
    const response = await api.get('/settings')
    if (response.data && response.data.length > 0) {
      response.data.forEach((s: any) => {
        const existing = settings.value.find(local => local.key === s.key)
        if (existing) {
          if (['ai_api_key'].includes(s.key) && cryptoService && s.value) {
            try {
              const decrypted = cryptoService.decrypt(s.value)
              existing.value = decrypted || s.value
            }
            catch (e) {
              console.error(`Failed to decrypt ${s.key}`, e)
              existing.value = String(s.value)
            }
          }
          else {
            existing.value = String(s.value)
          }
        }
        else {
          settings.value.push({ ...s, group: s.group || 'other' })
        }
      })
    }
  }
  catch {
    toast.error('Failed to load settings')
  }
  finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    const settingsToSave = settings.value.map((s) => {
      if (['ai_api_key'].includes(s.key) && cryptoService && s.value) {
        return {
          ...s,
          value: cryptoService.encrypt(s.value),
        }
      }
      return s
    })

    await api.patch('/settings', { settings: settingsToSave })

    const settingsStore = useSettingsStore()
    await settingsStore.fetchSettings()

    toast.success('Settings saved successfully')
  }
  catch {
    toast.error('Failed to save settings')
  }
  finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchSettings()
  fetchRoles()
})
</script>

<template>
  <div class="container p-6 mx-auto max-w-4xl space-y-6">
    <div class="flex justify-between items-center mb-8">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">
          {{ t('settings.title') }}
        </h2>
        <p class="text-muted-foreground">
          {{ t('settings.desc') }}
        </p>
      </div>
      <Button :disabled="saving" size="lg" class="shadow-md" @click="saveSettings">
        <Save class="mr-2 h-4 w-4" /> {{ saving ? t('common.saving') : t('common.save') }}
      </Button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>

    <div v-else class="space-y-6">
      <!-- 1. Platform Settings -->
      <Card class="shadow-sm">
        <CardHeader>
          <div class="flex items-center space-x-3 text-primary">
            <Globe class="h-5 w-5" />
            <div>
              <CardTitle class="text-lg">
                {{ t('settings.platform') }}
              </CardTitle>
              <CardDescription>{{ t('settings.platform_desc') }}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4 pt-0">
          <div
            v-for="s in settings.filter((s) => s.group === 'platform')"
            :key="s.key"
            class="grid gap-2"
          >
            <Label :for="s.key">{{ t(`settings.keys.${s.key}`) }}</Label>
            <Input :id="s.key" v-model="s.value" class="bg-background" />
            <p class="text-xs text-muted-foreground">
              {{ t(`settings.keys.${s.key}_desc`) }}
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- 2. Security & Privacy -->
      <Card class="shadow-sm">
        <CardHeader>
          <div class="flex items-center space-x-3 text-primary">
            <Shield class="h-5 w-5" />
            <div>
              <CardTitle class="text-lg">
                {{ t('settings.security') }}
              </CardTitle>
              <CardDescription>{{ t('settings.security_desc') }}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="grid gap-6 pt-0">
          <div
            v-for="s in settings.filter((s) => s.group === 'security')"
            :key="s.key"
            class="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-transparent hover:border-border transition-colors"
          >
            <div class="space-y-0.5">
              <Label :for="s.key" class="text-base cursor-pointer">
                {{ t(`settings.keys.${s.key}`) }}
              </Label>
              <p class="text-xs text-muted-foreground max-w-[400px]">
                {{ t(`settings.keys.${s.key}_desc`) }}
              </p>
            </div>
            <Switch
              :id="s.key"
              :model-value="s.value === 'true'"
              @update:model-value="(val) => (s.value = val ? 'true' : 'false')"
            />
          </div>
        </CardContent>
      </Card>

      <!-- 3. Engine Settings -->
      <Card class="shadow-sm">
        <CardHeader>
          <div class="flex items-center space-x-3 text-primary">
            <Database class="h-5 w-5" />
            <div>
              <CardTitle class="text-lg">
                {{ t('settings.engine') }}
              </CardTitle>
              <CardDescription>{{ t('settings.engine_desc') }}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="grid gap-6 pt-0">
          <div
            v-for="s in settings.filter((s) => s.group === 'engine')"
            :key="s.key"
            class="grid gap-2"
          >
            <div class="flex justify-between items-center">
              <Label :for="s.key" class="text-base">{{ t(`settings.keys.${s.key}`) }}</Label>
              <div class="flex items-center space-x-2 w-32">
                <Input :id="s.key" v-model="s.value" type="number" class="text-right" />
                <span class="text-xs text-muted-foreground">ms</span>
              </div>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ t(`settings.keys.${s.key}_desc`) }}
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- 4. AI Intelligence -->
      <Card class="shadow-sm">
        <CardHeader>
          <div class="flex items-center justify-between text-primary">
            <div class="flex items-center space-x-3">
              <Cpu class="h-5 w-5" />
              <div>
                <CardTitle class="text-lg">
                  {{ t('settings.ai') }}
                </CardTitle>
                <CardDescription>{{ t('settings.ai_desc') }}</CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="ml-auto"
              :disabled="isTestingConnection"
              @click="testConnection"
            >
              <Plug
                class="mr-2 h-3.5 w-3.5"
                :class="{ 'animate-pulse': isTestingConnection }"
              />
              {{ t('settings.test_connection') }}
            </Button>
          </div>
        </CardHeader>
        <CardContent class="grid gap-6 pt-0">
          <div
            v-for="s in settings.filter((s) => s.group === 'ai')"
            :key="s.key"
            class="grid gap-2"
          >
            <div class="flex items-center justify-between">
              <Label :for="s.key">{{ t(`settings.keys.${s.key}`) }}</Label>
              <span
                v-if="(s.key === 'ai_api_key') && !s.value"
                class="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-bold animate-pulse"
              >
                MISSING
              </span>
            </div>
            <Input
              :id="s.key"
              v-model="s.value"
              :type="s.type || 'text'"
              class="bg-background"
              :class="{
                'border-destructive/50 focus-visible:ring-destructive':
                  (s.key === 'ai_api_key') && !s.value,
              }"
            />
            <p class="text-xs text-muted-foreground">
              {{ t(`settings.keys.${s.key}_desc`) }}
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- Security Tools (Helper) -->
      <Card class="shadow-sm">
        <CardHeader>
          <div class="flex items-center space-x-3 text-muted-foreground">
            <Shield class="h-5 w-5" />
            <div>
              <CardTitle class="text-base">
                {{ t('security_tools.title') }}
              </CardTitle>
              <CardDescription>{{ t('security_tools.desc') }}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4 pt-0">
          <div class="grid gap-2">
            <Label class="text-xs">{{ t('security_tools.helper_title') }}</Label>
            <textarea
              v-model="testPayload"
              class="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
              :placeholder="t('security_tools.helper_placeholder')"
            />
          </div>

          <div v-if="testPayload" class="grid gap-2">
            <Label class="text-xs">{{ t('security_tools.decrypted_result') }}</Label>
            <div
              class="bg-background p-3 rounded-md font-mono text-xs whitespace-pre-wrap break-all min-h-[50px] border"
            >
              {{ decryptedResult }}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
