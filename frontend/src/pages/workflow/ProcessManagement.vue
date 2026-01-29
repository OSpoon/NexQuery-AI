<script setup lang="ts">
import { Play, Plus, Trash2 } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import api from '@/lib/api'

const router = useRouter()
const { t } = useI18n()

const processDefinitions = ref<any[]>([])
const loading = ref(false)
const workflowRegistry = ref<Map<string, any>>(new Map())

const simulatedSql = ref('UPDATE users SET role = \'admin\' WHERE id = 1;')
const selectedProcess = ref<any>(null)

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

async function fetchProcessDefinitions() {
  loading.value = true
  try {
    const res = await api.get('/workflow/definitions')
    const definitions = res.data.data || []
    processDefinitions.value = definitions
    await fetchWorkflowMetadata()
  }
  catch {
    toast.error(t('workflow.toast.failed_to_load'))
  }
  finally {
    loading.value = false
  }
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
    simulatedSql.value = 'UPDATE users SET role = \'admin\' WHERE id = 1;'
    selectedProcess.value = null
  }
  catch (error: any) {
    handleApiError(error, 'workflow.toast.failed_to_start')
  }
}

async function deleteWorkflow(def: any) {
  // Check for active process instances first
  try {
    const instancesRes = await api.get(`/workflow/definitions/${def.id}/instances`)
    const activeCount = instancesRes.data?.total || 0
    if (activeCount > 0) {
      toast.error(t('workflow.toast.cannot_delete_active_instances', { count: activeCount }))
      return
    }
  }
  catch {
    // Silently continue if check fails
  }

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

function openStartDialog(def: any) {
  selectedProcess.value = def
}

onMounted(() => {
  fetchProcessDefinitions()
})
</script>

<template>
  <div class="flex-1 space-y-4 p-8 pt-6">
    <div class="flex items-center justify-between space-y-2">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">
          {{ t('workflow.tabs.available_workflows') }} (Process Management)
        </h2>
        <p class="text-muted-foreground">
          Manage and deploy business process definitions.
        </p>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="text-muted-foreground">Loading definitions...</span>
    </div>

    <div v-else class="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      <!-- Existing Workflow Cards -->
      <Card v-for="def in processDefinitions" :key="def.id" class="hover:shadow-md transition-shadow min-w-[320px] flex flex-col group">
        <CardHeader class="flex flex-row items-start justify-between space-y-0 pb-3">
          <div class="space-y-2 flex-1 min-w-0">
            <div class="text-lg font-bold truncate leading-none group-hover:text-primary transition-colors" :title="def.name || def.key">
              {{ def.name || def.key }}
            </div>
            <div class="flex flex-wrap gap-1.5">
              <Badge variant="outline" class="text-[10px] font-normal border-primary/30 text-primary h-5 px-1.5 bg-primary/5">
                v{{ def.version }}
              </Badge>
              <Badge
                v-if="workflowRegistry.get(def.key)?.priority"
                :variant="workflowRegistry.get(def.key).priority === 'high' ? 'destructive' : 'secondary'"
                class="text-[10px] font-normal h-5 px-1.5 capitalize"
              >
                {{ workflowRegistry.get(def.key).priority }}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="shrink-0 h-8 w-8 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-2 transition-colors"
            @click="deleteWorkflow(def)"
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent class="flex-1 flex flex-col pt-0 pb-4">
          <p class="text-xs text-muted-foreground mb-4 line-clamp-2 min-h-10">
            {{ workflowRegistry.get(def.key)?.description || def.description || 'No description available' }}
          </p>

          <div v-if="workflowRegistry.get(def.key)?.workflowType === 'sql_approval' && workflowRegistry.get(def.key)?.triggerKeywords?.length" class="mb-4">
            <div class="flex items-center gap-1.5 mb-2">
              <div class="h-px flex-1 bg-border/50" />
              <span class="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Keywords</span>
              <div class="h-px flex-1 bg-border/50" />
            </div>
            <div class="flex flex-wrap gap-1">
              <Badge
                v-for="keyword in workflowRegistry.get(def.key).triggerKeywords.slice(0, 5)"
                :key="keyword"
                variant="secondary"
                class="text-[9px] px-1.5 py-0 bg-muted/60 text-muted-foreground hover:bg-muted font-mono"
              >
                {{ keyword }}
              </Badge>
              <Badge
                v-if="workflowRegistry.get(def.key).triggerKeywords.length > 5"
                variant="outline"
                class="text-[9px] px-1 py-0 border-dashed"
              >
                +{{ workflowRegistry.get(def.key).triggerKeywords.length - 5 }}
              </Badge>
            </div>
          </div>

          <div class="flex flex-col gap-2 mt-auto">
            <Button variant="default" size="sm" class="w-full shadow-sm font-medium" :disabled="def.suspended" @click="openStartDialog(def)">
              <Play class="mr-2 h-4 w-4" />
              Simulate Trigger
            </Button>

            <Button
              variant="ghost"
              class="w-full text-muted-foreground hover:text-primary hover:bg-primary/5"
              size="sm"
              @click="router.push({ name: 'workflow-definition', params: { id: def.id } })"
            >
              <Eye class="mr-2 h-4 w-4" /> View Details
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Create New Workflow Card -->
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
    </div>

    <!-- Start Process Dialog -->
    <Dialog :open="!!selectedProcess" @update:open="(val) => !val && (selectedProcess = null)">
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
  </div>
</template>
