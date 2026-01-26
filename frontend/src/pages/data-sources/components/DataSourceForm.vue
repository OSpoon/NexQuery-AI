<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import api from '@/lib/api'

const props = defineProps<{
  initialValues?: any
  isEditing?: boolean
}>()

const emit = defineEmits(['success', 'cancel'])

const { t } = useI18n()

const formSchema = toTypedSchema(
  z.object({
    name: z.string().min(1, 'Name is required'),
    type: z.string().min(1, 'Type is required'),
    host: z.string().min(1, 'Host is required'),
    port: z.coerce.number().default(3306),
    username: z.string().optional(),
    password: z.string().optional().or(z.literal('')),
    database: z.string().optional(),
  }),
)

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: props.initialValues?.name || '',
    type: props.initialValues?.type || 'mysql',
    host: props.initialValues?.host || '',
    port: props.initialValues?.port || 3306,
    username: props.initialValues?.username || '',
    password: '',
    database: props.initialValues?.database || '',
  },
})

// Watch for changes in initialValues (useful when switching between add/edit without unmounting)
watch(
  () => props.initialValues,
  (newValues) => {
    form.resetForm({
      values: {
        name: newValues?.name || '',
        type: newValues?.type || 'mysql',
        host: newValues?.host || '',
        port: newValues?.port || 3306,
        username: newValues?.username || '',
        password: '',
        database: newValues?.database || '',
      },
    })
  },
  { deep: true },
)

// Auto-Sync Port when Type changes
watch(
  () => form.values.type,
  (newType) => {
    // Only auto-set if it's one of the known types
    if (newType === 'mysql') {
      form.setFieldValue('port', 3306)
      form.setFieldValue('username', 'root')
    }
    else if (newType === 'postgresql') {
      form.setFieldValue('port', 5432)
      form.setFieldValue('username', 'postgres')
    }
  },
)

const isSubmitting = ref(false)
const isTestingConnection = ref(false)

async function handleTestConnection() {
  if (!form.values.password && form.values.type !== 'api') {
    toast.error('Please enter the password to test connection')
    return
  }

  const result = await form.validate()
  if (!result.valid)
    return

  isTestingConnection.value = true
  try {
    const payload = { ...form.values }
    if (props.isEditing && !payload.password) {
      delete payload.password
    }

    const res = await api.post('/data-sources/test-connection', {
      ...payload,
      id: props.initialValues?.id,
    })

    if (res.data && res.data.success) {
      toast.success('Connection successful')
    }
    else {
      throw new Error(res.data?.message || 'Connection failed')
    }
  }
  catch (error: any) {
    toast.error(error.message || 'Connection failed')
  }
  finally {
    isTestingConnection.value = false
  }
}

const onSubmit = form.handleSubmit(async (values) => {
  isSubmitting.value = true
  try {
    const payload: any = { ...values }

    // If editing and password is empty, don't send it to avoid overwriting with empty string
    if (props.isEditing && !payload.password) {
      delete payload.password
    }

    if (props.isEditing) {
      await api.put(`/data-sources/${props.initialValues.id}`, payload)
      toast.success('Data source updated successfully')
    }
    else {
      await api.post('/data-sources', payload)
      toast.success('Data source created successfully')
    }
    emit('success')
  }
  catch (error: any) {
    toast.error(`Failed to save data source: ${error.response?.data?.message || error.message}`)
  }
  finally {
    isSubmitting.value = false
  }
})

const dbTypes = [
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'API / Curl', value: 'api' },
]
</script>

<template>
  <form class="h-full flex flex-col overflow-hidden" novalidate @submit="onSubmit">
    <!-- Middle: Scrollable Content -->
    <div class="flex-1 overflow-y-auto p-6 space-y-6">
      <div class="space-y-6">
        <div class="grid grid-cols-3 gap-4">
          <div class="col-span-2">
            <FormField v-slot="{ componentField }" name="name" :validate-on-blur="false">
              <FormItem>
                <FormLabel>{{ t('data_sources.display_name') }}</FormLabel>
                <FormControl>
                  <Input placeholder="Production DB" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

          <div class="col-span-1">
            <FormField v-slot="{ value }" name="type" :validate-on-blur="false">
              <FormItem>
                <FormLabel>{{ t('data_sources.database_type') }}</FormLabel>
                <Select
                  :model-value="value"
                  @update:model-value="(v) => form.setFieldValue('type', v as string)"
                >
                  <FormControl>
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem v-for="type in dbTypes" :key="type.value" :value="type.value">
                      {{ type.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div :class="form.values.type === 'api' ? 'col-span-3' : 'col-span-2'">
            <FormField v-slot="{ componentField }" name="host" :validate-on-blur="false">
              <FormItem>
                <FormLabel>
                  {{
                    form.values.type === 'api' ? t('data_sources.base_url') : t('data_sources.host')
                  }}
                </FormLabel>
                <FormControl>
                  <Input
                    :placeholder="
                      form.values.type === 'api' ? 'https://api.example.com' : 'localhost'
                    "
                    v-bind="componentField"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

          <div v-if="form.values.type !== 'api'" class="col-span-1">
            <FormField v-slot="{ componentField }" name="port" :validate-on-blur="false">
              <FormItem>
                <FormLabel>{{ t('data_sources.port') }}</FormLabel>
                <FormControl>
                  <Input type="number" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>
        </div>

        <FormField
          v-if="form.values.type !== 'api'"
          v-slot="{ componentField }"
          name="database"
          :validate-on-blur="false"
        >
          <FormItem>
            <FormLabel>{{ t('data_sources.database') }}</FormLabel>
            <FormControl>
              <Input placeholder="main_db" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <div v-if="form.values.type !== 'api'" class="grid grid-cols-2 gap-4">
          <div>
            <FormField v-slot="{ componentField }" name="username" :validate-on-blur="false">
              <FormItem>
                <FormLabel>{{ t('data_sources.username') }}</FormLabel>
                <FormControl>
                  <Input v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

          <div>
            <FormField v-slot="{ componentField }" name="password" :validate-on-blur="false">
              <FormItem>
                <FormLabel>
                  {{
                    form.values.type === 'api'
                      ? t('data_sources.api_token')
                      : t('data_sources.password')
                  }}
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    :placeholder="isEditing ? 'Leave blank to keep current' : '••••••••'"
                    v-bind="componentField"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>
        </div>
      </div>
    </div>

    <!-- Fixed Footer -->
    <div
      class="shrink-0 p-6 pt-4 border-t bg-background flex justify-between items-center gap-2 rounded-b-lg"
    >
      <Button
        type="button"
        variant="outline"
        :disabled="isTestingConnection || isSubmitting"
        @click="handleTestConnection"
      >
        {{ isTestingConnection ? t('common.loading') : t('data_sources.test_connection') }}
      </Button>
      <div class="flex gap-2">
        <Button type="button" variant="ghost" @click="emit('cancel')">
          {{
            t('common.cancel')
          }}
        </Button>
        <Button type="submit" :disabled="isSubmitting || isTestingConnection">
          {{ isSubmitting ? t('common.loading') : isEditing ? t('common.save') : t('common.save') }}
        </Button>
      </div>
    </div>
  </form>
</template>
