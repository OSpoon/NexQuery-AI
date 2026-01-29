<script setup lang="ts">
import { format } from 'date-fns'
import { Eye, History } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import api from '@/lib/api'

const router = useRouter()
const { t } = useI18n()
const history = ref<any[]>([])
const loading = ref(false)
const workflowRegistry = ref<Map<string, any>>(new Map())

function getVariable(processInstance: any, name: string) {
  if (!processInstance || !processInstance.variables)
    return undefined
  const v = processInstance.variables.find((v: any) => v.name === name)
  return v ? v.value : undefined // Fixed: return value property, not object
}

function formatDate(date: string | null | undefined) {
  if (!date)
    return 'N/A'
  try {
    return format(new Date(date), 'PP p')
  }
  catch {
    return 'Invalid Date'
  }
}

async function fetchWorkflowMetadata() {
  try {
    const res = await api.get('/workflow/registry')
    const workflows = res.data.data || []
    const registry = new Map()
    workflows.forEach((wf: any) => {
      registry.set(wf.key, wf.config)
    })
    workflowRegistry.value = registry
  }
  catch {
    // Silently ignore
  }
}

function getWorkflowType(item: any) {
  const varType = getVariable(item, 'workflowType')
  if (varType)
    return varType

  const defKey = item.processDefinitionKey
  if (defKey && workflowRegistry.value.has(defKey)) {
    return workflowRegistry.value.get(defKey).workflowType
  }
  return undefined
}

async function fetchHistory() {
  loading.value = true
  try {
    const { data } = await api.get('/workflow/history')
    history.value = data.data || []
    await fetchWorkflowMetadata()
  }
  catch (error) {
    console.error(error)
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchHistory()
})
</script>

<template>
  <div class="flex-1 space-y-4 p-8 pt-6">
    <div class="flex items-center justify-between space-y-2">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">
          {{ t('workflow.tabs.history') }} (Workflow Audit)
        </h2>
        <p class="text-muted-foreground">
          Audit log of all workflow executions.
        </p>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="text-muted-foreground">Loading history...</span>
    </div>

    <div v-else-if="history.length === 0" class="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/5 border-dashed">
      <History class="w-12 h-12 mb-4 text-muted-foreground/50" />
      <h3 class="text-lg font-medium">
        No history found
      </h3>
      <p class="text-sm text-muted-foreground">
        You haven't participated in any workflows yet.
      </p>
    </div>

    <div v-else class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Process</TableHead>
            <TableHead>Initiator</TableHead>
            <TableHead>Start Time</TableHead>
            <TableHead>End Time</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Latest Comment</TableHead>
            <TableHead class="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="item in history" :key="item.id">
            <TableCell>
              <div class="font-medium">
                {{ item.processDefinitionName || item.processDefinitionKey }}
              </div>
              <div v-if="getWorkflowType(item)" class="mt-1">
                <Badge variant="outline" class="text-[10px] h-5 px-1.5 font-normal text-muted-foreground">
                  {{ getWorkflowType(item) }}
                </Badge>
              </div>
            </TableCell>
            <TableCell class="text-xs text-muted-foreground">
              {{ getVariable(item, 'initiator') || '-' }}
            </TableCell>
            <TableCell>{{ formatDate(item.startTime) }}</TableCell>
            <TableCell>{{ item.endTime ? formatDate(item.endTime) : '-' }}</TableCell>
            <TableCell>
              <Badge :variant="item.endTime ? 'secondary' : 'default'">
                {{ item.endTime ? t('workflow.status.completed') : t('workflow.status.active') }}
              </Badge>
            </TableCell>
            <TableCell>
              <span v-if="getVariable(item, 'approved') !== undefined && getVariable(item, 'approved') !== null">
                <Badge :variant="getVariable(item, 'approved') ? 'default' : 'destructive'" :class="getVariable(item, 'approved') ? 'bg-green-500 hover:bg-green-600' : ''">
                  {{ getVariable(item, 'approved') ? t('workflow.timeline.status_approved') : t('workflow.timeline.status_rejected') }}
                </Badge>
              </span>
              <span v-else>-</span>
            </TableCell>
            <TableCell class="max-w-[200px] truncate text-xs text-muted-foreground">
              {{ getVariable(item, 'lastComment') || '-' }}
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="icon" class="h-8 w-8" @click="router.push({ name: 'workflow-history-detail', params: { id: item.id } })">
                <Eye class="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
