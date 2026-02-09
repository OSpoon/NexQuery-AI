<script setup lang="ts">
import type { QueryTask } from '@nexquery/shared'
import { toTypedSchema } from '@vee-validate/zod'
import { useDebounceFn } from '@vueuse/core'
import { X } from 'lucide-vue-next'
import { useForm } from 'vee-validate'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import CurlEditor from '@/components/shared/CurlEditor.vue'
import LuceneEditor from '@/components/shared/LuceneEditor.vue'
import SqlEditor from '@/components/shared/SqlEditor.vue'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import api from '@/lib/api'

const props = defineProps<{
  initialValues?: QueryTask | null
  isEditing?: boolean
}>()

const emit = defineEmits(['success', 'cancel'])

const { t } = useI18n()

const dataSources = ref<Array<{ id: number, name: string, type: string }>>([])
const sqlTemplate = ref(props.initialValues?.sqlTemplate || '')

const formSchemaJson = ref(JSON.stringify(props.initialValues?.formSchema || [], null, 2))

const variables = computed(() => {
  try {
    const schema = JSON.parse(formSchemaJson.value || '[]')
    return schema.map((f: any) => ({ name: f.name, description: f.label }))
  }
  catch {
    return []
  }
})

const formSchema = toTypedSchema(
  z.object({
    name: z.string().min(2),
    description: z.string().optional(),

    dataSourceId: z.number(),
    storeResults: z.boolean().default(false),
    tags: z.array(z.string().max(15)).max(3).optional(),
  }),
)

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: props.initialValues?.name || '',
    description: props.initialValues?.description || '',

    dataSourceId: props.initialValues?.dataSourceId,
    storeResults: (() => {
      const val
        = props.initialValues?.storeResults
          ?? (props.initialValues as any)?.store_execution_results
          ?? false
      // Handle various truthy types just in case
      if (typeof val === 'string')
        return val === 'true' || val === '1'
      if (typeof val === 'number')
        return val === 1
      return !!val
    })(),
    tags: props.initialValues?.tags || [],
  },
})

// --- Reordered definitions to avoid use-before-define ---
const currentDataSource = computed(() => {
  return dataSources.value.find(ds => ds.id === form.values.dataSourceId)
})

const dbType = computed(() => {
  return currentDataSource.value?.type || null
})

const updateSchemaFromSql = useDebounceFn((sql: string) => {
  const variableRegex = /\{\{\s*(\w+)\s*\}\}/g
  const matches = [...sql.matchAll(variableRegex)].map(m => m[1])

  const isEs = dbType.value === 'elasticsearch'
  const uniqueVars = [...new Set(matches.filter(v => isEs ? !['index', 'query', 'size'].includes(v) : true))]

  // Get default index from current data source
  const defaultIndex = (currentDataSource.value as any)?.database || 'nexquery-logs-*'

  // Determine the default value for the "query" field.
  const hasVariables = matches.length > 0
  const defaultQueryValue = hasVariables ? '*' : (sql.trim() || '*')

  const standardFields = isEs
    ? [
        { name: 'index', label: 'Index Pattern', type: 'text', placeholder: 'nexquery-logs-*', required: true, defaultValue: defaultIndex },
        { name: 'query', label: 'Query string (Lucene)', type: 'text', placeholder: '*', required: false, defaultValue: defaultQueryValue },
        { name: 'size', label: 'Limit', type: 'number', placeholder: '100', required: false, defaultValue: 100 },
      ]
    : []

  const customFields = uniqueVars.map(v => ({
    name: v,
    label: v.charAt(0).toUpperCase() + v.slice(1),
    type: 'text',
    placeholder: `Enter ${v}`,
    required: true,
  }))

  formSchemaJson.value = JSON.stringify([...standardFields, ...customFields], null, 2)
}, 300)

watch(sqlTemplate, (newVal) => {
  updateSchemaFromSql(newVal)
})

watch(
  () => props.initialValues,
  (newVal) => {
    // Robust extraction for storeResults
    let booleanStoreResults = false
    if (newVal) {
      const val = newVal.storeResults ?? (newVal as any).store_execution_results
      if (typeof val === 'string')
        booleanStoreResults = val === 'true' || val === '1'
      else if (typeof val === 'number')
        booleanStoreResults = val === 1
      else booleanStoreResults = !!val
    }

    form.resetForm({
      values: {
        name: newVal?.name || '',
        description: newVal?.description || '',

        dataSourceId: newVal?.dataSourceId,
        storeResults: booleanStoreResults,
        tags: newVal?.tags || [],
      },
    })
  },
  { deep: true },
)

async function fetchDataSources() {
  try {
    const response = await api.get('/data-sources')
    dataSources.value = response.data
  }
  catch {
    toast.error('Failed to fetch data sources')
  }
}

const esFields = ref<Array<{ name: string, type: string }>>([])

async function fetchEsSchema(dataSourceId: number) {
  try {
    const response = await api.get(`/data-sources/${dataSourceId}/schema`)
    if (response.data && response.data.length > 0) {
      esFields.value = response.data[0].columns
    }
  }
  catch {
    console.warn('Failed to fetch ES schema for autocompletion')
  }
}

onMounted(async () => {
  await fetchDataSources()
  if (props.initialValues?.dataSourceId) {
    form.setFieldValue('dataSourceId', props.initialValues.dataSourceId)
    if (dbType.value === 'elasticsearch') {
      fetchEsSchema(props.initialValues.dataSourceId)
    }
  }
  if (props.initialValues?.sqlTemplate) {
    sqlTemplate.value = props.initialValues.sqlTemplate
  }
})

watch(() => form.values.dataSourceId, (newId) => {
  updateSchemaFromSql(sqlTemplate.value)
  if (newId && dbType.value === 'elasticsearch') {
    fetchEsSchema(newId)
  }
  else {
    esFields.value = []
  }
})

const sqlEditorRef = ref<any>(null)
const luceneEditorRef = ref<any>(null)

const isSubmitting = ref(false)

const tagInput = ref('')
function addTag() {
  const val = tagInput.value.trim()
  if (!val)
    return

  const currentTags = Array.isArray(form.values.tags) ? form.values.tags : []
  if (currentTags.length >= 3) {
    toast.error('Maximum 3 tags allowed')
    return
  }

  if (val.length > 15) {
    toast.error('Tag must be 15 characters or less')
    return
  }

  if (currentTags.includes(val)) {
    toast.error('Tag already exists')
    return
  }

  form.setFieldValue('tags', [...currentTags, val])
  tagInput.value = ''
}

function removeTag(index: number) {
  const currentTags = [...(form.values.tags || [])]
  currentTags.splice(index, 1)
  form.setFieldValue('tags', currentTags)
}

const onSubmit = form.handleSubmit(async (values) => {
  // Validate SQL
  // Validate SQL (Skip for ES which uses Lucene or text)
  if (sqlEditorRef.value && dbType.value !== 'elasticsearch' && dbType.value !== 'api') {
    const isValid = sqlEditorRef.value.validate()
    if (!isValid) {
      toast.error('Please fix SQL syntax errors before saving')
      return
    }
  }

  // Validate Lucene (Elasticsearch)
  if (luceneEditorRef.value && dbType.value === 'elasticsearch') {
    const isValid = luceneEditorRef.value.validate()
    if (!isValid) {
      toast.error('Please fix Lucene syntax errors before saving')
      return
    }
  }

  let parsedSchema = null
  try {
    parsedSchema = JSON.parse(formSchemaJson.value)
  }
  catch {
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
    }
    else {
      await api.post('/query-tasks', payload)
      toast.success('Task created')
    }
    emit('success')
  }
  catch (_error: any) {
    toast.error(`Failed to save: ${_error.response?.data?.message || _error.message}`)
  }
  finally {
    isSubmitting.value = false
  }
})

onMounted(fetchDataSources)
</script>

<template>
  <form class="h-full flex flex-col overflow-hidden" novalidate @submit="onSubmit">
    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto p-6 space-y-6">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <FormField v-slot="{ componentField }" name="name" :validate-on-blur="false">
            <FormItem>
              <FormLabel>{{ t('query_tasks.task_name') }}</FormLabel>
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
              <FormLabel>{{ t('query_tasks.data_source') }}</FormLabel>
              <Select
                :model-value="value?.toString()"
                @update:model-value="
                  (v) => form.setFieldValue('dataSourceId', parseInt((v as string) || '0'))
                "
              >
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
                <FormLabel class="text-base">
                  {{ t('query_tasks.store_results') }}
                </FormLabel>
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

        <div class="col-span-2">
          <FormField v-slot="{ value }" name="tags">
            <FormItem>
              <FormLabel>{{ t('query_tasks.tags') }} (Max 3)</FormLabel>
              <div class="space-y-3">
                <div class="flex gap-2">
                  <Input
                    v-model="tagInput"
                    placeholder="Enter tag and press enter..."
                    :disabled="(value || []).length >= 3"
                    @keydown.enter.prevent="addTag"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    :disabled="(value || []).length >= 3"
                    @click="addTag"
                  >
                    {{ t('common.add') || '添加' }}
                  </Button>
                </div>
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="(tag, idx) in value || []"
                    :key="tag"
                    class="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-sm"
                  >
                    {{ tag }}
                    <button type="button" class="hover:text-destructive" @click="removeTag(Number(idx))">
                      <X class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>
      </div>

      <FormField v-slot="{ componentField }" name="description" :validate-on-blur="false">
        <FormItem>
          <FormLabel>{{ t('query_tasks.desc') }}</FormLabel>
          <FormControl>
            <Textarea :placeholder="t('query_tasks.desc')" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <div v-if="currentDataSource" class="space-y-2">
        <Label>{{
          dbType === 'api'
            ? t('query_tasks.command_template')
            : dbType === 'elasticsearch'
              ? '查询模板'
              : t('query_tasks.sql_template')
        }}</Label>
        <div class="flex items-center justify-between">
          <p v-if="dbType !== 'api'" class="text-xs text-muted-foreground">
            {{ t('query_tasks.placeholders_hint') }}
          </p>
        </div>
        <CurlEditor v-if="dbType === 'api'" v-model="sqlTemplate" :variables="variables" />
        <LuceneEditor
          v-else-if="dbType === 'elasticsearch'"
          ref="luceneEditorRef"
          v-model="sqlTemplate"
          :variables="variables"
          :fields="esFields"
        />
        <SqlEditor
          v-else-if="dbType && dbType !== 'elasticsearch'"
          ref="sqlEditorRef"
          v-model="sqlTemplate"
          :language="dbType === 'postgresql' ? 'pgsql' : 'sql'"
          :db-type="dbType"
          :variables="variables"
          :data-source-id="form.values.dataSourceId"
        />
      </div>
      <div
        v-else
        class="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-lg bg-muted/20"
      >
        <p class="text-sm text-muted-foreground">
          {{ t('query_tasks.select_datasource_hint') }}
        </p>
      </div>
    </div>

    <!-- Fixed Footer -->
    <div
      class="shrink-0 p-6 pt-4 border-t bg-background flex justify-end gap-2 rounded-b-lg"
    >
      <Button type="button" variant="ghost" @click="emit('cancel')">
        {{
          t('common.cancel')
        }}
      </Button>
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
