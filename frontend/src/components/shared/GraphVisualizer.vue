<script setup lang="ts">
import { clamp, useEventListener } from '@vueuse/core'
import { RefreshCw, ZoomIn, ZoomOut } from 'lucide-vue-next'
import mermaid from 'mermaid'
import { computed, onMounted, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  mermaidString: string
  activeNodeName?: string
}>()

const container = ref<HTMLElement | null>(null)
const svgContent = ref('')

const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`

// Zoom and Pan state
const zoom = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const lastMousePos = { x: 0, y: 0 }

const transformStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${zoom.value})`,
  transition: isDragging.value ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)',
  cursor: isDragging.value ? 'grabbing' : 'grab',
}))

async function renderGraph() {
  if (!props.mermaidString)
    return

  // Highlighting logic:
  let finalString = props.mermaidString

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

const zoomPercentage = computed(() => `${Math.round(zoom.value * 100)}%`)

function startDrag(e: MouseEvent) {
  if (e.button !== 0)
    return // Only left click
  isDragging.value = true
  lastMousePos.x = e.clientX
  lastMousePos.y = e.clientY
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value)
    return
  translateX.value += e.clientX - lastMousePos.x
  translateY.value += e.clientY - lastMousePos.y
  lastMousePos.x = e.clientX
  lastMousePos.y = e.clientY
}

function endDrag() {
  isDragging.value = false
}

// VueUse for cleaner event management
useEventListener(window, 'mousemove', onDrag)
useEventListener(window, 'mouseup', endDrag)

function resetView() {
  zoom.value = 1
  translateX.value = 0
  translateY.value = 0
}

function zoomIn() {
  const oldZoom = zoom.value
  const newZoom = clamp(oldZoom * 1.2, 0.1, 5)
  zoom.value = newZoom
}

function zoomOut() {
  const oldZoom = zoom.value
  const newZoom = clamp(oldZoom * 0.8, 0.1, 5)
  zoom.value = newZoom
}

onMounted(() => {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: false,
      htmlLabels: true,
      curve: 'basis',
      nodeSpacing: 25,
      rankSpacing: 25,
      padding: 8,
    },
  })
  renderGraph()
})

watch(() => [props.mermaidString, props.activeNodeName], () => {
  renderGraph()
})
</script>

<template>
  <div class="mermaid-viewer relative w-full bg-muted/5 rounded-(--radius) border border-border/60 shadow-sm overflow-hidden group">
    <!-- Controls Overlay -->
    <div class="absolute right-2 top-2 z-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <div class="mb-1 text-[10px] font-mono bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded border shadow-sm text-center tabular-nums">
        {{ zoomPercentage }}
      </div>
      <Button variant="secondary" size="icon" class="h-8 w-8 rounded-md bg-background/80 backdrop-blur-sm border shadow-sm" title="Reset View" @click="resetView">
        <RefreshCw class="h-3.5 w-3.5" />
      </Button>
      <Button variant="secondary" size="icon" class="h-8 w-8 rounded-md bg-background/80 backdrop-blur-sm border shadow-sm" title="Zoom In" @click="zoomIn">
        <ZoomIn class="h-3.5 w-3.5" />
      </Button>
      <Button variant="secondary" size="icon" class="h-8 w-8 rounded-md bg-background/80 backdrop-blur-sm border shadow-sm" title="Zoom Out" @click="zoomOut">
        <ZoomOut class="h-3.5 w-3.5" />
      </Button>
    </div>

    <!-- Graph Surface -->
    <div
      ref="container"
      class="flex justify-center items-center min-h-[300px] max-h-[500px] overflow-hidden touch-none p-8"
      @mousedown="startDrag"
    >
      <div
        class="will-change-transform flex justify-center items-center"
        :style="transformStyle"
        v-html="svgContent"
      />
    </div>
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
.mermaid-viewer :deep([id*="es_agent"] rect),
.mermaid-viewer :deep([id*="discovery_agent"] rect),
.mermaid-viewer :deep([id*="generator_agent"] rect),
.mermaid-viewer :deep([id*="security_agent"] rect) {
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

/* Highlight Active Node */
.mermaid-viewer :deep(.node.activeNode rect),
.mermaid-viewer :deep(.node.activeNode circle),
.mermaid-viewer :deep(.node.activeNode polygon),
.mermaid-viewer :deep(.node.activeNode path) {
  fill: var(--primary) !important;
  fill-opacity: 0.1 !important;
  stroke: var(--primary) !important;
  stroke-width: 2.5px !important;
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
