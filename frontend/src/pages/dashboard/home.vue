<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Database,
  Terminal,
  History as HistoryIcon,
  Users,
  TrendingUp,
  Activity,
  CheckCircle2,
  XCircle,
} from 'lucide-vue-next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import api from '@/lib/api'

const stats = ref({
  totalDataSources: 0,
  totalTasks: 0,
  totalQueries: 0,
  totalUsers: 0,
})

const recentLogs = ref<any[]>([])
const health = ref<any>(null)

const fetchDashboardData = async () => {
  try {
    const [statsResponse, healthResponse] = await Promise.all([
      api.get('/dashboard/stats'),
      api.get('/health'),
    ])

    stats.value = statsResponse.data.stats
    recentLogs.value = statsResponse.data.recentLogs
    health.value = healthResponse.data
  } catch (error) {
    console.error('Failed to fetch dashboard data', error)
  }
}

onMounted(fetchDashboardData)
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
    </div>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium truncate">Data Sources</CardTitle>
          <Database class="h-4 w-4 text-muted-foreground shrink-0" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold truncate">{{ stats.totalDataSources }}</div>
          <p class="text-xs text-muted-foreground truncate">Connected databases</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium truncate">Query Tasks</CardTitle>
          <Terminal class="h-4 w-4 text-muted-foreground shrink-0" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold truncate">{{ stats.totalTasks }}</div>
          <p class="text-xs text-muted-foreground truncate">Configured SQL reports</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium truncate">Total Executions</CardTitle>
          <Activity class="h-4 w-4 text-muted-foreground shrink-0" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold truncate">{{ stats.totalQueries }}</div>
          <p class="text-xs text-muted-foreground truncate">Queries run to date</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium truncate">Active Users</CardTitle>
          <Users class="h-4 w-4 text-muted-foreground shrink-0" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold truncate">{{ stats.totalUsers }}</div>
          <p class="text-xs text-muted-foreground truncate">Platform members</p>
        </CardContent>
      </Card>
    </div>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      <Card class="col-span-4">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="space-y-8">
            <div v-for="log in recentLogs" :key="log.id" class="flex items-center">
              <div class="space-y-1">
                <p class="text-sm font-medium leading-none">
                  {{ log.user?.fullName || 'Anonymous' }} executed {{ log.task?.name || 'a task' }}
                </p>
                <p class="text-sm text-muted-foreground">
                  {{ new Date(log.createdAt).toLocaleString() }}
                </p>
              </div>
              <div
                class="ml-auto font-medium"
                :class="log.status === 'success' ? 'text-green-600' : 'text-red-600'"
              >
                {{ log.status }}
              </div>
            </div>
            <div v-if="recentLogs.length === 0" class="text-center py-10 text-muted-foreground">
              No recent activity found.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="col-span-3">
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div v-if="health && health.checks" class="space-y-6">
            <div v-for="check in health.checks" :key="check.name" class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">{{ check.name }}</span>
                <div class="flex items-center">
                  <span
                    v-if="check.status === 'ok' || check.isHealthy"
                    class="flex items-center text-xs text-green-600"
                  >
                    <CheckCircle2 class="mr-1 h-3 w-3" />
                    {{
                      check.meta?.usage_percentage !== undefined
                        ? `${check.meta.usage_percentage}%`
                        : 'Operational'
                    }}
                  </span>
                  <span v-else class="flex items-center text-xs text-red-600">
                    <XCircle class="mr-1 h-3 w-3" /> Issues Detected
                  </span>
                </div>
              </div>

              <!-- Progress bar for resource usage -->
              <Progress
                v-if="check.meta?.usage_percentage !== undefined"
                :model-value="check.meta.usage_percentage"
                class="h-2"
                :class="
                  check.meta.usage_percentage > 90
                    ? '[&>div]:bg-red-500'
                    : check.meta.usage_percentage > 70
                      ? '[&>div]:bg-yellow-500'
                      : ''
                "
              />
            </div>

            <div class="pt-2 border-t text-xs text-muted-foreground text-center">
              Last checked: {{ new Date(health.finishedAt || Date.now()).toLocaleTimeString() }}
            </div>
          </div>
          <div v-else class="flex flex-col items-center justify-center h-[200px] space-y-4">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p class="text-sm text-muted-foreground">Checking system status...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
