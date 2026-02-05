<script setup lang="ts">
import { AlertCircle, CheckCircle2, Eraser, HelpCircle } from 'lucide-vue-next'
import * as monaco from 'monaco-editor'
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { registerLuceneFields, setupLucene, unregisterLuceneFields } from '@/lib/monaco-lucene-init'
import MonacoEditor from './MonacoEditor.vue'

const props = defineProps<{
  modelValue: string
  variables?: Array<{ name: string, description?: string }>
  fields?: Array<{ name: string, type: string }>
  readonly?: boolean
  hideToolbar?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const monacoEditorRef = ref<any>(null)
const syntaxError = ref<string | null>(null)

const fullWidthChars = /[；，。“”（）]/

const luceneHelp = [
  { title: '基础 (Terms)', content: '`hello` (单词), `"hello world"` (短语)' },
  { title: '字段搜索 (Field)', content: '`level:50` (错误), `level:30` (信息)' },
  { title: '通配符 (Wildcards)', content: '`te?t` (单字), `test*` (多字)' },
  { title: '范围 (Ranges)', content: '`age:[18 TO 30]` (闭区间)' },
  { title: '逻辑 (Boolean)', content: '`AND`, `OR`, `NOT` (需大写)' },
  { title: '组合', content: '`(a OR b) AND c`' },
]

function updateLuceneFields() {
  const uri = monacoEditorRef.value?.getUri()
  if (uri && props.fields && props.fields.length > 0) {
    registerLuceneFields(uri, props.fields)
  }
}

watch(() => props.fields, () => {
  updateLuceneFields()
}, { deep: true })

function validateLucene() {
  const editor = monacoEditorRef.value?.getEditor()
  if (!editor)
    return
  const value = editor.getValue()

  // 1. Check for Chinese Punctuation
  if (fullWidthChars.test(value)) {
    const match = value.match(fullWidthChars)
    const char = match ? match[0] : ''
    syntaxError.value = `检测到非法中文字符: "${char}"，请使用英文标点。`
    return
  }

  // 2. Check Monaco Internal Markers
  const model = editor.getModel()
  if (model) {
    const markers = monaco.editor.getModelMarkers({ resource: model.uri })
    const error = markers.find(m => m.severity === monaco.MarkerSeverity.Error)
    if (error) {
      syntaxError.value = error.message
      return
    }
  }

  syntaxError.value = null
}

function onEditorMount(editor: monaco.editor.IStandaloneCodeEditor) {
  setupLucene()
  updateLuceneFields()

  // Listen for Model Markers
  const model = editor.getModel()
  if (model) {
    monaco.editor.onDidChangeMarkers(([uri]) => {
      if (uri && uri.toString() === model.uri.toString()) {
        validateLucene()
      }
    })
  }

  editor.onDidChangeModelContent(() => {
    validateLucene()
  })
}

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

defineExpose({
  validate: () => {
    validateLucene()
    return !syntaxError.value
  },
})

onBeforeUnmount(() => {
  const uri = monacoEditorRef.value?.getUri()
  if (uri) {
    unregisterLuceneFields(uri)
  }
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
          title="Clear"
          class="h-8 w-8 text-destructive"
          @click="clearSql"
        >
          <Eraser class="h-4 w-4" />
        </Button>
        <div class="h-4 w-px bg-border mx-1" />

        <Popover>
          <PopoverTrigger as-child>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Lucene Syntax Help"
              class="h-8 w-8 text-muted-foreground"
            >
              <HelpCircle class="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-80 p-0" side="bottom" align="start">
            <div class="bg-primary/5 p-3 border-b text-xs font-semibold flex items-center justify-between">
              <span>Lucene 语法快速参考</span>
            </div>
            <div class="p-2 grid gap-1.5">
              <div v-for="item in luceneHelp" :key="item.title" class="px-2 py-1.5 hover:bg-muted/50 rounded-sm transition-colors">
                <div class="text-[11px] font-medium text-primary mb-0.5">
                  {{ item.title }}
                </div>
                <div class="text-[10px] text-muted-foreground" v-html="item.content.replace(/`([^`]+)`/g, '<code class=\'bg-muted px-1 rounded text-foreground\'>$1</code>')" />
              </div>
              <div class="mt-1 pt-2 border-t px-2 text-[10px] text-muted-foreground italic">
                提示: 使用 <code v-pre>{{variable}}</code> 引用动态变量。
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div class="h-4 w-px bg-border mx-1" />
        <div
          v-if="syntaxError"
          class="flex items-center text-destructive text-[10px] gap-1 px-1 max-w-[200px] truncate"
          :title="syntaxError"
        >
          <AlertCircle class="h-3 w-3 shrink-0" />
          <span class="truncate">Error</span>
        </div>
        <div v-else class="flex items-center text-green-600 text-[10px] gap-1 px-1">
          <CheckCircle2 class="h-3 w-3 shrink-0" />
          <span>Lucene</span>
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
      language="lucene"
      :readonly="readonly"
      :variables="variables"
      class="flex-1 h-full"

      @update:model-value="emit('update:modelValue', $event)"
      @mount="onEditorMount"
    />
  </div>
</template>

<style>
.monaco-editor {
  padding-top: 8px;
}
</style>
