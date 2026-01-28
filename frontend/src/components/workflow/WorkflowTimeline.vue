<script setup lang="ts">
import { format } from 'date-fns'
import { Check, CheckCircle2, Circle, Clock, ShieldAlert, User as UserIcon, XCircle } from 'lucide-vue-next'
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  historicTasks: any[]
  activeTasks: any[]
  comments?: any[]
  processInstance?: any
  taskSequence?: { name: string }[]
}>()

interface TimelineNode {
  id: string
  name: string
  status: 'completed' | 'active' | 'pending' | 'rejected'
  assignee?: string
  startTime?: string
  endTime?: string
  comment?: string
  duration?: number
  isInitiator?: boolean
}

const timeline = computed<TimelineNode[]>(() => {
  const nodes: TimelineNode[] = []

  // 1. Add initiator node
  const variables = props.processInstance?.variables || []
  const initiator = variables.find((v: any) => v.name === 'initiator')?.value
    || props.historicTasks.find(t => t.variables?.find((v: any) => v.name === 'initiator'))?.variables?.find((v: any) => v.name === 'initiator')?.value

  if (initiator) {
    const processStartTime = props.processInstance?.startTime || props.historicTasks[0]?.startTime || props.activeTasks[0]?.createTime
    nodes.push({
      id: 'start-node',
      name: '流程启动',
      status: 'completed',
      assignee: initiator,
      startTime: processStartTime,
      endTime: processStartTime,
      comment: '提交审批请求',
      isInitiator: true,
    })
  }

  const processedNames = new Set<string>()
  let isRejected = false

  // 2. Map tasks based on taskSequence if available
  if (props.taskSequence && props.taskSequence.length > 0) {
    props.taskSequence.forEach((seqStep, index) => {
      // If a rejection was ALREADY encountered in this sequence,
      // all SUBSEQUENT steps are definitively pending/skipped.
      if (isRejected) {
        nodes.push({
          id: `seq-${index}`,
          name: seqStep.name,
          status: 'pending',
        })
        return
      }

      // Find tasks matching this step's name.
      // 1. Success task: Completed normally (no deleteReason or 'completed')
      // 2. Active task: Currently being worked on
      // 3. Terminated/Cancelled task: Has a deleteReason (e.g., process aborted)
      const successfulTask = props.historicTasks.find(t => t.name === seqStep.name && (!t.deleteReason || t.deleteReason === 'completed'))
      const cancelledTask = props.historicTasks.find(t => t.name === seqStep.name && (t.deleteReason && t.deleteReason !== 'completed'))
      const activeTask = props.activeTasks.find(t => t.name === seqStep.name)

      if (successfulTask && successfulTask.endTime) {
        const combinedVars = [...(successfulTask.variables || []), ...(successfulTask.taskLocalVariables || [])]

        // CRITICAL: Prioritize the unique 'taskOutcome' variable
        const taskOutcome = combinedVars.find((v: any) => v.name === 'taskOutcome')?.value
        // Fallback to legacy 'approved' if taskOutcome is missing
        const localApproved = combinedVars.find((v: any) => v.name === 'approved')?.value

        let status: 'completed' | 'rejected' = 'completed'
        if (taskOutcome === 'rejected' || localApproved === false) {
          status = 'rejected'
          isRejected = true
        }

        const taskComment = props.comments?.find((c: any) => c.taskId === successfulTask.id)?.message
          || combinedVars.find((v: any) => v.name === 'comment')?.value
          || combinedVars.find((v: any) => v.name === 'lastComment')?.value

        const approver = combinedVars.find((v: any) => v.name === 'approver')?.value
          ?? successfulTask.assignee
          ?? successfulTask.owner

        nodes.push({
          id: successfulTask.id,
          name: successfulTask.name || successfulTask.taskDefinitionKey,
          status,
          assignee: approver,
          startTime: successfulTask.startTime,
          endTime: successfulTask.endTime,
          comment: taskComment,
          duration: successfulTask.durationInMillis,
        })
        processedNames.add(seqStep.name)
      }
      else if (cancelledTask) {
        // This task was started but cancelled (e.g. by rejection of previous step)
        nodes.push({
          id: cancelledTask.id,
          name: cancelledTask.name || cancelledTask.taskDefinitionKey,
          status: 'pending', // Gray
        })
        processedNames.add(seqStep.name)
      }
      else if (activeTask) {
        nodes.push({
          id: activeTask.id,
          name: activeTask.name || activeTask.taskDefinitionKey,
          status: 'active',
          assignee: activeTask.assignee,
          startTime: activeTask.createTime,
        })
        processedNames.add(seqStep.name)
      }
      else {
        // Not reached yet
        nodes.push({
          id: `seq-${index}`,
          name: seqStep.name,
          status: 'pending', // Gray
        })
      }
    })
  }
  else {
    // Fallback logic
    props.historicTasks.forEach((task) => {
      if (task.deleteReason && task.deleteReason !== 'completed')
        return
      if (task.endTime) {
        const variables = task.variables || []
        const localOutcome = variables.find((v: any) => v.name === 'taskOutcome' && v.scope === 'local')?.value
        const isRejected = localOutcome === 'rejected'

        nodes.push({
          id: task.id,
          name: task.name,
          status: isRejected ? 'rejected' : 'completed',
          assignee: task.assignee,
          startTime: task.startTime,
          endTime: task.endTime,
          comment: props.comments?.find((c: any) => c.taskId === task.id)?.message,
        })
      }
    })
    // (Active tasks logic omitted for brevity in fallback)
  }

  // 4. Heuristic: If rejected, the process is finished.
  // We can't easily show "skipped" nodes without the full model,
  // but the current tasks will show the termination path correctly.

  return nodes
})

function formatDuration(ms?: number) {
  if (!ms)
    return ''
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  if (hours > 0)
    return `${hours}h ${minutes % 60}m`
  return `${minutes}m`
}
</script>

<template>
  <div class="space-y-1">
    <div
      v-for="(node, index) in timeline"
      :key="node.id"
      class="relative pl-8 pb-8 last:pb-0"
    >
      <!-- Timeline Line -->
      <div
        v-if="index < timeline.length - 1"
        class="absolute left-[15px] top-6 bottom-0 w-0.5"
        :class="{
          'bg-green-500': node.status === 'completed',
          'bg-red-500': node.status === 'rejected',
          'bg-blue-500': node.status === 'active',
          'bg-gray-300 dark:bg-gray-700': node.status === 'pending',
        }"
      />

      <!-- Timeline Icon -->
      <div
        class="absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center border-2"
        :class="{
          'bg-green-50 dark:bg-green-950 border-green-500 text-green-600 dark:text-green-400': node.status === 'completed',
          'bg-red-50 dark:bg-red-950 border-red-500 text-red-600 dark:text-red-400': node.status === 'rejected',
          'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-600 dark:text-blue-400 ring-4 ring-blue-100 dark:ring-blue-900': node.status === 'active',
          'bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-400': node.status === 'pending',
        }"
      >
        <Check v-if="node.status === 'completed'" class="h-4 w-4" />
        <XCircle v-else-if="node.status === 'rejected'" class="h-4 w-4" />
        <Circle v-else-if="node.status === 'active'" class="h-4 w-4 fill-current" />
        <Clock v-else class="h-4 w-4" />
      </div>

      <!-- Timeline Content -->
      <div
        class="bg-card border rounded-lg p-4 shadow-sm"
        :class="{
          'border-green-200 dark:border-green-800': node.status === 'completed',
          'border-red-200 dark:border-red-800': node.status === 'rejected',
          'border-blue-300 dark:border-blue-700 shadow-md': node.status === 'active',
          'border-gray-200 dark:border-gray-800 opacity-60': node.status === 'pending',
        }"
      >
        <div class="flex items-start justify-between gap-4 mb-2">
          <div class="flex-1">
            <h4 class="font-semibold text-sm">
              {{ node.name }}
            </h4>
            <div v-if="node.assignee" class="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <UserIcon class="h-3 w-3" />
              <span class="font-medium">{{ node.isInitiator ? '发起人:' : '审批人:' }}</span>
              <span>{{ node.assignee }}</span>
            </div>
            <div v-if="node.comment" class="mt-4 p-3 bg-muted/50 rounded-md border border-dashed text-xs">
              <div
                class="flex items-center gap-1 mb-1 font-semibold"
                :class="node.status === 'rejected' ? 'text-red-600' : 'text-green-600'"
              >
                <ShieldAlert v-if="node.status === 'rejected'" class="h-3 w-3" />
                <CheckCircle2 v-else class="h-3 w-3" />
                {{ node.status === 'rejected' ? '拒绝原因:' : '审批备注:' }}
              </div>
              <div class="text-muted-foreground italic whitespace-pre-wrap">
                {{ node.comment }}
              </div>
            </div>
          </div>
          <Badge
            :variant="node.status === 'completed' ? 'default' : node.status === 'rejected' ? 'destructive' : node.status === 'active' ? 'secondary' : 'outline'"
            class="text-xs"
          >
            {{ node.status === 'completed' ? '已通过' : node.status === 'rejected' ? '已拒绝' : node.status === 'active' ? '进行中' : '待处理' }}
          </Badge>
        </div>

        <!-- Timestamps -->
        <div class="text-xs text-muted-foreground space-y-0.5">
          <div v-if="node.startTime">
            开始: {{ format(new Date(node.startTime), 'yyyy-MM-dd HH:mm:ss') }}
          </div>
          <div v-if="node.endTime">
            完成: {{ format(new Date(node.endTime), 'yyyy-MM-dd HH:mm:ss') }}
            <span v-if="node.duration" class="ml-2 text-green-600 dark:text-green-400">
              ({{ formatDuration(node.duration) }})
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="timeline.length === 0" class="text-center py-8 text-muted-foreground text-sm">
      暂无审批记录
    </div>
  </div>
</template>
