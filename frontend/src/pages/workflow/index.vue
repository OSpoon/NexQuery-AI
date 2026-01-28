<script setup lang="ts">
import { format } from 'date-fns'
import { CheckCircle2, Eye, History, Play, Plus } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import BpmnViewer from '@/components/workflow/BpmnViewer.vue'
import api from '@/lib/api'

const router = useRouter()
const { t } = useI18n()

const processDefinitions = ref<any[]>([])
const tasks = ref<any[]>([])
const history = ref<any[]>([])
const loading = ref(false)

const simulatedSql = ref('UPDATE users SET role = \'admin\' WHERE id = 1;')

const workflowRegistry = ref<Map<string, any>>(new Map())

function getVariable(processInstance: any, name: string) {
  if (!processInstance || !processInstance.variables)
    return undefined
  const v = processInstance.variables.find((v: any) => v.name === name)
  return v ? v.value : undefined
}

function getWorkflowType(item: any) {
  const varType = getVariable(item, 'workflowType')
  if (varType)
    return varType

  // Fallback to registry if we have the definition key
  const defKey = item.processDefinitionKey
  if (defKey && workflowRegistry.value.has(defKey)) {
    return workflowRegistry.value.get(defKey).workflowType
  }
  return undefined
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
    // Create a map: processKey -> metadata
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

async function fetchProcessDefinitions() {
  loading.value = true
  try {
    const res = await api.get('/workflow/definitions')
    // Flowable returns { data: [...], total: ... }
    const definitions = res.data.data || []
    processDefinitions.value = definitions

    // Fetch metadata for each definition
    await fetchWorkflowMetadata()
  }
  catch {
    toast.error(t('workflow.toast.failed_to_load'))
  }
  finally {
    loading.value = false
  }
}

async function fetchTasks() {
  try {
    const res = await api.get('/workflow/tasks')
    // Flowable returns { data: [...], total: ... }
    tasks.value = res.data.data || []
  }
  catch {
    // Silently ignore
  }
}

const selectedProcess = ref<any>(null)
const isDiagramOpen = ref(false)
const selectedDefXML = ref('')
const isXMLOpen = ref(false)

function openStartDialog(def: any) {
  selectedProcess.value = def
}

function handleApiError(error: any, defaultKey: string) {
  const backendMessage = error.response?.data?.message || ''
  if (backendMessage.includes('bound to a system process')) {
    toast.error(t('workflow.toast.error_binding_active'))
  }
  else {
    toast.error(`${t(defaultKey)}: ${backendMessage || error.message}`)
  }
}

async function startProcess() {
  if (!selectedProcess.value)
    return

  try {
    await api.post('/workflow/process-instances', {
      key: selectedProcess.value.key,
      variables: {
        sqlQuery: simulatedSql.value,
        riskLevel: 'HIGH',
      },
    })
    toast.success(t('workflow.toast.request_submitted'))
    fetchTasks()
    // Reset defaults and close dialog
    simulatedSql.value = 'UPDATE users SET role = \'admin\' WHERE id = 1;'
    selectedProcess.value = null
  }
  catch (error: any) {
    handleApiError(error, 'workflow.toast.failed_to_start')
  }
}

async function fetchHistory() {
  try {
    const { data } = await api.get('/workflow/history')
    history.value = data.data || []
  }
  catch (error) {
    console.error(error)
  }
}

async function toggleState(def: any) {
  const action = def.suspended ? 'activate' : 'suspend'
  try {
    await api.put(`/workflow/definitions/${def.id}/state`, { action })
    toast.success(t(action === 'activate' ? 'workflow.toast.workflow_activated' : 'workflow.toast.workflow_suspended'))
    fetchProcessDefinitions()
  }
  catch (error: any) {
    handleApiError(error, 'workflow.toast.failed_to_update')
  }
}

async function deleteWorkflow(def: any) {
  // eslint-disable-next-line no-alert
  if (!confirm(t('workflow.confirm_delete', { key: def.key }))) {
    return
  }

  try {
    await api.delete(`/workflow/deployments/${def.deploymentId}`)
    toast.success(t('workflow.toast.workflow_deleted'))
    fetchProcessDefinitions()
  }
  catch (error: any) {
    handleApiError(error, 'workflow.toast.failed_to_delete')
  }
}

onMounted(async () => {
  loading.value = true
  await Promise.all([
    fetchProcessDefinitions(),
    fetchTasks(),
    fetchHistory(),
  ]).finally(() => {
    loading.value = false
  })
})
</script>

<template>
  <div class="flex-1 space-y-4 p-8 pt-6">
    <div class="flex items-center justify-between space-y-2">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">
          {{ t('workflow.title') }}
        </h2>
        <p class="text-muted-foreground">
          {{ t('workflow.desc') }}
        </p>
      </div>
    </div>

    <Tabs default-value="tasks" class="space-y-4">
      <TabsList>
        <TabsTrigger value="tasks">
          {{ t('workflow.tabs.my_tasks') }}
        </TabsTrigger>
        <TabsTrigger value="definitions">
          {{ t('workflow.tabs.available_workflows') }}
        </TabsTrigger>
        <TabsTrigger value="history">
          {{ t('workflow.tabs.history') }}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tasks" class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Pending Tasks</CardTitle>
            <CardDescription>
              Tasks assigned to you or your groups.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="tasks.length === 0" class="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <CheckCircle2 class="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p class="text-lg font-medium">
                No pending tasks
              </p>
              <p class="text-sm">
                You're all caught up! Check available workflows to start a new process.
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
      </TabsContent>

      <TabsContent value="definitions" class="space-y-4">
        <div class="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          <!-- Create New Workflow Card (Always Visible) -->
          <Card
            class="hover:shadow-md transition-shadow min-w-[320px] flex flex-col cursor-pointer border-dashed border-2 hover:border-primary/50 hover:bg-muted/30"
            @click="router.push({ name: 'workflow-definition', params: { id: 'new' } })"
          >
            <CardContent class="flex flex-col items-center justify-center py-12 text-center">
              <div class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Plus class="h-6 w-6 text-primary" />
              </div>
              <h3 class="font-semibold text-lg mb-2">
                {{ t('workflow.create_new') }}
              </h3>
              <p class="text-sm text-muted-foreground">
                Design a custom approval process
              </p>
            </CardContent>
          </Card>

          <!-- Existing Workflow Cards -->
          <Card v-for="def in processDefinitions" :key="def.id" class="hover:shadow-md transition-shadow min-w-[320px] flex flex-col">
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2 overflow-hidden">
              <div class="flex items-center gap-2 min-w-0">
                <Badge :variant="def.suspended ? 'destructive' : 'default'" class="shrink-0 font-normal text-[10px] h-5">
                  {{ def.suspended ? 'Suspended' : 'Active' }}
                </Badge>
                <CardTitle class="text-sm font-medium truncate">
                  {{ def.category || 'Process' }}
                </CardTitle>
              </div>
              <Play class="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent class="overflow-hidden">
              <div class="text-2xl font-bold mb-2 truncate" :title="def.name || def.key">
                {{ def.name || def.key }}
              </div>
              <!-- Version Badge (Always Show) -->
              <div class="flex flex-wrap gap-1.5 mb-3">
                <Badge variant="outline" class="text-[10px] font-normal border-primary/30 text-primary">
                  v{{ def.version }}
                </Badge>
                <!-- Workflow Metadata (If Registry Available) -->
                <template v-if="workflowRegistry.get(def.key)">
                  <Badge variant="outline">
                    {{ t('workflow.priority') }}: {{ workflowRegistry.get(def.key).priority }}
                  </Badge>
                  <Badge variant="outline" class="text-[10px] font-normal">
                    {{ workflowRegistry.get(def.key).workflowType || 'custom' }}
                  </Badge>
                  <Badge
                    v-if="workflowRegistry.get(def.key).priority"
                    :variant="workflowRegistry.get(def.key).priority === 'high' ? 'destructive' : 'secondary'"
                    class="text-[10px] font-normal"
                  >
                    {{ workflowRegistry.get(def.key).priority }} priority
                  </Badge>
                </template>
              </div>

              <p class="text-xs text-muted-foreground mb-3 line-clamp-2">
                {{ workflowRegistry.get(def.key)?.description || def.description || 'No description available' }}
              </p>

              <!-- Trigger Keywords (if SQL Approval) -->
              <div v-if="workflowRegistry.get(def.key)?.workflowType === 'sql_approval' && workflowRegistry.get(def.key)?.triggerKeywords?.length" class="mb-3">
                <p class="text-[10px] text-muted-foreground mb-1">
                  Trigger Keywords:
                </p>
                <div class="flex flex-wrap gap-1">
                  <Badge
                    v-for="keyword in workflowRegistry.get(def.key).triggerKeywords.slice(0, 5)"
                    :key="keyword"
                    variant="secondary"
                    class="text-[9px] px-1 py-0"
                  >
                    {{ keyword }}
                  </Badge>
                  <Badge
                    v-if="workflowRegistry.get(def.key).triggerKeywords.length > 5"
                    variant="secondary"
                    class="text-[9px] px-1 py-0"
                  >
                    +{{ workflowRegistry.get(def.key).triggerKeywords.length - 5 }}
                  </Badge>
                </div>
              </div>

              <div class="flex flex-col gap-2 mt-auto">
                <Button class="w-full shadow-sm" variant="default" :disabled="def.suspended" @click="openStartDialog(def)">
                  <Play class="mr-2 h-4 w-4" />
                  Simulate Trigger
                </Button>

                <Button
                  variant="outline"
                  class="w-full"
                  size="sm"
                  @click="router.push({ name: 'workflow-definition', params: { id: def.id } })"
                >
                  <Eye class="mr-2 h-4 w-4" /> View Details
                </Button>

                <div class="flex items-center justify-between pt-2 border-t text-xs font-medium mt-1">
                  <Button variant="link" class="h-auto p-0 text-muted-foreground hover:text-primary" @click="toggleState(def)">
                    {{ def.suspended ? 'Activate' : 'Suspend' }}
                  </Button>
                  <Button variant="link" class="h-auto p-0 text-destructive hover:text-destructive/80" @click="deleteWorkflow(def)">
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <!-- History Tab -->
      <TabsContent value="history" class="space-y-4">
        <div v-if="history.length === 0" class="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/5 border-dashed">
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
                  <!-- Try to find approval result variable -->
                  <span v-if="getVariable(item, 'approved') !== null">
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
      </TabsContent>
    </Tabs>

    <!-- Start Process Dialog -->
    <Dialog :open="!!selectedProcess" @update:open="(val: boolean) => !val && (selectedProcess = null)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simulate SQL Request</DialogTitle>
          <DialogDescription>
            Simulate a high-risk SQL execution request to trigger the '{{ selectedProcess?.name }}' workflow.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label>SQL Query</Label>
            <Textarea
              v-model="simulatedSql"
              placeholder="UPDATE users SET role = 'admin' WHERE id = 1;"
              rows="4"
            />
          </div>
        </div>
        <DialogFooter>
          <Button @click="startProcess">
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Diagram Dialog -->

    <!-- Diagram Dialog -->
    <Dialog :open="isDiagramOpen" @update:open="(val) => !val && (isDiagramOpen = false)">
      <DialogContent class="sm:max-w-[1000px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Process Diagram</DialogTitle>
          <DialogDescription>
            Visual representation of the BPMN workflow.
          </DialogDescription>
        </DialogHeader>
        <div class="flex-1 overflow-hidden bg-white rounded border mt-4 flex justify-center items-center h-[600px]">
          <BpmnViewer
            v-if="selectedDefXML"
            :xml="selectedDefXML"
          />
        </div>
      </DialogContent>
    </Dialog>

    <!-- XML View Dialog -->
    <Dialog :open="isXMLOpen" @update:open="(val) => !val && (isXMLOpen = false)">
      <DialogContent class="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>BPMN Source Code</DialogTitle>
          <DialogDescription>
            The underlying XML definition for this process.
          </DialogDescription>
        </DialogHeader>
        <div class="flex-1 overflow-auto mt-4">
          <pre class="bg-muted p-4 rounded-md font-mono text-xs">{{ selectedDefXML }}</pre>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
