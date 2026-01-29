<script setup lang="ts">
import type { QueryTask } from '@nexquery/shared'
import { useEventBus } from '@vueuse/core'
import { ArrowLeft, Database, Download, Eye, Loader2, Play, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import api, { cryptoService } from '@/lib/api'

import { useSettingsStore } from '@/stores/settings'

import DynamicForm from './components/DynamicForm.vue'

const settingsStore = useSettingsStore()

const route = useRoute()
const router = useRouter()
const task = ref<QueryTask | null>(null)
const results = ref<any[] | null>(null)
const isExecuting = ref(false)
const executionTime = ref<number | null>(null)

// Workflow State
const approvalStatus = ref<'idle' | 'pending' | 'approved' | 'rejected'>('idle')
const workflowProcessId = ref<string | null>(null)
const approvalComment = ref<string | null>(null)
let pollTimer: any = null

// Event Bus for Real-time Updates
const bus = useEventBus<string>('workflow-event')
const unsubscribe = bus.on((_event) => {
  if (approvalStatus.value === 'pending' && workflowProcessId.value) {
    // If we are waiting for approval and receive ANY workflow event, check status immediately
    checkApprovalStatus()
  }
})

const isArrayResult = computed(() => {
  return Array.isArray(results.value)
})

const columns = computed(() => {
  if (!results.value || !isArrayResult.value || results.value.length === 0)
    return []
  return Object.keys(results.value![0])
})

async function fetchTask() {
  try {
    const response = await api.get(`/query-tasks/${route.params.id}`)
    task.value = response.data

    // Check Approval Status
    await checkApprovalStatus()
  }
  catch {
    toast.error('Failed to load task')
    router.push({ name: 'query-tasks' })
  }
}

async function checkApprovalStatus() {
  try {
    const { data } = await api.get(`/query-tasks/${task.value!.id}/approval-status`)
    if (data.status === 'PENDING_APPROVAL') {
      approvalStatus.value = 'pending'
      workflowProcessId.value = data.processInstanceId
      startPolling()
    }
    else if (data.status === 'APPROVED') {
      approvalStatus.value = 'approved'
      workflowProcessId.value = data.processInstanceId
      approvalComment.value = data.comment || null
      toast.success('Restored approved session. Ready to execute.')
    }
    else if (data.status === 'REJECTED') {
      approvalStatus.value = 'rejected'
      workflowProcessId.value = data.processInstanceId
    }
  }
  catch (e) {
    console.warn('Failed to restore approval status', e)
  }
}

function resetApproval() {
  approvalStatus.value = 'idle'
  workflowProcessId.value = null
  approvalComment.value = null
  toast.info('Approval status reset. You can modify parameters and try again.')
}

function onFormChange() {
  if (approvalStatus.value === 'approved' || approvalStatus.value === 'pending') {
    resetApproval()
  }
}

async function onExecute(params: any) {
  isExecuting.value = true
  results.value = null

  // Construct payload
  const payload: any = { params }

  // If we already have an approved token, pass it at ROOT level
  if (approvalStatus.value === 'approved' && workflowProcessId.value) {
    payload.processInstanceId = workflowProcessId.value
  }

  try {
    const response = await api.post(`/query-tasks/${task.value!.id}/execute`, payload)

    // Handle Approval Required (202 or 200 with PENDING_APPROVAL status)
    const data = response.data
    if (response.status === 202 || (data && data.status === 'PENDING_APPROVAL')) {
      if (data && data.status === 'PENDING_APPROVAL') {
        approvalStatus.value = 'pending'
        workflowProcessId.value = data.processInstanceId
        toast.info('High risk query detected. Waiting for administrator approval...')
        startPolling()
        return
      }
    }

    let finalData = response.data.data
    // ... (rest of the logic for normal execution)

    // Check if the result itself is an encrypted packet (common for API tasks calling other platform APIs)
    if (
      cryptoService
      && finalData
      && typeof finalData === 'object'
      && finalData.data
      && typeof finalData.data === 'string'
      && finalData.data.startsWith('U2FsdGVk')
    ) {
      try {
        const decrypted = cryptoService.decrypt(finalData.data)
        if (decrypted !== null) {
          finalData = decrypted
        }
      }
      catch (e) {
        console.warn('[QueryExecution] Failed to decrypt nested result:', e)
      }
    }

    results.value = finalData
    executionTime.value = response.data.duration
    toast.success('Query executed successfully')

    // consume token
    if (approvalStatus.value === 'approved') {
      approvalStatus.value = 'idle'
      workflowProcessId.value = null
      approvalComment.value = null
    }
  }
  catch (error: any) {
    toast.error(`Execution failed: ${error.response?.data?.error || error.response?.data?.message || error.message}`)
  }
  finally {
    isExecuting.value = false
  }
}

function startPolling() {
  if (pollTimer)
    clearInterval(pollTimer)

  // Reduced frequency (10s) since we have SSE
  pollTimer = setInterval(async () => {
    if (!workflowProcessId.value)
      return

    // Only poll if pending
    if (approvalStatus.value !== 'pending') {
      clearInterval(pollTimer)
      return
    }

    try {
      await checkApprovalStatus()
    }
    catch (e) {
      console.error('Polling failed', e)
    }
  }, 10000)
}

onBeforeUnmount(() => {
  if (pollTimer)
    clearInterval(pollTimer)
  unsubscribe()
})
function downloadResults() {
  if (!results.value || results.value.length === 0)
    return

  const headers = columns.value.join(',')
  const rows = results.value!.map((row: any) =>
    columns.value
      .map((col) => {
        let val = row[col]
        if (val === null || val === undefined) {
          val = ''
        }
        else if (typeof val === 'object') {
          val = JSON.stringify(val)
        }
        else {
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

// End of scripts

onMounted(fetchTask)
</script>

<template>
  <div class="p-6 space-y-6 h-full flex flex-col">
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" class="shrink-0" @click="router.back()">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div v-if="task" class="flex flex-col min-w-0">
        <h1 class="text-2xl font-bold tracking-tight truncate">
          {{ task.name }}
        </h1>
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
      <Card class="flex-none shadow-sm border-border">
        <CardContent class="p-6">
          <DynamicForm
            :schema="task.formSchema || []"
            :is-executing="isExecuting"
            :approval-status="approvalStatus"
            @execute="onExecute"
            @change="onFormChange"
          />
        </CardContent>
      </Card>

      <!-- Approval Alert -->
      <div v-if="approvalStatus !== 'idle'" class="flex-none">
        <Alert v-if="approvalStatus === 'pending'" variant="default" class="border-blue-200 bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-800">
          <Loader2 class="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
          <AlertTitle>Waiting for Approval</AlertTitle>
          <AlertDescription class="mt-2 flex items-center justify-between">
            <span>This is a high-risk operation. Administrator approval is required before execution.</span>
            <Button
              variant="outline"
              size="sm"
              class="ml-4 h-7 bg-white/50 hover:bg-white/80 dark:bg-black/20 dark:hover:bg-black/40 border-blue-200 dark:border-blue-800"
              @click="router.push({ name: 'workflow-history-detail', params: { id: workflowProcessId } })"
            >
              <Eye class="mr-2 h-3.5 w-3.5" />
              View Progress
            </Button>
          </AlertDescription>
        </Alert>

        <Alert v-else-if="approvalStatus === 'approved'" variant="default" class="border-green-200 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200 dark:border-green-800">
          <ShieldCheck class="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle>Approval Granted</AlertTitle>
          <AlertDescription class="mt-2 flex items-center justify-between">
            <span>You can now execute this query. One-time use permission.</span>
            <Button
              variant="outline"
              size="sm"
              class="ml-4 h-7 bg-white/50 hover:bg-white/80 dark:bg-black/20 dark:hover:bg-black/40 border-green-200 dark:border-green-800"
              @click="router.push({ name: 'workflow-history-detail', params: { id: workflowProcessId } })"
            >
              <Eye class="mr-2 h-3.5 w-3.5" />
              Audit Log
            </Button>
          </AlertDescription>
        </Alert>

        <Alert v-else-if="approvalStatus === 'rejected'" variant="destructive">
          <ShieldAlert class="h-4 w-4" />
          <AlertTitle>Request Rejected</AlertTitle>
          <AlertDescription class="mt-2 flex items-center justify-between gap-4">
            <span>The administrator denied this request. Please contact support if you believe this is an error.</span>
            <div class="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                class="h-7 bg-background/50"
                @click="router.push({ name: 'workflow-history-detail', params: { id: workflowProcessId } })"
              >
                <Eye class="mr-2 h-3.5 w-3.5" />
                Details
              </Button>
              <Button variant="outline" size="sm" class="h-7 bg-background/50" @click="resetApproval">
                <RotateCcw class="mr-2 h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>

      <!-- Bottom: Results -->
      <Card class="flex-1 flex flex-col min-h-0 overflow-hidden border-border shadow-sm">
        <CardHeader class="flex flex-row items-center justify-between py-4 border-b">
          <div class="flex items-center gap-4">
            <CardTitle>Results</CardTitle>
            <CardDescription v-if="executionTime">
              Executed in {{ executionTime }}ms
            </CardDescription>
          </div>
          <div v-if="results" class="flex items-center gap-4">
            <span v-if="isArrayResult" class="text-sm font-medium">{{ results.length }} rows returned</span>
            <span v-else class="text-sm font-medium">JSON Result</span>
            <Button
              v-if="settingsStore.allowExport && isArrayResult"
              variant="outline"
              size="sm"
              :disabled="results.length === 0"
              @click="downloadResults"
            >
              <Download class="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent class="p-0 flex-1 overflow-hidden relative">
          <div
            v-if="isExecuting"
            class="absolute inset-0 flex flex-col items-center justify-center bg-background/50 z-10"
          >
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p class="text-muted-foreground text-sm mt-2">
              Running query...
            </p>
          </div>

          <div
            v-if="results && (isArrayResult ? results.length > 0 : true)"
            class="h-full overflow-auto"
          >
            <div v-if="!isArrayResult" class="p-4">
              <pre class="bg-muted p-4 rounded-md overflow-auto font-mono text-sm max-h-[600px]">{{
                JSON.stringify(results, null, 2)
              }}</pre>
            </div>
            <Table v-else>
              <TableHeader class="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead v-for="col in columns" :key="col" class="whitespace-nowrap">
                    {{
                      col
                    }}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(row, idx) in results" :key="idx">
                  <TableCell
                    v-for="col in columns"
                    :key="col"
                    class="min-w-[100px] max-w-[400px] whitespace-normal wrap-break-word align-top"
                  >
                    {{ row[col] }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div
            v-else-if="!isExecuting && (!results || (isArrayResult && results.length === 0))"
            class="h-full flex flex-col items-center justify-center text-muted-foreground p-8"
          >
            <Play v-if="!results" class="h-12 w-12 mb-4 opacity-20" />
            <p v-if="!results">
              Fill in the parameters and click Execute to see results.
            </p>
            <p v-else>
              No results returned.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
