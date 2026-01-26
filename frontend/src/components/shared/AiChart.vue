<script setup lang="ts">
// Auto-resize when container size changes
import { useResizeObserver } from '@vueuse/core'
import * as echarts from 'echarts'
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  data: any[]
  type: 'bar' | 'line' | 'pie' | 'number' | 'table'
  config: {
    x?: string
    y?: string | string[]
    title?: string
  }
}>()

const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null

function initChart() {
  if (
    !chartRef.value
    || props.type === 'number'
    || props.type === 'table'
    || !props.data
    || props.data.length === 0
  ) {
    return
  }

  if (chartInstance) {
    chartInstance.dispose()
  }

  // Detect dark mode from document class
  const isDark = document.documentElement.classList.contains('dark')

  chartInstance = echarts.init(chartRef.value, isDark ? 'dark' : undefined)

  const option: any = {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: {
      trigger: props.type === 'pie' ? 'item' : 'axis',
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderColor: isDark ? '#374151' : '#e5e7eb',
      textStyle: { color: isDark ? '#f3f4f6' : '#1f2937' },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    toolbox: {
      feature: {
        saveAsImage: { show: false },
      },
    },
    xAxis: {
      type: 'category',
      data: props.data.map(item => item[props.config.x || Object.keys(item)[0]]),
      axisLabel: {
        fontSize: 10,
        color: isDark ? '#9ca3af' : '#4b5563',
      },
      axisLine: { lineStyle: { color: isDark ? '#374151' : '#e5e7eb' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontSize: 10,
        color: isDark ? '#9ca3af' : '#4b5563',
      },
      splitLine: { lineStyle: { color: isDark ? '#1f2937' : '#f3f4f6' } },
    },
    series: [],
  }

  if (props.type === 'bar' || props.type === 'line') {
    const yCols = Array.isArray(props.config.y)
      ? props.config.y
      : [props.config.y || Object.keys(props.data[0])[1]]

    option.series = yCols.map(col => ({
      name: col,
      type: props.type,
      data: props.data.map(item => item[col]),
      smooth: props.type === 'line',
      itemStyle: {
        borderRadius: props.type === 'bar' ? [4, 4, 0, 0] : 0,
      },
    }))
  }
  else if (props.type === 'pie') {
    delete option.xAxis
    delete option.yAxis
    option.series = [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: isDark ? '#111827' : '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '12',
            fontWeight: 'bold',
          },
        },
        data: props.data.map(item => ({
          name: item[props.config.x || Object.keys(item)[0]],
          value: item[props.config.y || Object.keys(item)[1]],
        })),
      },
    ]
  }

  chartInstance.setOption(option)
}

onMounted(() => {
  setTimeout(() => {
    initChart()
  }, 100)
  // No manual window resize listener needed, handled by useResizeObserver
})

onUnmounted(() => {
  chartInstance?.dispose()
})
useResizeObserver(chartRef, (entries) => {
  const entry = entries[0]
  const { width, height } = entry.contentRect
  if (width > 0 && height > 0) {
    chartInstance?.resize()
  }
})

watch(
  () => props.data,
  () => {
    initChart()
  },
  { deep: true, flush: 'post' },
)
</script>

<template>
  <div class="w-full h-full relative overflow-hidden chart-container">
    <div
      v-if="!data || data.length === 0"
      class="h-32 flex items-center justify-center text-muted-foreground italic text-xs"
    >
      {{ $t('common.no_data') }}
    </div>
    <div
      v-else-if="type === 'number'"
      class="flex flex-col items-center justify-center py-6 h-full"
    >
      <div
        v-if="config.title"
        class="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1"
      >
        {{ config.title }}
      </div>
      <div class="text-4xl font-black text-primary drop-shadow-sm">
        {{ data[0]?.[config.y || Object.keys(data[0])[0]] ?? '-' }}
      </div>
    </div>
    <div v-else ref="chartRef" class="w-full h-full min-h-[250px]" />
  </div>
</template>

<style scoped>
.chart-container {
  animation: chartEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes chartEnter {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
