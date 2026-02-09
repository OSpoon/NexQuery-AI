<script setup lang="ts">
import { AlertCircle, Braces as BracesIcon, CheckCircle2, Eraser } from 'lucide-vue-next'
import { format } from 'sql-formatter'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'

import { getSqlExtensions } from '@/lib/codemirror-extensions'
import CodeMirrorEditor from './CodeMirrorEditor.vue'

const props = withDefaults(defineProps<{
  modelValue: string
  language?: string
  variables?: Array<{ name: string, description?: string }>
  dbType?: string
  dataSourceId?: number
  readonly?: boolean
  hideToolbar?: boolean
}>(), {
})
const emit = defineEmits(['update:modelValue', 'run'])

const fullWidthChars = /[；，。“”（）]/

const editorRef = ref<any>(null)
const currentSchema = ref<any>([])
const syntaxError = ref<string | null>(null)

// Compute Extensions for CodeMirror
const extensions = computed(() => {
  if (props.language === 'shell' || props.language === 'json') {
    return []
  }
  return getSqlExtensions(props.dbType || 'mysql', currentSchema.value, props.variables, formatSql)
})

const isLoadingSchema = ref(false)
async function fetchSchema() {
  if (!props.dataSourceId || props.language === 'shell' || props.language === 'json' || isLoadingSchema.value)
    return

  isLoadingSchema.value = true
  try {
    const response = await api.get(`/data-sources/${props.dataSourceId}/schema`)
    currentSchema.value = response.data
  }
  catch (error) {
    console.error('Failed to fetch schema:', error)
  }
  finally {
    isLoadingSchema.value = false
  }
}

function onEditorMount(_view: any) {
  if (currentSchema.value.length === 0) {
    fetchSchema()
  }
}

function formatSql() {
  try {
    // Mask variables with a placeholder that SQL formatter handles safely
    const variables: string[] = []
    const maskedValue = props.modelValue.replace(/\{\{.*?\}\}/g, (match) => {
      variables.push(match)
      return `__TPL_VAR_${variables.length - 1}__`
    })

    const formatted = format(maskedValue, {
      language: props.dbType === 'postgresql' ? 'postgresql' : 'mysql',
      keywordCase: 'upper',
      linesBetweenQueries: 2,
    })

    // Unmask variables
    const finalValue = formatted.replace(/__TPL_VAR_(\d+)__/g, (_, index) => {
      return variables[Number(index)] || `__TPL_VAR_${index}__`
    })

    emit('update:modelValue', finalValue)
  }
  catch (e) {
    console.error('Format failed:', e)
  }
}

function validateSql() {
  if (fullWidthChars.test(props.modelValue)) {
    syntaxError.value = '检测到中文全角符号（如 ：，。），请切换到英文输入法。'
  }
  else {
    syntaxError.value = null
  }
}

function clearSql() {
  emit('update:modelValue', '')
}

function insertVariable(variableName: string) {
  const view = editorRef.value?.getView()
  if (!view)
    return

  const selection = view.state.selection.main
  const text = `{{${variableName}}}`

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: text },
    selection: { anchor: selection.from + text.length },
    userEvent: 'input.type',
  })
  view.focus()
}

watch(() => props.modelValue, () => {
  validateSql()
})

watch(() => props.dataSourceId, () => {
  fetchSchema()
})

defineExpose({
  formatSql,
  validateSql,
  insertVariable,
  validate: () => {
    validateSql()
    return !syntaxError.value
  },
})
</script>

<template>
  <div
    class="flex flex-col border rounded-md overflow-hidden h-full min-h-[380px] font-mono text-sm shadow-inner group transition-colors duration-200 bg-white border-zinc-200"
    :class="[
      { 'min-h-[150px]': hideToolbar, 'border-red-900/50': syntaxError },
    ]"
  >
    <!-- Toolbar -->
    <div
      v-if="!hideToolbar"
      class="flex h-10 items-center justify-between border-b px-3 py-1 transition-colors bg-zinc-50 border-zinc-200"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex h-6 items-center gap-1.5 rounded-md border px-2 text-[10px] font-bold tracking-wider bg-white border-zinc-200 text-zinc-500"
        >
          <div class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {{ language === 'shell' ? 'SHELL' : language === 'json' ? 'JSON' : 'SQL' }}
        </div>
        <div v-if="dbType && language !== 'shell'" class="text-[10px] text-zinc-500 uppercase tracking-tighter opacity-60">
          {{ dbType }}
        </div>
      </div>

      <div class="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="h-7 w-7 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200"
          title="Format SQL"
          @click="formatSql"
        >
          <BracesIcon class="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="h-7 w-7 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200"
          title="Clear"
          @click="clearSql"
        >
          <Eraser class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>

    <!-- Variable Hints (Read-only) -->
    <div
      v-if="variables && variables.length > 0 && !hideToolbar"
      class="flex items-center gap-2 px-3 py-1.5 border-b overflow-x-auto no-scrollbar bg-zinc-50/50 border-zinc-200"
    >
      <span class="text-[10px] text-zinc-500 uppercase font-bold whitespace-nowrap">Variables:</span>
      <div class="flex gap-1.5">
        <span
          v-for="v in variables"
          :key="v.name"
          class="inline-flex items-center h-5 px-2 text-[10px] font-medium rounded border select-all cursor-default bg-white border-zinc-300 text-zinc-600 shadow-sm"
          :title="v.description || v.name"
        >
          {{ v.name }}
        </span>
      </div>
    </div>

    <!-- Editor Container -->
    <div class="relative flex-1 overflow-hidden min-h-[120px]">
      <CodeMirrorEditor
        ref="editorRef"
        :model-value="modelValue"
        :readonly="readonly"
        :extensions="extensions"
        :dark="false"
        @update:model-value="emit('update:modelValue', $event)"
        @mount="onEditorMount"
      />

      <!-- Error Overlay -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-1 opacity-0"
      >
        <div v-if="syntaxError" class="absolute bottom-2 left-2 right-2 flex items-start gap-2 rounded border p-2 text-[11px] backdrop-blur-md shadow-xl z-50 transition-all duration-300 border-red-200 bg-red-50/95 text-red-700 shadow-red-200/20">
          <AlertCircle class="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
          <span class="leading-relaxed">{{ syntaxError }}</span>
        </div>
      </Transition>

      <!-- Empty State Hint -->
      <div v-if="!modelValue && !readonly" class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10 select-none">
        <div class="flex flex-col items-center gap-3">
          <div class="flex flex-col items-center gap-3">
            <BracesIcon class="h-10 w-10 text-zinc-200" />
            <p v-pre class="text-[11px] font-medium text-zinc-300">
              输入 SQL 或使用 {{变量}}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Status -->
    <div v-if="!hideToolbar" class="flex h-6 items-center justify-between border-t px-2 text-[10px] transition-colors bg-zinc-50 border-zinc-200 text-zinc-500">
      <div class="flex items-center gap-3">
        <div v-if="dataSourceId" class="flex items-center gap-1">
          <CheckCircle2 class="h-3 w-3 text-emerald-500/70" />
          <span class="font-medium text-zinc-600">Schema Sync</span>
        </div>
        <div v-if="variables?.length" class="flex items-center gap-1">
          <BracesIcon class="h-3 w-3 text-amber-500/70" />
          <span class="font-medium text-zinc-600">{{ variables.length }} Vars</span>
        </div>
      </div>
      <div class="opacity-60 italic text-zinc-400">
        Powered by CodeMirror 6
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
