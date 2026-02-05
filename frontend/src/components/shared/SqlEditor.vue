<script setup lang="ts">
import { AlertCircle, Braces, CheckCircle2, Eraser } from 'lucide-vue-next'
import * as monaco from 'monaco-editor'
import { format } from 'sql-formatter'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'

import {
  registerSchema,
  setupMonacoSql,
  unregisterSchema,
} from '@/lib/monaco-sql-init'
import MonacoEditor from './MonacoEditor.vue'

const props = defineProps<{
  modelValue: string
  language?: string
  variables?: Array<{ name: string, description?: string }>
  dbType?: string
  dataSourceId?: number
  readonly?: boolean
  hideToolbar?: boolean
}>()
const emit = defineEmits(['update:modelValue', 'run'])

const fullWidthChars = /[；，。“”（）]/

const monacoEditorRef = ref<any>(null)
const currentSchema = ref<any>([])
const syntaxError = ref<string | null>(null)

// Compute Language ID for Monaco
const monacoLanguage = computed(() => {
  if (props.language && props.language !== 'sql')
    return props.language // shell, json
  if (props.dbType === 'postgresql')
    return 'pgsql'
  return 'mysql' // Default to mysql for SQL
})

async function fetchSchema() {
  if (!props.dataSourceId || props.language === 'shell' || props.language === 'json')
    return
  try {
    const response = await api.get(`/data-sources/${props.dataSourceId}/schema`)
    currentSchema.value = response.data
    // Update Registry if editor exists
    const editor = monacoEditorRef.value?.getEditor()
    if (editor) {
      registerSchema(editor.getModel()!.uri.toString(), currentSchema.value)
    }
  }
  catch (error) {
    console.error('Failed to fetch schema:', error)
  }
}

function onEditorMount(editor: monaco.editor.IStandaloneCodeEditor) {
  setupMonacoSql()
  fetchSchema()

  const uri = monacoEditorRef.value?.getUri()
  if (uri && currentSchema.value.length > 0) {
    registerSchema(uri, currentSchema.value)
  }

  // Listen for Model Markers (Errors) to update UI
  const model = editor.getModel()
  if (model) {
    monaco.editor.onDidChangeMarkers(([mUri]) => {
      if (mUri && mUri.toString() === model.uri.toString()) {
        const markers = monaco.editor.getModelMarkers({ resource: mUri })
        const error = markers.find(m => m.severity === monaco.MarkerSeverity.Error)
        if (error && !syntaxError.value) {
          syntaxError.value = error.message
        }
        else if (!error && !fullWidthChars.test(editor.getValue())) {
          syntaxError.value = null
        }
      }
    })
  }

  editor.onDidChangeModelContent(() => {
    validateSql()
  })
}

function onEditorUnmount(_editor: monaco.editor.IStandaloneCodeEditor | null) {
  const uri = monacoEditorRef.value?.getUri()
  if (uri) {
    unregisterSchema(uri)
  }
}

function formatSql() {
  const editor = monacoEditorRef.value?.getEditor()
  if (!editor)
    return
  try {
    let value = editor.getValue()

    // Mask {{variables}} to avoid formatter errors
    // We replace {{var}} with "var_PLACEHOLDER" (identifier) to keep SQL valid
    const placeholders: Record<string, string> = {}
    let placeholderIdx = 0

    // Regex to capture {{...}}
    value = value.replace(/\{\{.*?\}\}/g, (match) => {
      const key = `__TEMPLATE_VAR_${placeholderIdx++}__`
      placeholders[key] = match
      // Return a valid SQL identifier
      return key
    })

    let formatted = format(value, {
      language: props.dbType === 'postgresql' ? 'postgresql' : 'mysql',
      keywordCase: 'upper',
      linesBetweenQueries: 2,
    })

    // Restore {{variables}}
    Object.keys(placeholders).forEach((key) => {
      // Formatter might upper case the identifier if likely
      // We need to match case insensitive just in case, or simpler:
      // Since we used __TEMPLATE_VAR_...__ which is distinct, plain replace should work
      // unless formatter put spaces? identifiers usually stick together.
      formatted = formatted.replace(new RegExp(key, 'g'), placeholders[key]!)
    })

    editor.setValue(formatted)
  }
  catch (e) {
    console.error('Format failed:', e)
    // Fallback to basic monaco format if available (though likely failed)
    editor.getAction('editor.action.formatDocument')?.run()
  }
}

function validateSql() {
  const editor = monacoEditorRef.value?.getEditor()
  if (!editor)
    return
  const value = editor.getValue()

  // 1. Check for Chinese Punctuation (Strict Error)
  const fullWidthChars = /[；，。“”（）]/
  if (fullWidthChars.test(value)) {
    const match = value.match(fullWidthChars)
    const char = match ? match[0] : ''
    syntaxError.value = `检测到非法的中文字符: "${char}"，请使用英文标点符号。`
    return
  }

  // 2. Safety Check (Warning)
  // Simple heuristic: DELETE/UPDATE without WHERE
  const upperVal = value.toUpperCase()
  // Strip comments and strings for better accuracy? (Simplified for now)
  if ((/\bDELETE\b/.test(upperVal) || /\bUPDATE\b/.test(upperVal)) && !/\bWHERE\b/.test(upperVal)) {
    syntaxError.value = '⚠️ 高风险警告: 检测到 DELETE/UPDATE 语句缺失 WHERE 子句！'
    return
  }

  // 3. Check Monaco Internal Markers (Syntax Errors from Parser)
  const model = editor.getModel()
  if (model) {
    const markers = monaco.editor.getModelMarkers({ resource: model.uri })
    const filteredErrors = markers.filter((m) => {
      if (m.severity !== monaco.MarkerSeverity.Error)
        return false

      // Ignore common syntax errors caused by template placeholders {{ }}
      const message = m.message.toLowerCase()
      if (
        message.includes('unexpected \'{\'')
        || message.includes('unexpected \'}\'')
        || (message.includes('expected') && (message.includes('{\'') || message.includes('}\'')))
      ) {
        return false
      }

      // Check the text at the error location
      const errText = model.getValueInRange({
        startLineNumber: m.startLineNumber,
        startColumn: m.startColumn,
        endLineNumber: m.endLineNumber,
        endColumn: m.endColumn,
      })

      if (errText.includes('{{') || errText.includes('}}'))
        return false

      // Fallback: If it's a generic "dt-sql-parser" error and the current line has placeholders
      const lineContent = model.getLineContent(m.startLineNumber)
      if (lineContent.includes('{{') && lineContent.includes('}}')) {
        // Only ignore if the error message is generic or related to symbols
        if (message.includes('dt-sql-parser') || /unexpected|expected/.test(message)) {
          return false
        }
      }

      return true
    })

    if (filteredErrors.length > 0) {
      syntaxError.value = filteredErrors[0].message
      return
    }
  }

  // Reset if no manual errors and no parser errors
  syntaxError.value = null
}

watch(
  () => [props.dataSourceId],
  () => {
    fetchSchema()
  },
)

function clearSql() {
  monacoEditorRef.value?.getEditor()?.setValue('')
}

function insertVariable(variableName: string) {
  const editor = monacoEditorRef.value?.getEditor()
  if (!editor)
    return
  const selection = editor.getSelection()
  const text = `{{${variableName}}}`
  const op = { range: selection!, text, forceMoveMarkers: true }
  editor.executeEdits('insert-variable', [op])
  editor.focus()
}

// Monaco lifecycle is managed by MonacoEditor.vue

defineExpose({
  validate: () => {
    validateSql()
    return !syntaxError.value
  },
})
</script>

<template>
  <div
    class="flex flex-col border rounded-md overflow-hidden h-full min-h-[380px]"
    :class="{ 'min-h-[150px]': hideToolbar }"
  >
    <div
      v-if="!hideToolbar"
      class="flex items-center justify-between px-2 py-1 bg-muted/30 border-b"
    >
      <div class="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Format"
          class="h-8 w-8"
          @click="formatSql"
        >
          <Braces class="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Clear"
          class="h-8 w-8 text-destructive"
          @click="clearSql"
        >
          <Eraser class="h-4 w-4" />
        </Button>
        <div class="h-4 w-px bg-border mx-1" />
        <div
          v-if="syntaxError"
          class="flex items-center text-destructive text-[10px] gap-1 px-1 max-w-[300px] truncate"
          :title="syntaxError"
        >
          <AlertCircle class="h-3 w-3 shrink-0" />
          <span class="truncate">Error</span>
        </div>
        <div v-else class="flex items-center text-green-600 text-[10px] gap-1 px-1">
          <CheckCircle2 class="h-3 w-3 shrink-0" />
          <span>{{ language === 'shell' ? 'Ready' : language === 'json' ? 'JSON' : 'SQL' }}</span>
        </div>
      </div>
      <div v-if="variables && variables.length > 0" class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">Insert:</span>
        <div class="flex gap-1">
          <Button
            v-for="v in variables"
            :key="v.name"
            type="button"
            variant="outline"
            size="sm"
            class="h-6 text-xs px-2"
            @click="insertVariable(v.name)"
          >
            {{ v.name }}
          </Button>
        </div>
      </div>
    </div>
    <MonacoEditor
      ref="monacoEditorRef"
      :model-value="modelValue"
      :language="monacoLanguage"
      :readonly="readonly"
      :variables="variables"
      class="flex-1"
      @update:model-value="emit('update:modelValue', $event)"
      @mount="onEditorMount"
      @unmount="onEditorUnmount"
    />
  </div>
</template>

<style>
.monaco-editor {
  padding-top: 8px;
}

/* Limit hover widget height */
.monaco-editor .monaco-hover {
  max-height: 180px !important;
}

.monaco-editor .monaco-hover .monaco-scrollable-element {
  max-height: 180px !important;
}
</style>
