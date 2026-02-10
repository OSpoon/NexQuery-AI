<script setup lang="ts">
import { format } from 'date-fns'
import { Calendar, CheckCircle2, ChevronLeft, ListChecks, XCircle } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SqlDiffView from '@/components/SqlDiffView.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import api from '@/lib/api'

interface ReportSummary {
  fileName: string
  timestamp: string
  total: number
  correct: number
  accuracy: string
}

interface EvalResult {
  question: string
  expectedSql: string
  generatedSql: string
  isCorrect: boolean
  difficulty: string
  error?: string
}

interface ReportDetails {
  timestamp: string
  total: number
  correct: number
  accuracy: string
  results: EvalResult[]
}

const reports = ref<ReportSummary[]>([])
const selectedReport = ref<ReportDetails | null>(null)
const loading = ref(true)

const { t } = useI18n()

async function fetchReports() {
  try {
    const res = await api.get('/eval/spider/reports')
    reports.value = res.data
  }
  catch (error) {
    console.error('Failed to fetch reports', error)
  }
  finally {
    loading.value = false
  }
}

async function selectReport(fileName: string) {
  try {
    const res = await api.get(`/eval/spider/reports/${fileName}`)
    selectedReport.value = res.data
  }
  catch (error) {
    console.error('Failed to fetch report details', error)
  }
}

onMounted(() => {
  fetchReports()
})

function getDifficultyBadge(difficulty: string) {
  if (!difficulty)
    return 'bg-gray-100 text-gray-800'

  const map: any = {
    easy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    hard: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
    extra: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  }
  return map[difficulty.toLowerCase()] || 'bg-gray-100 text-gray-800'
}
</script>

<template>
  <div class="p-6 space-y-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">
          {{ t('eval.spider.title') }}
        </h1>
        <p class="text-muted-foreground">
          {{ t('eval.spider.desc') }}
        </p>
      </div>
      <div v-if="selectedReport" class="flex gap-2">
        <Button variant="outline" @click="selectedReport = null">
          <ChevronLeft class="mr-2 h-4 w-4" /> {{ t('eval.spider.back') }}
        </Button>
      </div>
    </div>

    <!-- Main View (List + Trend) -->
    <div v-if="!selectedReport" class="grid gap-6 md:grid-cols-3">
      <!-- Reports Table -->
      <Card class="md:col-span-3">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <ListChecks class="h-5 w-5 text-green-500" />
            {{ t('eval.spider.history') }}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('eval.spider.run_date') }}</TableHead>
                <TableHead>{{ t('eval.spider.samples') }}</TableHead>
                <TableHead>{{ t('eval.spider.correct') }}</TableHead>
                <TableHead>{{ t('eval.spider.accuracy') }}</TableHead>
                <TableHead class="text-right">
                  {{ t('eval.spider.actions') }}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="report in reports" :key="report.fileName">
                <TableCell class="font-medium">
                  <div class="flex items-center gap-2">
                    <Calendar class="h-4 w-4 text-muted-foreground" />
                    {{ format(new Date(report.timestamp), 'yyyy-MM-dd HH:mm:ss') }}
                  </div>
                </TableCell>
                <TableCell>{{ report.total }}</TableCell>
                <TableCell>{{ report.correct }}</TableCell>
                <TableCell>
                  <Badge :variant="parseFloat(report.accuracy) >= 80 ? 'default' : 'secondary'" class="bg-blue-500">
                    {{ report.accuracy }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right">
                  <Button variant="ghost" size="sm" @click="selectReport(report.fileName)">
                    {{ t('eval.spider.view_details') }}
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow v-if="reports.length === 0">
                <TableCell colspan="5" class="h-24 text-center text-muted-foreground">
                  {{ t('eval.spider.no_reports') }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>

    <!-- Detailed Report View -->
    <div v-else class="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <!-- Report Header Stats -->
      <div class="grid gap-6 md:grid-cols-4">
        <Card
          v-for="(val, label) in {
            'eval.spider.total_samples': selectedReport.total,
            'eval.spider.correct': selectedReport.correct,
            'eval.spider.accuracy': selectedReport.accuracy,
            'eval.spider.run_time': format(new Date(selectedReport.timestamp), 'HH:mm:ss'),
          }" :key="label"
        >
          <CardHeader class="pb-2">
            <CardDescription>{{ t(label) }}</CardDescription>
            <CardTitle class="text-2xl">
              {{ val }}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <!-- Results List -->
      <Card>
        <CardHeader>
          <CardTitle>{{ t('eval.spider.detailed_results') }}</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea class="h-[60vh] pr-4">
            <div class="space-y-4">
              <div
                v-for="(result, idx) in selectedReport.results" :key="idx"
                class="p-4 rounded-lg border bg-card text-card-foreground shadow-sm group"
              >
                <div class="flex items-start justify-between gap-4 mb-3">
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-semibold text-muted-foreground">#{{ idx + 1 }}</span>
                      <p class="font-medium text-lg leading-snug">
                        {{ result.question }}
                      </p>
                    </div>
                    <Badge :class="getDifficultyBadge(result.difficulty)">
                      {{ result.difficulty ? t(`eval.spider.difficulty.${result.difficulty.toLowerCase()}`) : t('eval.spider.difficulty.unknown') }}
                    </Badge>
                  </div>
                  <div class="shrink-0">
                    <CheckCircle2 v-if="result.isCorrect" class="h-6 w-6 text-green-500" />
                    <XCircle v-else class="h-6 w-6 text-red-500" />
                  </div>
                </div>

                <div class="mt-4">
                  <SqlDiffView
                    :expected="result.expectedSql"
                    :actual="result.generatedSql"
                    :disabled="result.isCorrect"
                  />
                </div>

                <div v-if="result.error" class="mt-4 p-3 rounded bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-xs flex items-center gap-2">
                  <XCircle class="h-4 w-4" /> {{ t('eval.spider.error_prefix') }} {{ result.error }}
                </div>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.echarts {
  width: 100%;
  height: 100%;
}
</style>
