<script setup lang="ts">
import type { Extension } from '@codemirror/state'
import type { ViewUpdate } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, tooltips } from '@codemirror/view'
import { githubLight } from '@uiw/codemirror-theme-github'
import { basicSetup } from 'codemirror'
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  readonly?: boolean
  extensions?: Extension[]
}>(), {
})

const emit = defineEmits(['update:modelValue', 'change', 'mount', 'unmount'])

const editorRef = ref<HTMLElement | null>(null)
let view: EditorView | null = null

const readonlyConf = new Compartment()
const extensionsConf = new Compartment()
const themeConf = new Compartment()

const onUpdate = EditorView.updateListener.of((v: ViewUpdate) => {
  if (v.docChanged) {
    const value = v.state.doc.toString()
    emit('update:modelValue', value)
    emit('change', value)
  }
})

function createEditor() {
  if (!editorRef.value)
    return

  const startState = EditorState.create({
    doc: props.modelValue,
    extensions: [
      basicSetup,
      keymap.of([indentWithTab]),
      onUpdate,
      themeConf.of(githubLight),
      readonlyConf.of([
        props.readonly ? EditorState.readOnly.of(true) : [],
        EditorView.editable.of(!props.readonly),
      ]),
      extensionsConf.of(props.extensions || []),
      tooltips({ parent: document.body }),
    ],
  })

  view = new EditorView({
    state: startState,
    parent: editorRef.value,
  })

  emit('mount', view)
}

onMounted(() => {
  createEditor()
})

onUnmounted(() => {
  if (view) {
    emit('unmount', view)
    view.destroy()
    view = null
  }
})

// Watch for external content changes
watch(() => props.modelValue, (newVal) => {
  if (view && newVal !== view.state.doc.toString()) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newVal },
    })
  }
})

// Watch for extension changes - Use Compartment to reconfigure instead of destroy
watch(() => props.extensions, (newExts) => {
  if (view) {
    view.dispatch({
      effects: extensionsConf.reconfigure(newExts || []),
    })
  }
}, { deep: false }) // CM6 extensions are complex, deep watch can cause loops

// Watch for readonly changes
watch(() => props.readonly, (newVal) => {
  if (view) {
    view.dispatch({
      effects: readonlyConf.reconfigure([
        newVal ? EditorState.readOnly.of(true) : [],
        EditorView.editable.of(!newVal),
      ]),
    })
  }
})

defineExpose({
  getView: () => view,
  getDoc: () => view?.state.doc.toString() || '',
})
</script>

<template>
  <div ref="editorRef" class="cm-editor-container h-full w-full overflow-hidden" />
</template>

<style>
.cm-editor-container {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
}

.cm-editor-container .cm-editor {
  height: 100%;
}

.cm-editor-container .cm-scroller {
  overflow: auto;
}
</style>
