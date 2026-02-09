<script setup lang="ts">
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import { format } from 'date-fns'
import {
  Activity,
  BarChart,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Users,
  Wallet,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { Line, Pie } from 'vue-chartjs'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import api from '@/lib/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

const { t } = useI18n()
const loading = ref(true)
const stats = ref<any>(null)
const logs = ref<any[]>([])
const currentPage = ref(1)
const totalPages = ref(1)

async function fetchStats() {
  try {
    const res = await api.get('/finops/stats')
    stats.value = res.data
  }
  catch (e) {
    console.error('Failed to fetch FinOps stats', e)
  }
}

async function fetchLogs(page = 1) {
  try {
    const res = await api.get('/finops/logs', { params: { page, limit: 10 } })
    logs.value = res.data.data
    currentPage.value = res.data.meta.currentPage
    totalPages.value = res.data.meta.lastPage
  }
  catch (e) {
    console.error('Failed to fetch logs', e)
  }
}

async function refreshData() {
  loading.value = true
  await Promise.all([fetchStats(), fetchLogs()])
  loading.value = false
}

onMounted(refreshData)

// Chart Data: Cost Trend
const trendChartData = computed(() => {
  if (!stats.value?.dailyTrend)
    return { labels: [], datasets: [] }
  return {
    labels: stats.value.dailyTrend.map((d: any) => format(new Date(d.date), 'MM-dd')),
    datasets: [
      {
        label: t('finops.daily_cost_label'),
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: '#3b82f6',
        data: stats.value.dailyTrend.map((d: any) => d.cost),
        fill: true,
        tension: 0.4,
      },
    ],
  }
})

// Chart Data: Model Distribution
const modelChartData = computed(() => {
  const filteredData = (stats.value.modelDistribution || []).filter((m: any) => m.cost > 0)
  return {
    labels: filteredData.map((m: any) => m.model_name),
    datasets: [
      {
        data: filteredData.map((m: any) => m.cost),
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
          '#ec4899',
        ],
      },
    ],
  }
})

function formatCost(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 }).format(val)
}

function formatTokens(val: number) {
  return new Intl.NumberFormat().format(val)
}
</script>

<template>
  <div class="container p-6 mx-auto space-y-8 animate-in fade-in duration-500">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-3xl font-bold tracking-tight text-foreground/90">
          {{ t('finops.title') }}
        </h2>
        <p class="text-muted-foreground">
          {{ t('finops.description') }}
        </p>
      </div>
      <div class="flex items-center space-x-2">
        <Button variant="outline" size="sm" @click="refreshData">
          <Activity class="mr-2 h-4 w-4" /> {{ t('finops.refresh') }}
        </Button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>

    <template v-else-if="stats">
      <!-- Summary Cards -->
      <div class="grid gap-4 md:grid-cols-3">
        <Card class="bg-primary/5 border-primary/10 overflow-hidden">
          <CardHeader class="flex flex-row items-center justify-between p-4 pb-2 space-y-0 gap-2">
            <CardTitle class="text-sm font-medium truncate flex-1" :title="t('finops.total_cost')">
              {{ t('finops.total_cost') }}
            </CardTitle>
            <Wallet class="h-4 w-4 text-primary shrink-0" />
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ formatCost(stats.summary.totalCost) }}
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('finops.cost_footer') }}
            </p>
          </CardContent>
        </Card>
        <Card class="overflow-hidden">
          <CardHeader class="flex flex-row items-center justify-between p-4 pb-2 space-y-0 gap-2">
            <CardTitle class="text-sm font-medium truncate flex-1" :title="t('finops.total_tokens')">
              {{ t('finops.total_tokens') }}
            </CardTitle>
            <Cpu class="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ formatTokens(stats.summary.totalTokens) }}
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('finops.tokens_footer') }}
            </p>
          </CardContent>
        </Card>
        <Card class="overflow-hidden">
          <CardHeader class="flex flex-row items-center justify-between p-4 pb-2 space-y-0 gap-2">
            <CardTitle class="text-sm font-medium truncate flex-1" :title="t('finops.total_requests')">
              {{ t('finops.total_requests') }}
            </CardTitle>
            <BarChart class="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ formatTokens(stats.summary.totalRequests) }}
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('finops.requests_footer') }}
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Charts Row -->
      <div class="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{{ t('finops.cost_trend') }}</CardTitle>
            <CardDescription>{{ t('finops.cost_trend_desc') }}</CardDescription>
          </CardHeader>
          <CardContent class="h-[300px]">
            <Line :data="trendChartData" :options="{ maintainAspectRatio: false, responsive: true }" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{{ t('finops.cost_by_model') }}</CardTitle>
            <CardDescription>{{ t('finops.cost_by_model_desc') }}</CardDescription>
          </CardHeader>
          <CardContent class="h-[300px] flex justify-center">
            <Pie :data="modelChartData" :options="{ maintainAspectRatio: false, responsive: true }" />
          </CardContent>
        </Card>
      </div>

      <!-- Users & History -->
      <div class="grid gap-6 md:grid-cols-3">
        <!-- Top Users Table -->
        <Card class="md:col-span-1">
          <CardHeader>
            <CardTitle class="flex items-center">
              <Users class="mr-2 h-5 w-5" /> {{ t('finops.top_users') }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{{ t('finops.user') }}</TableHead>
                  <TableHead class="text-right">
                    {{ t('finops.cost') }}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="u in stats.userDistribution" :key="u.email">
                  <TableCell>
                    <div class="font-medium text-xs">
                      {{ u.full_name }}
                    </div>
                    <div class="text-[10px] text-muted-foreground">
                      {{ u.email }}
                    </div>
                  </TableCell>
                  <TableCell class="text-right text-xs font-mono">
                    {{ formatCost(u.cost) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <!-- Recent Logs -->
        <Card class="md:col-span-2">
          <CardHeader class="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{{ t('finops.usage_history') }}</CardTitle>
              <CardDescription>{{ t('finops.usage_history_desc') }}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{{ t('finops.time') }}</TableHead>
                  <TableHead>{{ t('finops.model') }}</TableHead>
                  <TableHead>{{ t('finops.context') }}</TableHead>
                  <TableHead class="text-right">
                    {{ t('finops.tokens') }}
                  </TableHead>
                  <TableHead class="text-right">
                    {{ t('finops.cost') }}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="log in logs" :key="log.id">
                  <TableCell class="text-xs">
                    {{ format(new Date(log.createdAt), 'MM-dd HH:mm') }}
                  </TableCell>
                  <TableCell>
                    <span class="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
                      {{ log.modelName }}
                    </span>
                  </TableCell>
                  <TableCell class="text-xs capitalize">
                    {{ log.context.replace('_', ' ') }}
                  </TableCell>
                  <TableCell class="text-right text-xs font-mono">
                    {{ formatTokens(log.totalTokens) }}
                  </TableCell>
                  <TableCell class="text-right text-xs font-mono">
                    {{ formatCost(log.estimatedCost) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <!-- Pagination -->
            <div class="flex items-center justify-end space-x-2 py-4">
              <Button
                variant="outline"
                size="sm"
                :disabled="currentPage <= 1"
                @click="fetchLogs(currentPage - 1)"
              >
                <ChevronLeft class="h-4 w-4" />
              </Button>
              <span class="text-xs text-muted-foreground">{{ t('finops.pagination', { current: currentPage, total: totalPages }) }}</span>
              <Button
                variant="outline"
                size="sm"
                :disabled="currentPage >= totalPages"
                @click="fetchLogs(currentPage + 1)"
              >
                <ChevronRight class="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>
