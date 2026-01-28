<script setup lang="ts">
import BpmnViewer from 'bpmn-js/lib/NavigatedViewer'
import { Maximize, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Button } from '@/components/ui/button'

// Import bpmn-js styles
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'
import 'bpmn-js/dist/assets/bpmn-js.css'

const props = defineProps<{
  xml: string
  activeNodes?: string[] // IDs of nodes to highlight (e.g., current task)
}>()

const container = ref<HTMLElement | null>(null)
const viewer = shallowRef<any>(null)
const loading = ref(false)

async function renderDiagram() {
  if (!viewer.value || !props.xml || !props.xml.trim())
    return

  loading.value = true
  try {
    await viewer.value.importXML(props.xml)

    // Ensure container has dimensions before zooming
    const canvas = viewer.value.get('canvas')

    // Small delay to let the browser compute layout
    setTimeout(() => {
      try {
        const { width, height } = container.value?.getBoundingClientRect() || { width: 0, height: 0 }
        if (width > 0 && height > 0) {
          canvas.zoom('fit-viewport')
        }
      }
      catch (e) {
        console.warn('Initial zoom failed, might be zero-dimension container', e)
      }
    }, 100)

    // Apply highlighting
    applyHighlighting()
  }
  catch (err) {
    console.error('Failed to render BPMN:', err)
  }
  finally {
    loading.value = false
  }
}

function applyHighlighting() {
  if (!viewer.value || !props.activeNodes)
    return

  const canvas = viewer.value.get('canvas')
  props.activeNodes.forEach((nodeId) => {
    try {
      canvas.addMarker(nodeId, 'highlight-node')
    }
    catch {
      // Node might not exist in this version
    }
  })
}

function handleZoomIn() {
  viewer.value?.get('canvas').zoom(viewer.value.get('canvas').zoom() * 1.2)
}

function handleZoomOut() {
  viewer.value?.get('canvas').zoom(viewer.value.get('canvas').zoom() * 0.8)
}

function handleReset() {
  viewer.value?.get('canvas').zoom('fit-viewport')
}

watch(() => props.xml, renderDiagram)
watch(() => props.activeNodes, applyHighlighting, { deep: true })

onMounted(() => {
  if (container.value) {
    viewer.value = new BpmnViewer({
      container: container.value,
      height: '100%',
      width: '100%',
    })
    renderDiagram()
  }
})

onBeforeUnmount(() => {
  if (viewer.value) {
    viewer.value.destroy()
  }
})

defineExpose({
  getViewer: () => viewer.value,
})
</script>

<template>
  <div class="relative w-full h-full border rounded-lg bg-white overflow-hidden group">
    <!-- Canvas Container -->
    <div ref="container" class="w-full h-full" />

    <!-- Controls Overlay -->
    <div class="absolute bottom-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <div class="flex flex-col bg-background/80 backdrop-blur shadow-sm border rounded-md p-1">
        <Button variant="ghost" size="icon" class="h-8 w-8" title="Zoom In" @click="handleZoomIn">
          <ZoomIn class="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" class="h-8 w-8" title="Zoom Out" @click="handleZoomOut">
          <ZoomOut class="h-4 w-4" />
        </Button>
        <div class="h-px bg-border my-1" />
        <Button variant="ghost" size="icon" class="h-8 w-8" title="Fit Viewport" @click="handleReset">
          <Maximize class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="loading" class="absolute inset-0 bg-white/50 flex items-center justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  </div>
</template>

<style>
/* Highlighting styles - Premium Blue Theme */
.highlight-node:not(.djs-connection) .djs-visual > :nth-child(1) {
  fill: rgba(59, 130, 246, 0.1) !important; /* Blue-500 with low opacity */
  stroke: #3b82f6 !important; /* Blue-500 */
  stroke-width: 3px !important;
  filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.4));
}

/* Fix for bpmn-js layout in flex/relative containers */
.bjs-powered-by {
  display: none; /* Hide branding to keep it premium, or keep it if desired */
}
</style>
