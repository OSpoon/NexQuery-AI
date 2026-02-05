<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { registerVariables, setupVariableCompletion, unregisterVariables } from '@/lib/monaco-variable-init'

const props = withDefaults(defineProps<{
  modelValue: string
  language: string
  theme?: string
  readonly?: boolean
  fontSize?: number
  variables?: Array<{ name: string, description?: string }>
  automaticLayout?: boolean
}>(), {
  theme: 'vs-dark-premium',
  readonly: false,
  fontSize: 14,
  automaticLayout: true,
})

const emit = defineEmits(['update:modelValue', 'mount', 'unmount'])

const editorRef = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

// Use a unique ID for each editor instance to allow model isolation
const instanceId = Math.random().toString(36).substring(2, 9)
const modelUri = monaco.Uri.parse(`inmemory://model/${instanceId}.${props.language === 'pgsql' ? 'sql' : props.language === 'mysql' ? 'sql' : props.language}`)

// Define or ensure theme exists
function ensureTheme() {
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
}

function updateVariables() {
  if (props.variables && props.variables.length > 0) {
    registerVariables(modelUri.toString(), props.variables)
  }
  else {
    unregisterVariables(modelUri.toString())
  }
}

onMounted(() => {
  ensureTheme()
  setupVariableCompletion()

  nextTick(() => {
    if (editorRef.value) {
      // Create or get model with specific URI
      let model = monaco.editor.getModel(modelUri)
      if (!model) {
        model = monaco.editor.createModel(props.modelValue, props.language, modelUri)
      }
      else {
        model.setValue(props.modelValue)
      }

      editor = monaco.editor.create(editorRef.value, {
        model,
        theme: props.theme,
        automaticLayout: props.automaticLayout,
        minimap: { enabled: false },
        readOnly: props.readonly,
        fontSize: props.fontSize,
        lineHeight: 22,
        scrollBeyondLastLine: false,
        padding: { top: 12, bottom: 12 },
        hover: { enabled: true, delay: 300, sticky: true },
        unicodeHighlight: { ambiguousCharacters: false },
        fixedOverflowWidgets: false,
        roundedSelection: true,
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        fontFamily: '\'Fira Code\', \'Monaco\', \'Cascadia Code\', monospace',
        fontLigatures: true,
      })

      updateVariables()

      editor.onDidChangeModelContent(() => {
        emit('update:modelValue', editor?.getValue() || '')
      })

      emit('mount', editor)
    }
  })
})

watch(() => props.modelValue, (val) => {
  if (editor && val !== editor.getValue()) {
    editor.setValue(val)
  }
})

watch(() => props.language, (newLang) => {
  if (editor) {
    const model = editor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, newLang)
    }
  }
})

watch(() => props.readonly, (val) => {
  editor?.updateOptions({ readOnly: val })
})

watch(() => props.variables, () => {
  updateVariables()
}, { deep: true })

onBeforeUnmount(() => {
  emit('unmount', editor)
  if (editor) {
    const model = editor.getModel()
    if (model) {
      model.dispose()
    }
    editor.dispose()
  }
  unregisterVariables(modelUri.toString())
})

defineExpose({
  getEditor: () => editor,
  getUri: () => modelUri.toString(),
})
</script>

<template>
  <div ref="editorRef" v-bind="$attrs" class="w-full" />
</template>
