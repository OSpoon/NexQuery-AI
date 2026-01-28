<script setup lang="ts">
import { Activity, ArrowLeft, Clock, GitPullRequest, XCircle } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

    // Removal of diagram fetching as requested
  }
  catch {
    toast.error(t('workflow.toast.failed_to_load_history'))
  }
  finally {
    loading.value = false
  }
}

const isEnded = computed(() => !!detail.value?.endTime)
const deleteReason = computed(() => detail.value?.deleteReason)

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
            Workflow Audit Log
          </h1>
          <p class="text-xs text-muted-foreground font-mono">
            {{ instanceId }}
          </p>
        </div>
      </div>
      <div v-if="detail" class="flex gap-2 items-center">
        <Badge v-if="deleteReason" variant="destructive" class="mr-2">
          Terminated / Rejected
        </Badge>
        <Badge :variant="isEnded ? 'secondary' : 'default'">
          <Clock v-if="!isEnded" class="mr-1 h-3 w-3 animate-pulse" />
          {{ isEnded ? 'Completed' : 'Still Active' }}
        </Badge>
      </div>
    </div>

    <!-- Main Content -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <Activity class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else-if="detail" class="flex-1 overflow-y-auto bg-muted/30 p-8">
      <!-- Centered Audit Trail -->
      <div class="max-w-3xl mx-auto space-y-8">
        <Card class="shadow-sm">
          <CardHeader>
            <CardTitle class="text-lg flex items-center gap-2">
              <GitPullRequest class="h-5 w-5 text-primary" /> Approval Audit Trail
            </CardTitle>
            <CardDescription>
              Detailed record of all approval steps and feedback.
            </CardDescription>
          </CardHeader>
          <CardContent class="pt-6">
            <div v-if="deleteReason" class="mb-8 p-4 bg-destructive/5 border border-destructive/10 rounded-xl text-sm">
              <div class="flex items-center gap-2 font-bold text-destructive mb-2">
                <XCircle class="h-4 w-4" />
                Workflow Terminated
              </div>
              <p class="text-muted-foreground leading-relaxed">
                {{ deleteReason }}
              </p>
            </div>

            <WorkflowTimeline
              :historic-tasks="historicTasks"
              :active-tasks="activeTasks"
              :comments="comments"
              :process-instance="detail"
              :task-sequence="taskSequence"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
