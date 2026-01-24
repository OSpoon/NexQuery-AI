<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue'
import * as monaco from 'monaco-editor'
import { Braces, Eraser, CheckCircle2, AlertCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import {
  setupMonacoSql,
  registerSchema,
  unregisterSchema,
  type Schema,
} from '@/lib/monaco-sql-init'

const props = defineProps<{
  modelValue: string
  language?: string
  variables?: Array<{ name: string; description?: string }>
  dbType?: string
  dataSourceId?: number
}>()

const emit = defineEmits(['update:modelValue', 'run'])

const editorRef = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null
const currentSchema = ref<Schema>([])
const syntaxError = ref<string | null>(null)
let variableProvider: monaco.IDisposable | null = null

// Compute Language ID for Monaco
const monacoLanguage = computed(() => {
  if (props.language && props.language !== 'sql') return props.language // shell, json
  if (props.dbType === 'postgresql') return 'pgsql'
  return 'mysql' // Default to mysql for SQL
})

const fetchSchema = async () => {
  if (!props.dataSourceId || props.language === 'shell' || props.language === 'json') return
  try {
    const response = await api.get(`/data-sources/${props.dataSourceId}/schema`)
    currentSchema.value = response.data
    // Update Registry if editor exists
    if (editor) {
      registerSchema(editor.getModel()!.uri.toString(), currentSchema.value)
    }
  } catch (error) {
    console.error('Failed to fetch schema:', error)
  }
}

const registerVariableProvider = () => {
  if (variableProvider) {
    variableProvider.dispose()
    variableProvider = null
  }

  if (!props.variables || props.variables.length === 0) return

  // Register a simple provider just for variables
  // Use the computed language
  variableProvider = monaco.languages.registerCompletionItemProvider(monacoLanguage.value, {
    triggerCharacters: ['{'],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const suggestions: monaco.languages.CompletionItem[] = []
      props.variables?.forEach((v) => {
        suggestions.push({
          label: `{{${v.name}}}`,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: `{{${v.name}}}`,
          detail: v.description || 'Variable',
          sortText: '0_' + v.name, // Top priority
          range,
        })
      })
      return { suggestions }
    },
  })
}

import { format } from 'sql-formatter'

// ...

const formatSql = () => {
  if (!editor) return
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
      formatted = formatted.replace(new RegExp(key, 'g'), placeholders[key])
    })

    editor.setValue(formatted)
  } catch (e) {
    console.error('Format failed:', e)
    // Fallback to basic monaco format if available (though likely failed)
    editor.getAction('editor.action.formatDocument')?.run()
  }
}

const validateSql = () => {
  if (!editor) return
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
  // Monaco markers are async, but if they exist, we must block save
  const model = editor.getModel()
  if (model) {
    const markers = monaco.editor.getModelMarkers({ resource: model.uri })
    const error = markers.find((m) => m.severity === monaco.MarkerSeverity.Error)
    if (error) {
      syntaxError.value = error.message
      return
    }
  }

  // Reset if no manual errors and no parser errors
  syntaxError.value = null
}

onMounted(() => {
  setupMonacoSql() // Initialize global language features

  nextTick(() => {
    if (editorRef.value) {
      editor = monaco.editor.create(editorRef.value, {
        value: props.modelValue,
        language: monacoLanguage.value,
        theme: 'vs-dark-premium',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineHeight: 22,
        scrollBeyondLastLine: false,
        padding: { top: 12, bottom: 12 },
        hover: {
          enabled: true,
          delay: 300,
          sticky: true,
          above: false,
        },
        unicodeHighlight: { ambiguousCharacters: false },
        fixedOverflowWidgets: false,
        roundedSelection: true,
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        fontFamily: "'Fira Code', 'Monaco', 'Cascadia Code', monospace",
        fontLigatures: true,
      })

      // Register Schema for this editor instance
      if (currentSchema.value.length > 0) {
        registerSchema(editor.getModel()!.uri.toString(), currentSchema.value)
      }

      fetchSchema()
      registerVariableProvider()

      monaco.editor.defineTheme('vs-dark-premium', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'custom-variable', foreground: 'FFD700', fontStyle: 'bold' },
          { token: 'keyword', foreground: 'C586C0' },
          { token: 'string', foreground: 'CE9178' },
          { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        ],
        colors: {
          'editor.background': '#1e1e1e',
          'editor.lineHighlightBackground': '#2d2d2d',
        },
      })
      monaco.editor.setTheme('vs-dark-premium')

      // Listen for Model Markers (Errors) to update UI
      const model = editor.getModel()
      if (model) {
        monaco.editor.onDidChangeMarkers(([uri]) => {
          if (uri.toString() === model.uri.toString()) {
            const markers = monaco.editor.getModelMarkers({ resource: uri })
            const error = markers.find((m) => m.severity === monaco.MarkerSeverity.Error)
            if (error && !syntaxError.value) {
              // Don't overwrite Chinese char error if present (handled in validateSql)
              // Actually validateSql runs on content change.
              // Let's rely on markers.
              syntaxError.value = error.message
            } else if (!error && !fullWidthChars.test(editor?.getValue() || '')) {
              syntaxError.value = null
            }
          }
        })
      }

      editor.onDidChangeModelContent(() => {
        const value = editor?.getValue() || ''
        emit('update:modelValue', value)
        validateSql()
      })
    }
  })
})

const fullWidthChars = /[；，。“”（）]/ // Moved out to be accessible

watch(
  () => props.modelValue,
  (newValue) => {
    if (editor && newValue !== editor.getValue()) {
      editor.setValue(newValue)
    }
  },
)

// Watch for DB Type or Language changes to update Editor Language
watch(
  () => [props.dbType, props.language],
  () => {
    if (editor) {
      const model = editor.getModel()
      if (model) {
        monaco.editor.setModelLanguage(model, monacoLanguage.value)
        registerVariableProvider() // Re-register for new language
      }
    }
  },
)

watch(
  () => [props.dataSourceId],
  () => {
    fetchSchema()
  },
)

const clearSql = () => {
  editor?.setValue('')
}

const insertVariable = (variableName: string) => {
  if (!editor) return
  const selection = editor.getSelection()
  const text = `{{${variableName}}}`
  const op = { range: selection!, text: text, forceMoveMarkers: true }
  editor.executeEdits('insert-variable', [op])
  editor.focus()
}

onBeforeUnmount(() => {
  if (editor) {
    const model = editor.getModel()
    if (model) {
      unregisterSchema(model.uri.toString())
    }
    editor.dispose()
  }
  if (variableProvider) {
    variableProvider.dispose()
  }
})

defineExpose({
  validate: () => {
    validateSql()
    return !syntaxError.value
  },
})
</script>

<template>
  <div class="flex flex-col border rounded-md overflow-hidden h-full min-h-[380px]">
    <div class="flex items-center justify-between px-2 py-1 bg-muted/30 border-b">
      <div class="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Format"
          @click="formatSql"
          class="h-8 w-8"
        >
          <Braces class="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Clear"
          @click="clearSql"
          class="h-8 w-8 text-destructive"
        >
          <Eraser class="h-4 w-4" />
        </Button>
        <div class="h-4 w-px bg-border mx-1"></div>
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
      <div class="flex items-center gap-2" v-if="variables && variables.length > 0">
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
    <div ref="editorRef" class="w-full flex-1"></div>
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
