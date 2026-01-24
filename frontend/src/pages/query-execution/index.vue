<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Play, Timer, Database, Download } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import api, { cryptoService } from '@/lib/api'
import DynamicForm from './components/DynamicForm.vue'
import { toast } from 'vue-sonner'
import { useSettingsStore } from '@/stores/settings'

import type { QueryTask } from '@nexquery/shared'

const settingsStore = useSettingsStore()

const route = useRoute()
const router = useRouter()
const task = ref<QueryTask | null>(null)
const results = ref<any[] | null>(null)
const isExecuting = ref(false)
const executionTime = ref<number | null>(null)

const fetchTask = async () => {
  try {
    const response = await api.get(`/query-tasks/${route.params.id}`)
    task.value = response.data
  } catch (error) {
    toast.error('Failed to load task')
    router.push({ name: 'query-tasks' })
  }
}

const onExecute = async (params: any) => {
  isExecuting.value = true
  results.value = null
  try {
    const response = await api.post(`/query-tasks/${task.value!.id}/execute`, { params })
    let finalData = response.data.data

    // Check if the result itself is an encrypted packet (common for API tasks calling other platform APIs)
    if (
      cryptoService &&
      finalData &&
      typeof finalData === 'object' &&
      finalData.data &&
      typeof finalData.data === 'string' &&
      finalData.data.startsWith('U2FsdGVk')
    ) {
      try {
        const decrypted = cryptoService.decrypt(finalData.data)
        if (decrypted !== null) {
          finalData = decrypted
          console.log('[QueryExecution] Auto-decrypted nested result')
        }
      } catch (e) {
        console.warn('[QueryExecution] Failed to decrypt nested result:', e)
      }
    }

    results.value = finalData
    executionTime.value = response.data.duration
    toast.success('Query executed successfully')
  } catch (error: any) {
    toast.error('Execution failed: ' + (error.response?.data?.error || error.message))
  } finally {
    isExecuting.value = false
  }
}
const downloadResults = () => {
  if (!results.value || results.value.length === 0) return

  const headers = columns.value.join(',')
  const rows = results.value!.map((row: any) =>
    columns.value
      .map((col) => {
        let val = row[col]
        if (val === null || val === undefined) {
          val = ''
        } else if (typeof val === 'object') {
          val = JSON.stringify(val)
        } else {
          val = String(val)
        }
        // Escape double quotes and wrap in double quotes
        return `"${val.replace(/"/g, '""')}"`
      })
      .join(','),
  )

  const csvContent = [headers, ...rows].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `${task.value!.name}_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const isArrayResult = computed(() => {
  return Array.isArray(results.value)
})

const columns = computed(() => {
  if (!results.value || !isArrayResult.value || results.value.length === 0) return []
  return Object.keys(results.value![0])
})

import { computed } from 'vue'

onMounted(fetchTask)
</script>

<template>
  <div class="p-6 space-y-6 h-full flex flex-col">
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" @click="router.back()" class="shrink-0">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div v-if="task" class="flex flex-col min-w-0">
        <h1 class="text-2xl font-bold tracking-tight truncate">{{ task.name }}</h1>
        <div class="flex items-center text-sm text-muted-foreground gap-3 mt-1">
          <div class="flex items-center">
            <Database class="mr-1.5 h-3.5 w-3.5" />
            {{ task.dataSource?.name }}
          </div>
          <span v-if="task.description" class="text-muted-foreground/30">|</span>
          <span v-if="task.description" class="truncate">{{ task.description }}</span>
        </div>
      </div>
    </div>

    <div v-if="task" class="flex flex-col gap-6 h-full overflow-hidden">
      <!-- Top: Form -->
      <Card class="flex-none shadow-sm border-muted/20">
        <CardContent class="p-6">
          <DynamicForm :schema="task.formSchema || []" :is-executing="isExecuting" @execute="onExecute" />
        </CardContent>
      </Card>

      <!-- Bottom: Results -->
      <Card class="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader class="flex flex-row items-center justify-between py-4 border-b">
          <div class="flex items-center gap-4">
            <CardTitle>Results</CardTitle>
            <CardDescription v-if="executionTime">
              Executed in {{ executionTime }}ms
            </CardDescription>
          </div>
          <div v-if="results" class="flex items-center gap-4">
            <span class="text-sm font-medium" v-if="isArrayResult">{{ results.length }} rows returned</span>
            <span class="text-sm font-medium" v-else>JSON Result</span>
            <Button v-if="settingsStore.allowExport && isArrayResult" variant="outline" size="sm"
              @click="downloadResults" :disabled="results.length === 0">
              <Download class="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent class="p-0 flex-1 overflow-hidden relative">
          <div v-if="isExecuting"
            class="absolute inset-0 flex flex-col items-center justify-center bg-background/50 z-10">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p class="text-muted-foreground text-sm mt-2">Running query...</p>
          </div>

          <div v-if="results && (isArrayResult ? results.length > 0 : true)" class="h-full overflow-auto">
            <div v-if="!isArrayResult" class="p-4">
              <pre class="bg-muted p-4 rounded-md overflow-auto font-mono text-sm max-h-[600px]">{{
                JSON.stringify(results, null, 2)
              }}</pre>
            </div>
            <Table v-else>
              <TableHeader class="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead v-for="col in columns" :key="col" class="whitespace-nowrap">{{
                    col
                    }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(row, idx) in results" :key="idx">
                  <TableCell v-for="col in columns" :key="col"
                    class="min-w-[100px] max-w-[400px] whitespace-normal break-words align-top">
                    {{ row[col] }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div v-else-if="!isExecuting && (!results || (isArrayResult && results.length === 0))"
            class="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
            <Play v-if="!results" class="h-12 w-12 mb-4 opacity-20" />
            <p v-if="!results">Fill in the parameters and click Execute to see results.</p>
            <p v-else>No results returned.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
