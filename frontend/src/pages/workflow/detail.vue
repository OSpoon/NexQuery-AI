<script setup lang="ts">
import { Activity, ArrowLeft, CheckCircle2, CodeXml, GitPullRequest, XCircle } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import BpmnViewer from '@/components/workflow/BpmnViewer.vue'
import WorkflowTimeline from '@/components/workflow/WorkflowTimeline.vue'
import api from '@/lib/api'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const instanceId = route.params.id as string

const loading = ref(true)
const detail = ref<any>(null)
const activeTasks = ref<any[]>([])
const historicTasks = ref<any[]>([])
const comments = ref<any[]>([])
const xml = ref('')
const diagramLoading = ref(false)
const approvalComment = ref('')
const isSubmitting = ref(false)
const taskSequence = ref<any[]>([])

async function fetchData() {
  loading.value = true
  xml.value = ''
  try {
    const { data } = await api.get(`/workflow/process-instances/${instanceId}`)
    detail.value = data.detail // API now returns 'detail' instead of 'instance'
    activeTasks.value = data.activeTasks || []
    historicTasks.value = data.historicTasks || []
    comments.value = data.comments || []
    taskSequence.value = data.taskSequence || []

    // Fetch XML
    if (detail.value?.processDefinitionId) {
      diagramLoading.value = true
      try {
        const xmlRes = await api.get(`/workflow/definitions/${detail.value.processDefinitionId}/xml`, {
          responseType: 'text',
        })
        xml.value = typeof xmlRes.data === 'string' ? xmlRes.data : new XMLSerializer().serializeToString(xmlRes.data)
      }
      catch {
        toast.error(t('workflow.toast.failed_to_load_diagram'))
      }
      finally {
        diagramLoading.value = false
      }
    }
  }
  catch {
    toast.error(t('workflow.toast.failed_to_load_details'))
  }
  finally {
    loading.value = false
  }
}

async function handleComplete(taskId: string, approved: boolean) {
  if (!approvalComment.value || approvalComment.value.trim().length < 5) {
    toast.error(t('workflow.toast.comment_required'))
    return
  }

  isSubmitting.value = true
  try {
    await api.post(`/workflow/tasks/${taskId}/complete`, {
      variables: {
        approved,
        comment: approvalComment.value,
      },
    })
    toast.success(t(approved ? 'workflow.toast.request_approved' : 'workflow.toast.request_rejected'))
    approvalComment.value = ''
    fetchData() // Refresh
  }
  catch {
    toast.error(t('workflow.toast.action_failed'))
  }
  finally {
    isSubmitting.value = false
  }
}

const activeNodeIds = computed(() => {
  return activeTasks.value.map(t => t.taskDefinitionKey)
})

onMounted(fetchData)
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-4rem)]">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" @click="router.back()">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <div>
          <h1 class="text-xl font-bold tracking-tight">
            Approval Management
          </h1>
          <p class="text-xs text-muted-foreground font-mono">
            {{ instanceId }}
          </p>
        </div>
      </div>
      <div v-if="detail" class="flex gap-2">
        <Badge :variant="detail.endTime ? 'secondary' : 'default'">
          {{ detail.endTime ? 'Completed' : 'Running' }}
        </Badge>
      </div>
    </div>

    <!-- Main Content -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <Activity class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else-if="detail" class="flex-1 flex overflow-hidden">
      <!-- Left Panel: Timeline & Approval -->
      <div class="w-full xl:w-[480px] border-r overflow-y-auto bg-muted/30 p-6 space-y-6">
        <!-- Timeline -->
        <div>
          <h3 class="text-sm font-bold flex items-center gap-2 mb-4">
            <GitPullRequest class="h-4 w-4 text-primary" /> Approval Timeline
          </h3>
          <WorkflowTimeline
            :historic-tasks="historicTasks"
            :active-tasks="activeTasks"
            :comments="comments"
            :process-instance="detail"
            :task-sequence="taskSequence"
          />
        </div>

        <!-- Active Task Approval Form -->
        <div v-if="activeTasks.length > 0" class="space-y-4 pt-6 border-t">
          <h3 class="text-sm font-bold flex items-center gap-2">
            <Activity class="h-4 w-4 text-primary" /> Your Action Required
          </h3>
          <Card v-for="task in activeTasks" :key="task.id" class="border-primary/20 shadow-sm border-2">
            <CardHeader class="pb-2">
              <CardTitle class="text-base">
                {{ task.name }}
              </CardTitle>
              <CardDescription>Your decision is required to proceed</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4 pt-4">
              <div class="space-y-2">
                <Label for="comment" class="text-xs">Reason/Comment <span class="text-destructive">*</span></Label>
                <Textarea
                  id="comment"
                  v-model="approvalComment"
                  placeholder="Why are you approving/rejecting this?"
                  class="bg-background min-h-[100px]"
                />
              </div>
              <div class="flex gap-2">
                <Button
                  variant="destructive"
                  class="flex-1"
                  :disabled="isSubmitting"
                  @click="handleComplete(task.id, false)"
                >
                  <XCircle class="mr-2 h-4 w-4" /> Reject
                </Button>
                <Button
                  class="flex-1 bg-green-600 hover:bg-green-700"
                  :disabled="isSubmitting || !approvalComment || approvalComment.trim().length < 5"
                  @click="handleComplete(task.id, true)"
                >
                  <CheckCircle2 class="mr-2 h-4 w-4" /> Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div v-else-if="!detail.endTime" class="flex flex-col items-center justify-center py-12 text-center text-muted-foreground italic text-sm">
          Waiting for others to complete tasks...
        </div>
      </div>

      <!-- Right Panel: BPMN Viewer -->
      <div class="flex-1 bg-white relative">
        <div class="absolute inset-0 p-8 flex items-center justify-center">
          <div v-if="diagramLoading" class="flex flex-col items-center gap-3 text-muted-foreground animate-in fade-in duration-500">
            <Activity class="h-8 w-8 animate-spin text-primary" />
            <p class="text-xs">
              Loading Diagram...
            </p>
          </div>
          <div v-else-if="!xml" class="flex flex-col items-center gap-3 text-muted-foreground">
            <div class="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <CodeXml class="h-6 w-6" />
            </div>
            <p class="text-sm italic">
              Diagram source not available
            </p>
          </div>
          <BpmnViewer
            v-else
            :xml="xml"
            :active-nodes="activeNodeIds"
          />
        </div>
      </div>
    </div>
  </div>
</template>
