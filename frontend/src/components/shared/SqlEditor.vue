<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as monaco from 'monaco-editor'
import { Braces, Eraser, CheckCircle2, AlertCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { format } from 'sql-formatter'
import api from '@/lib/api'
import 'monaco-sql-languages'
import { Parser } from 'node-sql-parser'

const parser = new Parser()

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
const currentSchema = ref<
  Array<{ name: string; columns: Array<{ name: string; type: string; comment: string }> }>
>([])
const syntaxError = ref<string | null>(null)
let providers: monaco.IDisposable[] = []

const sqlKeywords = [
  'SELECT',
  'FROM',
  'WHERE',
  'AND',
  'OR',
  'NOT',
  'NULL',
  'IS',
  'IN',
  'BETWEEN',
  'LIKE',
  'ORDER BY',
  'GROUP BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'OUTER JOIN',
  'ON',
  'AS',
  'DISTINCT',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'INSERT',
  'INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE',
  'CREATE',
  'TABLE',
  'DROP',
  'ALTER',
  'INDEX',
  'VIEW',
  'TRIGGER',
  'PROCEDURE',
  'FUNCTION',
  'DATABASE',
  'SCHEMA',
  'GRANT',
  'REVOKE',
  'WITH',
  'RECURSIVE',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'UNION',
  'ALL',
]

const fetchSchema = async () => {
  if (!props.dataSourceId || props.language === 'shell' || props.language === 'json') return
  try {
    const response = await api.get(`/data-sources/${props.dataSourceId}/schema`)
    currentSchema.value = response.data
  } catch (error) {
    console.error('Failed to fetch schema:', error)
  }
}

const registerProviders = () => {
  providers.forEach((p) => p.dispose())
  providers = []

  const lang = props.language || 'sql'

  const completionProvider = monaco.languages.registerCompletionItemProvider(lang, {
    triggerCharacters: [' ', '.', '{'],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const suggestions: monaco.languages.CompletionItem[] = []

      // Template Variables
      if (props.variables) {
        props.variables.forEach((v) => {
          suggestions.push({
            label: `{{${v.name}}}`,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: `{{${v.name}}}`,
            range,
            detail: v.description || '变量',
          })
        })
      }

      // Keyword Suggestions
      sqlKeywords.forEach((kw) => {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
          detail: 'Keyword',
        })
      })

      // Context Awareness Helpers
      const lineContent = model.getLineContent(position.lineNumber)
      const textBeforeCursor = lineContent
        .substring(0, position.column - 1)
        .trim()
        .toUpperCase()
      const isAfterFrom =
        textBeforeCursor.endsWith('FROM') ||
        textBeforeCursor.endsWith('JOIN') ||
        textBeforeCursor.endsWith('UPDATE') ||
        textBeforeCursor.endsWith('INTO')
      const isAfterSelect =
        textBeforeCursor.endsWith('SELECT') ||
        textBeforeCursor.endsWith('SET') ||
        textBeforeCursor.endsWith('WHERE') ||
        textBeforeCursor.endsWith('AND') ||
        textBeforeCursor.endsWith('OR') ||
        textBeforeCursor.endsWith(',')

      // Schema Awareness
      if (currentSchema.value.length > 0) {
        currentSchema.value.forEach((table) => {
          // Suggest tables only after FROM/JOIN etc, or if no specific context
          if (isAfterFrom || (!isAfterSelect && !textBeforeCursor.includes('.'))) {
            suggestions.push({
              label: table.name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: table.name,
              range,
              detail: 'Table',
              documentation: `Table: ${table.name}`,
            })
          }

          // Columns if we are after a dot (table.column) or in a SELECT/WHERE context
          const dotMatch = lineContent.substring(0, position.column - 1).match(/(\w+)\.$/)
          if (dotMatch) {
            const tableAlias = dotMatch[1]
            if (table.name === tableAlias) {
              table.columns.forEach((col) => {
                suggestions.push({
                  label: col.name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: col.name,
                  range,
                  detail: `${col.type}`,
                  documentation: col.comment || `Column of ${table.name}`,
                })
              })
            }
          } else if (isAfterSelect) {
            // Suggest all columns if we don't know the table yet but are in SELECT/WHERE
            table.columns.forEach((col) => {
              suggestions.push({
                label: col.name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col.name,
                range,
                detail: `${table.name}.${col.type}`,
                documentation: col.comment || `Column of ${table.name}`,
              })
            })
          }
        })
      }

      return { suggestions }
    },
  })
  providers.push(completionProvider)

  // Hover Provider (Advanced Schema Discovery)
  const hoverProvider = monaco.languages.registerHoverProvider(lang, {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position)
      if (!word) return null

      const tableName = currentSchema.value.find(
        (t) => t.name.toLowerCase() === word.word.toLowerCase(),
      )
      if (tableName) {
        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          ),
          contents: [
            { value: `**Table: ${tableName.name}**` },
            {
              value:
                tableName.columns
                  .map((c) => `- ${c.name} (${c.type}) ${c.comment ? '-- ' + c.comment : ''}`)
                  .slice(0, 10)
                  .join('\n') + (tableName.columns.length > 10 ? '\n... (more)' : ''),
            },
          ],
        }
      }

      // Check for columns across all tables
      for (const table of currentSchema.value) {
        const col = table.columns.find((c) => c.name.toLowerCase() === word.word.toLowerCase())
        if (col) {
          return {
            range: new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn,
            ),
            contents: [
              { value: `**Column: ${table.name}.${col.name}**` },
              { value: `Type: \`${col.type}\`` },
              { value: col.comment || 'No comment provided' },
            ],
          }
        }
      }

      return null
    },
  })
  providers.push(hoverProvider)

  if (lang !== 'shell') {
    const formatProvider = monaco.languages.registerDocumentFormattingEditProvider(lang, {
      provideDocumentFormattingEdits: (model) => {
        try {
          let value = model.getValue()
          const placeholders: Map<string, string> = new Map()

          value = value.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => {
            const placeholder = `__VAR_${name}_VAR__`
            placeholders.set(placeholder, match)
            return placeholder
          })

          let formatted = format(value, {
            language: props.dbType === 'postgresql' ? 'postgresql' : 'mysql',
            keywordCase: 'upper',
          })

          placeholders.forEach((original, placeholder) => {
            const regex = new RegExp(placeholder, 'g')
            formatted = formatted.replace(regex, original)
          })

          return [{ range: model.getFullModelRange(), text: formatted }]
        } catch (e) {
          return []
        }
      },
    })
    providers.push(formatProvider)
  }
}

const validateSql = () => {
  if (!editor || props.language === 'shell' || props.language === 'json') return
  const model = editor.getModel()
  if (!model) return

  const value = editor.getValue()
  const fullWidthChars = /[；，。“”（）]/
  if (fullWidthChars.test(value)) {
    const match = value.match(fullWidthChars)
    const char = match ? match[0] : ''
    syntaxError.value = `检测到非法的中文字符: "${char}"，请使用英文标点符号。`

    // Find position of the first full-width char
    const index = value.indexOf(char)
    const linesBefore = value.substring(0, index).split('\n')
    const lineNumber = linesBefore.length
    const lineContent = linesBefore[lineNumber - 1] || ''
    const columnNumber = lineContent.length + 1

    monaco.editor.setModelMarkers(model, 'sql-validation', [
      {
        severity: monaco.MarkerSeverity.Error,
        message: syntaxError.value,
        startLineNumber: lineNumber,
        startColumn: columnNumber,
        endLineNumber: lineNumber,
        endColumn: columnNumber + 1,
      },
    ])
    return
  }

  // Pre-process: replace {{variable}} with a dummy identifier
  const processedSql = value.replace(/\{\{\s*(\w+)\s*\}\}/g, '__variable__')

  try {
    const dbOption =
      props.dbType === 'postgresql' ? { database: 'PostgreSQL' } : { database: 'MySQL' }
    parser.astify(processedSql, dbOption)
    monaco.editor.setModelMarkers(model, 'sql-validation', [])
    syntaxError.value = null
  } catch (err: any) {
    let message = err.message
    if (message.includes('Expected') && message.includes('but') && message.includes('found')) {
      const parts = message.split('but')
      if (parts.length > 1) {
        let foundPart = parts[parts.length - 1].trim()
        foundPart = foundPart.replace('found', '').trim()
        message = `Syntax error at or near ${foundPart}`
      }
    }

    syntaxError.value = message
    const markers: monaco.editor.IMarkerData[] = []

    if (err.location) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: message,
        startLineNumber: err.location.start.line,
        startColumn: err.location.start.column,
        endLineNumber: err.location.end.line,
        endColumn: err.location.end.column,
      })
    } else {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: err.message,
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: model.getLineCount(),
        endColumn: model.getLineMaxColumn(model.getLineCount()),
      })
    }
    monaco.editor.setModelMarkers(model, 'sql-validation', markers)
  }
}

onMounted(() => {
  nextTick(() => {
    if (editorRef.value) {
      registerProviders()
      fetchSchema()

      editor = monaco.editor.create(editorRef.value, {
        value: props.modelValue,
        language: props.language || 'sql',
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
          sticky: true, // Critical: Allows moving mouse into the hover widget
          above: false, // Prefer below/to the side close to cursor
        },
        unicodeHighlight: { ambiguousCharacters: false },
        fixedOverflowWidgets: false, // Changed to false: Forces widget to render inside editor, usually closer to cursor
        roundedSelection: true,
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        fontFamily: "'Fira Code', 'Monaco', 'Cascadia Code', monospace",
        fontLigatures: true,
      })

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

      const lang = props.language || 'sql'
      if (lang !== 'shell' && lang !== 'json') {
        monaco.languages.setMonarchTokensProvider(lang, {
          tokenizer: {
            root: [
              [/\{\{\s*\w+\s*\}\}/, 'custom-variable'],
              [
                /[a-zA-Z_]\w*/,
                {
                  cases: {
                    '@keywords': 'keyword',
                    '@default': 'identifier',
                  },
                },
              ],
              [/[{}()\[\]]/, '@brackets'],
              [/[<>=\!]+/, 'operator'],
              [/\d+/, 'number'],
              [/'([^'\\]|\\.)*'/, 'string'],
              [/"([^"\\]|\\.)*"/, 'string'],
              [/\/\/.*$/, 'comment'],
              [/\/\*/, 'comment', '@comment'],
            ],
            comment: [
              [/[^\/*]+/, 'comment'],
              [/\*\//, 'comment', '@pop'],
              [/[\/*]/, 'comment'],
            ],
          },
          keywords: sqlKeywords,
        })
      }

      editor.onDidChangeModelContent(() => {
        const value = editor?.getValue() || ''
        emit('update:modelValue', value)
        validateSql()
      })

      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
        editor?.getAction('editor.action.formatDocument')?.run()
      })
    }
  })
})

watch(
  () => props.modelValue,
  (newValue) => {
    if (editor && newValue !== editor.getValue()) {
      editor.setValue(newValue)
    }
  },
)

watch(
  () => [props.variables, props.dbType, props.dataSourceId, props.language],
  () => {
    registerProviders()
    fetchSchema()
  },
  { deep: true },
)

const formatSql = () => {
  editor?.getAction('editor.action.formatDocument')?.run()
}

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
    editor.dispose()
  }
  providers.forEach((p) => p.dispose())
})

defineExpose({
  validate: () => {
    validateSql()
    return !syntaxError.value
  },
})
</script>

<template>
  <div class="flex flex-col border rounded-md overflow-hidden h-full min-h-[500px]">
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
  max-height: 300px !important;
}

.monaco-editor .monaco-hover .monaco-scrollable-element {
  max-height: 300px !important;
}
</style>
