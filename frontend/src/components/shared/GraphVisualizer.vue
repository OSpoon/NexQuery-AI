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
    theme: 'base',
    themeVariables: {
      primaryColor: '#f1f5f9',
      primaryTextColor: '#1e293b',
      primaryBorderColor: '#cbd5e1',
      lineColor: '#94a3b8',
      secondaryColor: '#f8fafc',
      tertiaryColor: '#f1f5f9',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '12px',
    },
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis',
      nodeSpacing: 50,
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
  <div class="mermaid-viewer w-full bg-muted/10 rounded-xl p-4 border border-border/40 shadow-sm overflow-hidden">
    <div ref="container" class="flex justify-center items-center min-h-[180px] transition-all duration-500" v-html="svgContent" />
  </div>
</template>

<style scoped>
.mermaid-viewer :deep(svg) {
  max-width: 100%;
  height: auto;
  filter: drop-shadow(0 4px 6px -1px rgb(0 0 0 / 0.05));
}

/* Global Node Styling */
.mermaid-viewer :deep(.node rect),
.mermaid-viewer :deep(.node circle),
.mermaid-viewer :deep(.node polygon),
.mermaid-viewer :deep(.node path) {
  stroke-width: 1.5px !important;
  transition: all 0.3s ease;
}

/* Specialized Node Colors */
.mermaid-viewer :deep([id*="supervisor"] rect) {
  fill: #f8fafc !important;
  stroke: #64748b !important;
}

.mermaid-viewer :deep([id*="sql_agent"] rect),
.mermaid-viewer :deep([id*="es_agent"] rect) {
  fill: #eef2ff !important;
  stroke: #6366f1 !important;
}

.mermaid-viewer :deep([id*="respond_directly"] rect) {
  fill: #f9fafb !important;
  stroke: #9ca3af !important;
  stroke-dasharray: 4 !important;
}

/* Start/End Nodes Styling (Pills) */
.mermaid-viewer :deep([id*="__start__"] rect),
.mermaid-viewer :deep([id*="__end__"] rect) {
  rx: 20 !important;
  ry: 20 !important;
  fill: #f1f5f9 !important;
  stroke: #cbd5e1 !important;
}

/* Highlight Active Node */
.mermaid-viewer :deep(.activeNode rect),
.mermaid-viewer :deep(.activeNode circle),
.mermaid-viewer :deep(.activeNode polygon),
.mermaid-viewer :deep(.activeNode path) {
  fill: #2563eb !important; /* Premium Blue */
  stroke: #3b82f6 !important;
  stroke-width: 3px !important;
  filter: drop-shadow(0 0 12px rgba(37, 99, 235, 0.4));
}

.mermaid-viewer :deep(.activeNode .nodeLabel),
.mermaid-viewer :deep(.activeNode text) {
  fill: white !important;
  color: white !important;
  font-weight: 600 !important;
}

/* Smooth edges */
.mermaid-viewer :deep(.edgePath .path) {
  stroke: #94a3b8 !important;
  stroke-width: 1.5px !important;
}

.mermaid-viewer :deep(.marker) {
  fill: #94a3b8 !important;
}
</style>
