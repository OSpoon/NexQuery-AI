<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import { Sparkles } from 'lucide-vue-next'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ScheduleManager from './ScheduleManager.vue'

import SqlEditor from '@/components/shared/SqlEditor.vue'
import CurlEditor from '@/components/shared/CurlEditor.vue'
import AiOptimizationResult from './AiOptimizationResult.vue'
import api from '@/lib/api'
import { useSettingsStore } from '@/stores/settings'
import { toast } from 'vue-sonner'

import type { QueryTask, DataSource } from '@nexquery/shared'

const props = defineProps<{
  initialValues?: QueryTask | null
  isEditing?: boolean
}>()

const emit = defineEmits(['success', 'cancel'])

const { t } = useI18n()
const settingsStore = useSettingsStore()

const activeTab = ref('definition')

const dataSources = ref<Array<{ id: number; name: string; type: string }>>([])
const sqlTemplate = ref(props.initialValues?.sqlTemplate || '')

const formSchemaJson = ref(JSON.stringify(props.initialValues?.formSchema || [], null, 2))

const variables = computed(() => {
  try {
    const schema = JSON.parse(formSchemaJson.value || '[]')
    return schema.map((f: any) => ({ name: f.name, description: f.label }))
  } catch (e) {
    return []
  }
})

const updateSchemaFromSql = useDebounceFn((sql: string) => {
  const variableRegex = /{{\s*(\w+)\s*}}/g
  const matches = [...sql.matchAll(variableRegex)].map((m) => m[1])
  const uniqueVars = [...new Set(matches)]

  try {
    const currentSchema = JSON.parse(formSchemaJson.value || '[]') as any[]
    const existingMap = new Map(currentSchema.map((f) => [f.name, f]))

    // Create new schema preserving existing fields if they still exist in SQL
    const newSchema = uniqueVars
      .map((v) => {
        if (!v) return null
        if (existingMap.has(v)) {
          return existingMap.get(v)
        }
        return {
          name: v,
          label: v.charAt(0).toUpperCase() + v.slice(1),
          type: 'text',
          placeholder: `Enter ${v}`,
          required: true,
        }
      })
      .filter(Boolean)

    // Only update if the schema actually changed (simplified check)
    if (JSON.stringify(newSchema) !== JSON.stringify(currentSchema)) {
      formSchemaJson.value = JSON.stringify(newSchema, null, 2)
    }
  } catch (e) {
    // If JSON is invalid, reset to derived schema from SQL
    const newSchema = uniqueVars
      .map((v) => {
        if (!v) return null
        return {
          name: v,
          label: v.charAt(0).toUpperCase() + v.slice(1),
          type: 'text',
          placeholder: `Enter ${v}`,
          required: true,
        }
      })
      .filter(Boolean)
    formSchemaJson.value = JSON.stringify(newSchema, null, 2)
  }
}, 300)

watch(sqlTemplate, (newVal) => {
  updateSchemaFromSql(newVal)
})

const formSchema = toTypedSchema(
  z.object({
    name: z.string().min(2),
    description: z.string().optional(),

    dataSourceId: z.number(),
    storeResults: z.boolean().default(false),
  }),
)

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: props.initialValues?.name || '',
    description: props.initialValues?.description || '',

    dataSourceId: props.initialValues?.dataSourceId,
    storeResults: (() => {
      const val =
        props.initialValues?.storeResults ??
        (props.initialValues as any)?.store_execution_results ??
        false
      // Handle various truthy types just in case
      if (typeof val === 'string') return val === 'true' || val === '1'
      if (typeof val === 'number') return val === 1
      return !!val
    })(),
  },
})

watch(
  () => props.initialValues,
  (newVal) => {
    // Robust extraction for storeResults
    let booleanStoreResults = false
    if (newVal) {
      const val = newVal.storeResults ?? (newVal as any).store_execution_results
      if (typeof val === 'string') booleanStoreResults = val === 'true' || val === '1'
      else if (typeof val === 'number') booleanStoreResults = val === 1
      else booleanStoreResults = !!val
    }

    form.resetForm({
      values: {
        name: newVal?.name || '',
        description: newVal?.description || '',

        dataSourceId: newVal?.dataSourceId,
        storeResults: booleanStoreResults,
      },
    })
  },
  { deep: true },
)

const fetchDataSources = async () => {
  try {
    const response = await api.get('/data-sources')
    dataSources.value = response.data
  } catch (error) {
    toast.error('Failed to fetch data sources')
  }
}

const currentDataSource = computed(() => {
  return dataSources.value.find((ds) => ds.id === form.values.dataSourceId)
})

const dbType = computed(() => {
  return currentDataSource.value?.type || null
})

const sqlEditorRef = ref<any>(null)

const isSubmitting = ref(false)
const isOptimizing = ref(false)
const showAiResult = ref(false) // Renamed from showOptimizationResult
const aiAnalysis = ref('') // Renamed from optimizationResult
// optimizationUsage is removed as it's not used in the new optimizeSql logic

// Get token from localStorage like api.ts does
const getToken = () => {
  return localStorage.getItem('auth_token')
}

// Assuming schemaTables should be derived from formSchemaJson if it represents database schema
// If formSchemaJson is for form variables, this might need adjustment based on actual backend expectation
const schemaTables = computed(() => {
  try {
    // This is a placeholder. The formSchemaJson currently represents form variables,
    // not database tables. If the AI optimization endpoint expects database schema,
    // this computed property needs to be updated to provide actual table schema.
    // For now, it sends the parsed form variables as a 'tables' array.
    return JSON.parse(formSchemaJson.value || '[]')
  } catch (e) {
    console.error('Error parsing formSchemaJson for schemaTables:', e)
    return []
  }
})

const optimizeSql = async () => {
  if (!sqlTemplate.value.trim()) {
    toast.error('Please enter SQL to optimize')
    return
  }

  isOptimizing.value = true
  aiAnalysis.value = ''
  showAiResult.value = true

  try {
    const token = await getToken() // Assuming you have a way to get auth token
    const response = await fetch('/api/ai/optimize-sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sql: sqlTemplate.value,
        dbType: dbType.value || 'mysql', // Use dbType from currentDataSource
        schema: {
          tables: schemaTables.value, // Use derived schemaTables
        },
      }),
    })

    if (!response.ok) {
      throw new Error(response.statusText)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    let buffer = ''

    if (!reader) throw new Error('No response body')

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      // Keep the last partial line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const content = parsed.chunk || parsed.choices?.[0]?.delta?.content || ''
            aiAnalysis.value += content
          } catch (e) {
            // Ignore parse errors for partial chunks (though buffer should prevent this)
          }
        }
      }
    }
  } catch (error: any) {
    if (!aiAnalysis.value) {
      aiAnalysis.value = `Error: ${error.message}`
    }
    toast.error('Optimization failed: ' + (error.message || 'Unknown error'))
  } finally {
    isOptimizing.value = false
  }
}

const onSubmit = form.handleSubmit(async (values) => {
  // Validate SQL
  if (sqlEditorRef.value) {
    const isValid = sqlEditorRef.value.validate()
    if (!isValid) {
      toast.error('Please fix SQL syntax errors before saving')
      return
    }
  }

  let parsedSchema = null
  try {
    parsedSchema = JSON.parse(formSchemaJson.value)
  } catch (e) {
    toast.error('Invalid Form Schema JSON')
    return
  }

  isSubmitting.value = true
  const payload = {
    ...values,
    sqlTemplate: sqlTemplate.value,
    formSchema: parsedSchema,
  }

  try {
    if (props.isEditing && props.initialValues) {
      await api.put(`/query-tasks/${props.initialValues.id}`, payload)
      toast.success('Task updated')
    } else {
      await api.post('/query-tasks', payload)
      toast.success('Task created')
    }
    emit('success')
  } catch (error: any) {
    toast.error('Failed to save: ' + (error.response?.data?.message || error.message))
  } finally {
    isSubmitting.value = false
  }
})

onMounted(fetchDataSources)
</script>

<template>
  <form @submit="onSubmit" class="h-full flex flex-col overflow-hidden" novalidate>
    <Tabs v-model="activeTab" class="flex-1 flex flex-col overflow-hidden">
      <div class="px-6 pt-6 shrink-0">
        <TabsList>
          <TabsTrigger value="definition">{{ t('query_tasks.definition') }}</TabsTrigger>
          <TabsTrigger value="schedules" :disabled="!isEditing">{{
            t('query_tasks.schedules')
            }}</TabsTrigger>
        </TabsList>
      </div>

      <!-- Definition Tab -->
      <TabsContent value="definition" :force-mount="true"
        class="flex-1 overflow-y-auto p-6 space-y-6 data-[state=inactive]:hidden">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <FormField v-slot="{ componentField }" name="name" :validate-on-blur="false">
              <FormItem>
                <FormLabel>Task Name</FormLabel>
                <FormControl>
                  <Input placeholder="User Sales Report" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

          <div>
            <FormField v-slot="{ value }" name="dataSourceId" :validate-on-blur="false">
              <FormItem>
                <FormLabel>Data Source</FormLabel>
                <Select :model-value="value?.toString()" @update:model-value="
                  (v) => form.setFieldValue('dataSourceId', parseInt((v as string) || '0'))
                ">
                  <FormControl>
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="Select data source" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem v-for="ds in dataSources" :key="ds.id" :value="ds.id.toString()">
                      {{ ds.name }} ({{ ds.type }})
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

          <div class="col-span-2">
            <FormField v-slot="{ value, handleChange }" name="storeResults">
              <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4">
                <div class="space-y-0.5">
                  <FormLabel class="text-base">{{ t('query_tasks.store_results') }}</FormLabel>
                  <FormDescription>
                    {{ t('query_tasks.store_results_desc') }}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch :model-value="!!value" @update:model-value="handleChange" />
                </FormControl>
              </FormItem>
            </FormField>
          </div>
        </div>

        <FormField v-slot="{ componentField }" name="description" :validate-on-blur="false">
          <FormItem>
            <FormLabel>{{ t('query_tasks.desc') }}</FormLabel>
            <FormControl>
              <Textarea placeholder="Describe what this query does..." v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <div class="space-y-2" v-if="currentDataSource">
          <Label>{{
            dbType === 'api' ? t('query_tasks.command_template') : t('query_tasks.sql_template')
            }}</Label>
          <div class="flex items-center justify-between">
            <p class="text-xs text-muted-foreground" v-if="dbType !== 'api'">
              {{ t('query_tasks.placeholders_hint') }}
            </p>

            <div class="flex items-center gap-2">
              <div v-if="!settingsStore.hasGlmKey"
                class="flex items-center gap-1 px-2 py-0.5 rounded-full border border-destructive/30 bg-destructive/5 text-[10px] text-destructive animate-in fade-in zoom-in">
                {{ t('settings.keys.glm_key_missing') }}
                <router-link to="/admin/settings" class="underline font-bold">
                  {{ t('settings.keys.configure_now') }}
                </router-link>
              </div>
              <Button type="button" variant="outline" size="sm" class="h-7 text-xs gap-1"
                :disabled="isOptimizing || !sqlTemplate || !settingsStore.hasGlmKey" @click="optimizeSql"
                v-if="dbType !== 'api'">
                <Sparkles class="w-3.5 h-3.5 text-yellow-500" />
                {{ isOptimizing ? t('query_tasks.analyzing') : t('query_tasks.ai_optimize') }}
              </Button>
            </div>
          </div>
          <CurlEditor v-if="dbType === 'api'" v-model="sqlTemplate" :variables="variables" />
          <SqlEditor v-else-if="dbType" ref="sqlEditorRef" v-model="sqlTemplate"
            :language="dbType === 'postgresql' ? 'pgsql' : 'sql'" :db-type="dbType" :variables="variables"
            :data-source-id="form.values.dataSourceId" />
        </div>
        <div v-else
          class="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-lg bg-muted/20">
          <p class="text-sm text-muted-foreground">请先选择数据源以开始编辑</p>
        </div>
      </TabsContent>

      <!-- Schedules Tab -->
      <TabsContent value="schedules" class="flex-1 overflow-y-auto p-6 space-y-6 data-[state=inactive]:hidden">
        <ScheduleManager v-if="isEditing && initialValues" :query-task-id="initialValues.id" />
        <div v-else class="text-center text-muted-foreground mt-10">
          Please save the task before creating schedules.
        </div>
      </TabsContent>
    </Tabs>

    <AiOptimizationResult v-model:open="showAiResult" :analysis="aiAnalysis" :loading="isOptimizing"
      @refresh="optimizeSql" />

    <!-- Fixed Footer -->
    <div class="shrink-0 p-6 pt-4 border-t bg-background flex justify-end gap-2 rounded-b-lg"
      v-if="activeTab === 'definition'">
      <Button type="button" variant="ghost" @click="emit('cancel')">{{
        t('common.cancel')
        }}</Button>
      <Button type="submit" :disabled="isSubmitting">
        {{
          isSubmitting
            ? t('common.loading')
            : isEditing
              ? t('query_tasks.save_changes')
              : t('query_tasks.save_task')
        }}
      </Button>
    </div>
  </form>
</template>
