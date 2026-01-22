<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import api from '@/lib/api'
import { toast } from 'vue-sonner'
import type { DataSource } from '@nexquery/shared'

const props = defineProps<{
  dataSource: DataSource | null
  open: boolean
}>()

const emit = defineEmits(['update:open', 'success'])

const { t } = useI18n()

// Advanced Config State
interface EnumItem {
  value: string
  label: string
}

interface MaskingConfig {
  type: string
  rule?: string
  replace?: string
}

interface FieldConfig {
  name: string
  alias: string
  enums: EnumItem[]
  masking: MaskingConfig
}

interface TableConfig {
  table: string
  fields: FieldConfig[]
}

const advancedConfig = ref<TableConfig[]>([])
const isSaving = ref(false)

const maskingTypes = [
  { value: 'none', label: 'None' },
  { value: 'mobile', label: 'Mobile Phone' },
  { value: 'id_card', label: 'ID Card' },
  { value: 'email', label: 'Email' },
  { value: 'bank_card', label: 'Bank Card' },
  { value: 'password', label: 'Password (Hidden)' },
  { value: 'custom', label: 'Custom Regex' },
]

const initAdvancedConfig = () => {
  const ds: any = props.dataSource
  if (ds?.config?.advanced_config) {
    try {
      advancedConfig.value = (ds.config.advanced_config || []).map((t: any) => ({
        table: t.table || '',
        fields: (t.fields || []).map((f: any) => ({
          name: f.name || '',
          alias: f.alias || '',
          enums: f.enums
            ? Object.entries(f.enums).map(([value, label]) => ({
                value,
                label: String(label),
              }))
            : [],
          masking: f.masking
            ? {
                type: f.masking.type || 'none',
                rule: f.masking.rule || '',
                replace: f.masking.replace || '',
              }
            : { type: 'none', rule: '', replace: '' },
        })),
      }))
    } catch (e) {
      console.error('Failed to parse advanced config', e)
      advancedConfig.value = []
    }
  } else {
    advancedConfig.value = []
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      initAdvancedConfig()
    }
  },
)

// Helper functions for Advanced Config
const addTableConfig = () => {
  advancedConfig.value.push({ table: '', fields: [] })
}

const removeTableConfig = (index: number) => {
  advancedConfig.value.splice(index, 1)
}

const addFieldConfig = (tableIndex: number) => {
  advancedConfig.value[tableIndex]!.fields.push({
    name: '',
    alias: '',
    enums: [],
    masking: { type: 'none', rule: '', replace: '' },
  })
}

const removeFieldConfig = (tableIndex: number, fieldIndex: number) => {
  advancedConfig.value[tableIndex]!.fields.splice(fieldIndex, 1)
}

const addEnum = (tableIndex: number, fieldIndex: number) => {
  advancedConfig.value[tableIndex]!.fields[fieldIndex]!.enums.push({ value: '', label: '' })
}

const removeEnum = (tableIndex: number, fieldIndex: number, enumIndex: number) => {
  advancedConfig.value[tableIndex]!.fields[fieldIndex]!.enums.splice(enumIndex, 1)
}

const saveConfig = async () => {
  if (!props.dataSource) return

  isSaving.value = true
  try {
    const configPayload = {
      advanced_config: advancedConfig.value.map((t) => ({
        table: t.table,
        fields: t.fields.map((f) => ({
          name: f.name,
          alias: f.alias,
          enums:
            f.enums.length > 0
              ? f.enums.reduce(
                  (acc, curr) => (curr.value ? { ...acc, [curr.value]: curr.label } : acc),
                  {},
                )
              : undefined,
          masking:
            f.masking.type !== 'none'
              ? {
                  type: f.masking.type,
                  rule: f.masking.type === 'custom' ? f.masking.rule : undefined,
                  replace: f.masking.type === 'custom' ? f.masking.replace : undefined,
                }
              : undefined,
        })),
      })),
    }

    const ds: any = props.dataSource
    const existingConfig = ds.config || {}
    const newConfig = { ...existingConfig, ...configPayload }

    const payload = {
      name: props.dataSource.name,
      type: props.dataSource.type,
      host: props.dataSource.host,
      port: props.dataSource.port,
      username: props.dataSource.username,
      database: props.dataSource.database,
      config: newConfig,
    }

    await api.put(`/data-sources/${props.dataSource.id}`, payload)
    toast.success('Configuration saved successfully')
    emit('success')
    emit('update:open', false)
  } catch (error: any) {
    toast.error('Failed to save configuration: ' + (error.response?.data?.message || error.message))
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
      <DialogHeader class="p-6 pb-4 border-b shrink-0">
        <DialogTitle>{{ t('data_sources.advanced_settings') }}</DialogTitle>
        <DialogDescription>
          {{ t('data_sources.desc') }} <strong>{{ dataSource?.name }}</strong
          >.
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto min-h-0 p-6">
        <div class="space-y-6">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-medium">{{ t('data_sources.table_config_title') }}</h3>
            <Button type="button" variant="outline" size="sm" @click="addTableConfig">
              + {{ t('data_sources.add_table') }}
            </Button>
          </div>

          <div class="space-y-4">
            <div
              v-for="(table, tIndex) in advancedConfig"
              :key="tIndex"
              class="border rounded-lg p-4 bg-muted/30"
            >
              <div class="flex gap-2 mb-3">
                <div class="flex-1">
                  <Label>{{ t('data_sources.table_name') }}</Label>
                  <Input v-model="table.table" placeholder="e.g. users" class="h-8 mt-1" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 mt-7 text-destructive"
                  @click="removeTableConfig(tIndex)"
                >
                  <span class="sr-only">Remove</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-trash-2"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" x2="10" y1="11" y2="17" />
                    <line x1="14" x2="14" y1="11" y2="17" />
                  </svg>
                </Button>
              </div>

              <div class="space-y-3 pl-2 border-l-2 border-muted">
                <div class="flex justify-between items-center">
                  <Label class="text-xs text-muted-foreground">{{
                    t('data_sources.fields_config')
                  }}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="h-6 px-2 text-xs"
                    @click="addFieldConfig(tIndex)"
                    >+ {{ t('data_sources.add_field') }}</Button
                  >
                </div>

                <div
                  v-for="(field, fIndex) in table.fields"
                  :key="fIndex"
                  class="space-y-2 p-2 bg-background rounded border"
                >
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <Label class="text-xs">{{ t('data_sources.original_field') }}</Label>
                      <Input v-model="field.name" placeholder="status" class="h-7 text-sm" />
                    </div>
                    <div>
                      <Label class="text-xs">{{ t('data_sources.display_alias') }}</Label>
                      <div class="flex gap-1">
                        <Input v-model="field.alias" placeholder="Status" class="h-7 text-sm" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          class="h-7 w-7 text-destructive shrink-0"
                          @click="removeFieldConfig(tIndex, fIndex)"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="lucide lucide-x"
                          >
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>

                  <!-- Masking Config -->
                  <div class="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <Label class="text-xs">{{ t('data_sources.data_masking') }}</Label>
                      <Select v-model="field.masking.type">
                        <SelectTrigger class="h-7 text-xs w-full">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            v-for="type in maskingTypes"
                            :key="type.value"
                            :value="type.value"
                          >
                            {{ type.label }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div v-if="field.masking.type === 'custom'" class="flex gap-1">
                      <div class="flex-1">
                        <Label class="text-xs">{{ t('data_sources.regex') }}</Label>
                        <Input
                          v-model="field.masking.rule"
                          placeholder="^(\d{3}).*$"
                          class="h-7 text-xs"
                        />
                      </div>
                      <div class="w-16">
                        <Label class="text-xs">{{ t('data_sources.replace') }}</Label>
                        <Input
                          v-model="field.masking.replace"
                          placeholder="$1***"
                          class="h-7 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="mt-2">
                    <Label class="text-xs">{{ t('data_sources.enum_mapping') }}</Label>
                    <div class="space-y-1 mt-1">
                      <div
                        v-for="(enumItem, eIndex) in field.enums"
                        :key="eIndex"
                        class="flex gap-2 items-center"
                      >
                        <Input v-model="enumItem.value" placeholder="1" class="h-6 text-xs w-1/3" />
                        <span class="text-muted-foreground">→</span>
                        <Input
                          v-model="enumItem.label"
                          placeholder="Active"
                          class="h-6 text-xs flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          class="h-6 w-6 text-destructive"
                          @click="removeEnum(tIndex, fIndex, eIndex)"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="lucide lucide-x"
                          >
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                          </svg>
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="ml-auto block h-6 px-2 text-xs"
                        @click="addEnum(tIndex, fIndex)"
                        >+ {{ 'data_sources.add_enum' }}</Button
                      >
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="advancedConfig.length === 0"
              class="text-center py-6 text-muted-foreground text-sm"
            >
              {{ t('data_sources.no_advanced_config') }}
            </div>
          </div>
        </div>
      </div>

      <div class="p-6 pt-4 border-t flex justify-end gap-2 bg-background">
        <Button variant="ghost" @click="emit('update:open', false)">{{
          t('common.cancel')
        }}</Button>
        <Button @click="saveConfig" :disabled="isSaving">
          {{ isSaving ? t('common.saving') : t('data_sources.save_config') }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
