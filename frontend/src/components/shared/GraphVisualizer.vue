<script setup lang="ts">
import mermaid from 'mermaid'
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{
  mermaidString: string
  activeNodeName?: string
}>()

const container = ref<HTMLElement | null>(null)
const svgContent = ref('')

const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`

async function renderGraph() {
  if (!props.mermaidString)
    return

  // Highlighting logic:
  let finalString = props.mermaidString

  // Mermaid.drawMermaid nodes usually have IDs like node1, node2...
  // However, LangGraph usually uses descriptive names if provided.
  // We need to match activeNodeName with the ID in mermaid string.

  if (props.activeNodeName) {
    if (finalString.includes(props.activeNodeName)) {
      finalString += `\nclass ${props.activeNodeName} activeNode;`
    }
  }

  try {
    const { svg } = await mermaid.render(id, finalString)
    svgContent.value = svg
  }
  catch (error) {
    console.error('Mermaid render error:', error)
  }
}

onMounted(() => {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis',
      nodeSpacing: 40,
      rankSpacing: 40,
      padding: 15,
    },
  })
  renderGraph()
})

watch(() => [props.mermaidString, props.activeNodeName], () => {
  renderGraph()
})
</script>

<template>
  <div class="mermaid-viewer w-full bg-muted/5 rounded-[var(--radius)] p-4 border border-border/60 shadow-sm overflow-hidden">
    <div ref="container" class="flex justify-center items-center min-h-[160px] transition-all duration-300" v-html="svgContent" />
  </div>
</template>

<style scoped>
.mermaid-viewer :deep(svg) {
  max-width: 100%;
  height: auto;
}

/* Global Node Styling */
.mermaid-viewer :deep(.node rect),
.mermaid-viewer :deep(.node circle),
.mermaid-viewer :deep(.node polygon),
.mermaid-viewer :deep(.node path) {
  stroke-width: 1px !important;
  rx: var(--radius-sm) !important;
  ry: var(--radius-sm) !important;
  fill: var(--card) !important;
  stroke: var(--border) !important;
  transition: all 0.2s ease-in-out;
}

/* Supervisor Node - Subtle Background */
.mermaid-viewer :deep([id*="supervisor"] rect) {
  fill: var(--muted) !important;
  stroke: var(--border) !important;
}

/* Specialist Agents */
.mermaid-viewer :deep([id*="sql_agent"] rect),
.mermaid-viewer :deep([id*="es_agent"] rect) {
  fill: var(--card) !important;
  stroke: var(--border) !important;
}

/* Start/End Nodes */
.mermaid-viewer :deep([id*="__start__"] rect),
.mermaid-viewer :deep([id*="__end__"] rect) {
  rx: 30 !important;
  ry: 30 !important;
  fill: var(--secondary) !important;
  stroke: var(--border) !important;
}

/* Respond Directly */
.mermaid-viewer :deep([id*="respond_directly"] rect) {
  fill: transparent !important;
  stroke: var(--border) !important;
  stroke-dasharray: 4 !important;
}

/* Highlight Active Node - Border Color Change Only, No Bold */
.mermaid-viewer :deep(.node.activeNode rect),
.mermaid-viewer :deep(.node.activeNode circle),
.mermaid-viewer :deep(.node.activeNode polygon),
.mermaid-viewer :deep(.node.activeNode path) {
  fill: var(--card) !important;
  stroke: var(--primary) !important;
  stroke-width: 2px !important;
  stroke-opacity: 1 !important;
}

.mermaid-viewer :deep(.node.activeNode .nodeLabel),
.mermaid-viewer :deep(.node.activeNode text) {
  color: var(--primary) !important;
  fill: var(--primary) !important;
  font-weight: 500 !important;
}

/* Edges */
.mermaid-viewer :deep(.edgePath .path) {
  stroke: var(--border) !important;
  stroke-width: 1.5px !important;
}

.mermaid-viewer :deep(.marker) {
  fill: var(--border) !important;
  stroke: var(--border) !important;
}

/* Text Consistency */
.mermaid-viewer :deep(.nodeLabel),
.mermaid-viewer :deep(text) {
  color: var(--foreground) !important;
  fill: var(--foreground) !important;
  font-family: inherit !important;
  font-weight: 500 !important;
}
</style>
