<script setup lang="ts">
import { format } from 'date-fns'
import { CheckCircle2, Eye } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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
import api from '@/lib/api'

const router = useRouter()
const { t } = useI18n()

const tasks = ref<any[]>([])
const loading = ref(false)

function getVariable(processInstance: any, name: string) {
  if (!processInstance || !processInstance.variables)
    return undefined
  const v = processInstance.variables.find((v: any) => v.name === name)
  return v ? v.value : undefined
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

async function fetchTasks() {
  loading.value = true
  try {
    const res = await api.get('/workflow/tasks')
    // Flowable returns { data: [...], total: ... }
    tasks.value = res.data.data || []
  }
  catch {
    // Silently ignore
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchTasks()
})
</script>

<template>
  <div class="flex-1 space-y-4 p-8 pt-6">
    <div class="flex items-center justify-between space-y-2">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">
          {{ t('workflow.tabs.my_tasks') }}
        </h2>
        <p class="text-muted-foreground">
          View and manage tasks assigned to you.
        </p>
      </div>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Pending Tasks</CardTitle>
        <CardDescription>
          Tasks assigned to you or your groups.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="loading" class="flex justify-center py-8">
          <span class="text-muted-foreground">Loading tasks...</span>
        </div>
        <div v-else-if="tasks.length === 0" class="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <CheckCircle2 class="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p class="text-lg font-medium">
            No pending tasks
          </p>
          <p class="text-sm">
            You're all caught up! Check Process Management to start a new process.
          </p>
        </div>
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Process</TableHead>
              <TableHead>Initiator</TableHead>
              <TableHead>Task Name</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="task in tasks" :key="task.id">
              <TableCell class="font-medium">
                {{ task.processDefinitionId.split(':')[0] }}
              </TableCell>
              <TableCell class="text-xs text-muted-foreground">
                {{ getVariable(task, 'initiator') || '-' }}
              </TableCell>
              <TableCell>
                {{ task.name }}
              </TableCell>
              <TableCell>{{ formatDate(task.createTime) }}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  @click="router.push({ name: 'workflow-detail', params: { id: task.processInstanceId } })"
                >
                  <Eye class="mr-2 h-4 w-4" />
                  Review Request
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
</template>
