<script setup lang="ts">
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Database,
  MousePointer2,
  Terminal,
  TrendingUp,
  XCircle,
} from 'lucide-vue-next'
import { computed, onActivated, onMounted, ref } from 'vue'
import AiChart from '@/components/shared/AiChart.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import api from '@/lib/api'

const dashboardData = ref<any>({
  stats: {
    totalDataSources: 0,
    totalTasks: 0,
    totalQueries: 0,
    totalUsers: 0,
  },
  trend: [],
  topSources: [],
  topUsers: [],
  recentLogs: [],
})

const health = ref<any>(null)

const successRate = computed(() => {
  if (!dashboardData.value.trend || dashboardData.value.trend.length === 0)
    return 0
  const total = dashboardData.value.trend.reduce((acc: number, curr: any) => acc + curr.total, 0)
  const success = dashboardData.value.trend.reduce(
    (acc: number, curr: any) => acc + curr.success,
    0,
  )
  return total > 0 ? Math.round((success / total) * 100) : 0
})

async function fetchDashboardData() {
  try {
    const [statsResponse, healthResponse] = await Promise.all([
      api.get('/dashboard/stats'),
      api.get('/health'),
    ])

    dashboardData.value = statsResponse.data
    health.value = healthResponse.data
  }
  catch (error) {
    console.error('Failed to fetch dashboard data', error)
  }
}

onMounted(fetchDashboardData)
onActivated(fetchDashboardData)
</script>

<template>
  <div class="p-6 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
    <div class="flex flex-col gap-1">
      <h1
        class="text-3xl font-black tracking-tight bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent"
      >
        {{ $t('dashboard.system_overview') }}
      </h1>
      <p class="text-muted-foreground text-sm">
        {{ $t('dashboard.system_overview_desc') }}
      </p>
    </div>

    <!-- Quick Stats Card -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card class="border-primary/10 bg-background/50 backdrop-blur-sm">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            {{ $t('sidebar.data_sources') }}
          </CardTitle>
          <Database class="h-4 w-4 text-primary opacity-70" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-black tracking-tighter">
            {{ dashboardData.stats.totalDataSources }}
          </div>
          <p class="text-[10px] text-muted-foreground mt-1 font-medium">
            {{ $t('dashboard.active_connections') }}
          </p>
        </CardContent>
      </Card>

      <Card class="border-primary/10 bg-background/50 backdrop-blur-sm">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            {{ $t('dashboard.sql_tasks') }}
          </CardTitle>
          <Terminal class="h-4 w-4 text-primary opacity-70" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-black tracking-tighter">
            {{ dashboardData.stats.totalTasks }}
          </div>
          <p class="text-[10px] text-muted-foreground mt-1 font-medium">
            {{ $t('dashboard.configured_reports') }}
          </p>
        </CardContent>
      </Card>

      <Card class="border-primary/10 bg-background/50 backdrop-blur-sm">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            {{ $t('dashboard.executions') }}
          </CardTitle>
          <Activity class="h-4 w-4 text-primary opacity-70" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-black tracking-tighter">
            {{ dashboardData.stats.totalQueries }}
          </div>
          <p class="text-[10px] text-muted-foreground mt-1 font-medium">
            {{ $t('dashboard.total_queries_run') }}
          </p>
        </CardContent>
      </Card>

      <Card class="border-primary/10 bg-background/50 backdrop-blur-sm">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            {{ $t('dashboard.overall_health') }}
          </CardTitle>
          <TrendingUp class="h-4 w-4 text-primary opacity-70" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-black tracking-tighter text-primary">
            {{ successRate }}%
          </div>
          <p class="text-[10px] text-muted-foreground mt-1 font-medium">
            {{ $t('dashboard.success_rate_7d') }}
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- Charts Section -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
      <!-- Activity Trend -->
      <Card class="lg:col-span-8 border-primary/5 shadow-sm overflow-hidden">
        <CardHeader class="pb-2">
          <div class="flex items-center justify-between">
            <CardTitle class="text-sm font-bold flex items-center gap-2">
              <Activity class="h-4 w-4 text-primary" />
              {{ $t('dashboard.activity_trend') }}
            </CardTitle>
            <Badge variant="outline" class="text-[10px] font-bold">
              {{
                $t('dashboard.last_7_days')
              }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent class="p-0">
          <AiChart
            :data="dashboardData.trend"
            type="line"
            :config="{ x: 'date', y: ['success', 'failed'] }"
            class="my-0! border-none shadow-none bg-transparent"
          />
        </CardContent>
      </Card>

      <!-- Health Pie -->
      <Card class="lg:col-span-4 border-primary/5 shadow-sm overflow-hidden">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-bold flex items-center gap-2">
            <CheckCircle2 class="h-4 w-4 text-green-500" />
            {{ $t('dashboard.execution_health') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="p-0">
          <AiChart
            :data="
              dashboardData.trend && dashboardData.trend.some((t: { total: number }) => t.total > 0)
                ? [
                  {
                    name: $t('history.success'),
                    value: dashboardData.trend.reduce((a: any, c: { success: any }) => a + (c.success || 0), 0),
                  },
                  {
                    name: $t('history.failed'),
                    value: dashboardData.trend.reduce((a: any, c: { failed: any }) => a + (c.failed || 0), 0),
                  },
                ]
                : []
            "
            type="pie"
            :config="{ x: 'name', y: 'value' }"
            class="my-0! border-none shadow-none bg-transparent"
          />
        </CardContent>
      </Card>

      <!-- Resource Usage (Top Sources) -->
      <Card class="lg:col-span-4 border-primary/5 shadow-sm overflow-hidden">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-bold flex items-center gap-2">
            <BarChart3 class="h-4 w-4 text-primary" />
            {{ $t('dashboard.top_sources') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="p-0">
          <AiChart
            :data="dashboardData.topSources || []"
            type="bar"
            :config="{ x: 'name', y: 'total' }"
            class="my-0! border-none shadow-none bg-transparent"
          />
        </CardContent>
      </Card>

      <!-- User Engagement -->
      <Card class="lg:col-span-4 border-primary/5 shadow-sm overflow-hidden">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-bold flex items-center gap-2">
            <MousePointer2 class="h-4 w-4 text-primary" />
            {{ $t('dashboard.top_users') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="p-0">
          <AiChart
            :data="dashboardData.topUsers || []"
            type="bar"
            :config="{ x: 'name', y: 'total' }"
            class="my-0! border-none shadow-none bg-transparent"
          />
        </CardContent>
      </Card>

      <!-- System Health Metrics -->
      <Card class="lg:col-span-4 border-primary/5 shadow-sm">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-bold flex items-center gap-2">
            <Activity class="h-4 w-4 text-primary" />
            {{ $t('dashboard.env_health') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="px-4 py-2">
          <div v-if="health && health.status" class="space-y-4">
            <div v-for="check in health.checks" :key="check.name" class="space-y-1">
              <div
                class="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider"
              >
                <span class="text-muted-foreground">{{ check.name }}</span>
                <span
                  :class="check.isHealthy ? 'text-green-500' : 'text-red-500'"
                  class="font-black flex items-center gap-1"
                >
                  <CheckCircle2 v-if="check.isHealthy" class="h-3 w-3" />
                  <XCircle v-else class="h-3 w-3" />
                  {{ check.isHealthy ? 'OK' : 'ERR' }}
                </span>
              </div>

              <!-- Progress Bar for Usage -->
              <Progress
                v-if="check.meta?.usage_percentage !== undefined"
                :model-value="check.meta.usage_percentage"
                class="h-1.5 bg-primary/10"
                :class="
                  check.meta.usage_percentage > 85 ? '[&>div]:bg-red-500' : '[&>div]:bg-primary'
                "
              />

              <!-- Detailed Error Message -->
              <div
                v-if="!check.isHealthy && check.message"
                class="text-[10px] text-red-500 font-medium"
              >
                {{ check.message }}
              </div>

              <!-- Data Source Specific Errors -->
              <div
                v-if="check.meta?.details && check.meta.details.some((d: { status: string }) => d.status === 'error')"
                class="mt-1 space-y-1"
              >
                <div
                  v-for="detail in check.meta.details.filter((d: { status: string }) => d.status === 'error')"
                  :key="detail.name"
                  class="flex items-start gap-1 text-[10px] text-red-400 bg-red-500/5 p-1 rounded"
                >
                  <XCircle class="h-3 w-3 mt-0.5 shrink-0" />
                  <div>
                    <span class="font-bold">{{ detail.name }}:</span> {{ detail.error }}
                  </div>
                </div>
              </div>
            </div>
            <div class="pt-2 text-[10px] text-muted-foreground/60 text-right italic">
              {{ $t('history.refresh') }}: {{ new Date(health.finishedAt).toLocaleTimeString() }}
            </div>
          </div>
          <div v-else class="flex items-center justify-center h-full py-10 opacity-50">
            <Activity class="animate-pulse h-6 w-6" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Recent Logs Row -->
    <Card class="border-primary/5 shadow-sm">
      <CardHeader>
        <CardTitle class="text-sm font-bold">
          {{ $t('dashboard.recent_live') }}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div class="relative w-full overflow-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50">
              <tr class="text-left border-b border-muted/50">
                <th
                  class="p-3 font-bold text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {{ $t('dashboard.timestamp') }}
                </th>
                <th
                  class="p-3 font-bold text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {{ $t('history.user') }}
                </th>
                <th
                  class="p-3 font-bold text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {{ $t('dashboard.action') }}
                </th>
                <th
                  class="p-3 font-bold text-[10px] uppercase tracking-wider text-muted-foreground text-right"
                >
                  {{ $t('dashboard.status') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="log in dashboardData.recentLogs"
                :key="log.id"
                class="border-b border-muted/20 hover:bg-muted/30 transition-colors"
              >
                <td class="p-3 text-xs text-muted-foreground">
                  {{ new Date(log.createdAt).toLocaleString() }}
                </td>
                <td class="p-3 text-xs font-semibold">
                  {{ log.user?.fullName || 'System' }}
                </td>
                <td class="p-3 text-xs truncate max-w-[300px]">
                  {{ log.task?.name || $t('dashboard.adhoc_query') }}
                </td>
                <td class="p-3 text-right">
                  <Badge
                    :variant="log.status === 'success' ? 'default' : 'destructive'"
                    class="text-[9px] px-1.5 py-0"
                  >
                    {{ log.status === 'success' ? $t('history.success') : $t('history.failed') }}
                  </Badge>
                </td>
              </tr>
              <tr v-if="dashboardData.recentLogs.length === 0">
                <td colspan="4" class="p-8 text-center text-muted-foreground italic text-xs">
                  {{ $t('dashboard.execution_log_empty') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.tracking-tighter {
  letter-spacing: -0.05em;
}

:deep(.progress-root) {
  @apply rounded-full;
}

table tr:last-child {
  border-bottom: none;
}
</style>
