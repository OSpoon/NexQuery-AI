<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { DateTime } from 'luxon'
import { useSettingsStore } from '@/stores/settings'
import DateTimePicker from '@/components/common/DateTimePicker.vue'
import { Plus, Trash2, Edit, CalendarClock, Mail, Globe } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'
import { toast } from 'vue-sonner'
import { useDebounceFn } from '@vueuse/core'

const props = defineProps<{
  queryTaskId: number
}>()

interface ScheduledQuery {
  id: number
  cronExpression: string | null
  runAt: string | null
  recipients: string[]
  webhookUrl?: string
  isActive: boolean
  createdAt: string
  creator?: { fullName: string }
}

const schedules = ref<ScheduledQuery[]>([])
const isDialogOpen = ref(false)
const isSubmitting = ref(false)
const editingId = ref<number | null>(null)

const settingsStore = useSettingsStore()
const systemTimezone = computed(() => settingsStore.systemTimezone)

const form = ref({
  executionType: 'recurring' as 'recurring' | 'one-off',
  cronExpression: '',
  runAt: '',
  recipients: '',
  webhookUrl: '',
  isActive: true,
})

// ...

const nextExecutions = ref<string[]>([])
const cronError = ref('')

const validateCron = useDebounceFn(async (expression: string) => {
  if (!expression) {
    nextExecutions.value = []
    cronError.value = ''
    return
  }

  try {
    const res = await api.get('/scheduled-queries/check-cron', {
      params: { expression },
    })

    if (res.data.valid) {
      nextExecutions.value = res.data.nextExecutions
      cronError.value = ''
    } else {
      nextExecutions.value = []
      cronError.value = res.data.error
    }
  } catch (err) {
    nextExecutions.value = []
    cronError.value = 'Validation failed'
  }
}, 500)

watch(
  () => form.value.cronExpression,
  (newVal) => {
    validateCron(newVal)
  },
)

const fetchSchedules = async () => {
  try {
    const response = await api.get('/scheduled-queries', {
      params: { query_task_id: props.queryTaskId },
    })
    schedules.value = response.data
  } catch (error) {
    toast.error('Failed to fetch schedules')
  }
}

const formatDate = (dateStr: string) => {
  return DateTime.fromISO(dateStr, { zone: 'utc' })
    .setZone(systemTimezone.value)
    .toFormat('yyyy/MM/dd HH:mm')
}

const openCreateDialog = () => {
  editingId.value = null
  form.value = {
    executionType: 'recurring',
    cronExpression: '0 9 * * *',
    runAt: '',
    recipients: '',
    webhookUrl: '',
    isActive: true,
  }
  validateCron(form.value.cronExpression)
  isDialogOpen.value = true
}

const openEditDialog = (schedule: ScheduledQuery) => {
  editingId.value = schedule.id
  form.value = {
    executionType: schedule.runAt ? 'one-off' : 'recurring',
    cronExpression: schedule.cronExpression || '',
    runAt: schedule.runAt || '',
    recipients: Array.isArray(schedule.recipients) ? schedule.recipients.join(', ') : '',
    webhookUrl: schedule.webhookUrl || '',
    isActive: schedule.isActive,
  }
  if (form.value.executionType === 'recurring') {
    validateCron(form.value.cronExpression)
  }
  isDialogOpen.value = true
}

const saveSchedule = async () => {
  // Validate based on type
  if (form.value.executionType === 'recurring') {
    if (!form.value.cronExpression) {
      toast.error('Cron expression is required')
      return
    }
    if (cronError.value) {
      toast.error(`Invalid Cron expression: ${cronError.value}`)
      return
    }
  } else {
    if (!form.value.runAt) {
      toast.error('Execution time is required')
      return
    }
    if (new Date(form.value.runAt) <= new Date()) {
      toast.error('Execution time must be in the future')
      return
    }
  }

  // Mutually exclusive validation
  const hasRecipients = form.value.recipients && form.value.recipients.trim().length > 0
  const hasWebhook = form.value.webhookUrl && form.value.webhookUrl.trim().length > 0

  if (!hasRecipients && !hasWebhook) {
    toast.error('Please provide either Recipients or Webhook URL')
    return
  }

  isSubmitting.value = true
  try {
    const payload = {
      queryTaskId: props.queryTaskId,
      cronExpression: form.value.executionType === 'recurring' ? form.value.cronExpression : null,
      runAt: form.value.executionType === 'one-off' ? form.value.runAt : null,
      // If Webhook is provided, it takes priority and recipients are cleared
      recipients: hasWebhook
        ? []
        : form.value.recipients
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
      webhookUrl: hasWebhook ? form.value.webhookUrl : null,
      isActive: form.value.isActive,
    }

    if (editingId.value) {
      await api.put(`/scheduled-queries/${editingId.value}`, payload)
      toast.success('Schedule updated')
    } else {
      await api.post('/scheduled-queries', payload)
      toast.success('Schedule created')
    }
    isDialogOpen.value = false
    fetchSchedules()
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Failed to save schedule')
  } finally {
    isSubmitting.value = false
  }
}

const deleteSchedule = async (id: number) => {
  if (!confirm('Are you sure?')) return
  try {
    await api.delete(`/scheduled-queries/${id}`)
    toast.success('Schedule deleted')
    fetchSchedules()
  } catch (error) {
    toast.error('Failed to delete schedule')
  }
}

const toggleActive = async (schedule: ScheduledQuery) => {
  try {
    await api.put(`/scheduled-queries/${schedule.id}`, {
      ...schedule,
      isActive: !schedule.isActive,
    })
    schedule.isActive = !schedule.isActive
    toast.success(`Schedule ${schedule.isActive ? 'enabled' : 'disabled'}`)
  } catch (error) {
    toast.error('Failed to update status')
  }
}

onMounted(fetchSchedules)
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <div>
        <h3 class="text-lg font-medium">Scheduled Executions</h3>
        <p class="text-sm text-muted-foreground">
          Automatically run this query and email the results.
        </p>
      </div>
      <Button type="button" @click="openCreateDialog" size="sm">
        <Plus class="mr-2 h-4 w-4" /> Add Schedule
      </Button>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cron</TableHead>
            <TableHead>Recipients</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="schedules.length === 0">
            <TableCell colspan="5" class="text-center h-24 text-muted-foreground">
              No schedules found.
            </TableCell>
          </TableRow>
          <TableRow v-for="s in schedules" :key="s.id">
            <TableCell>
              <div class="flex items-center gap-2">
                <CalendarClock class="h-4 w-4 text-muted-foreground" />
                <code v-if="s.cronExpression" class="bg-muted px-1 py-0.5 rounded text-xs">{{
                  s.cronExpression
                }}</code>
                <span v-else class="text-xs font-medium text-orange-500">Run at: {{ formatDate(s.runAt!) }}</span>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex flex-col gap-1">
                <div v-for="r in s.recipients" :key="r" class="text-xs flex items-center gap-1">
                  <Mail class="h-3 w-3 text-muted-foreground" /> {{ r }}
                </div>
                <div v-if="s.webhookUrl" class="text-xs flex items-center gap-1 text-blue-500 truncate max-w-[150px]"
                  :title="s.webhookUrl">
                  <Globe class="h-3 w-3" /> Webhook
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Switch :model-value="s.isActive" @update:model-value="() => toggleActive(s)" />
            </TableCell>
            <TableCell class="text-xs text-muted-foreground">
              {{ s.creator?.fullName || 'System' }}
              <div>{{ new Date(s.createdAt).toLocaleDateString() }}</div>
            </TableCell>
            <TableCell class="text-right space-x-2">
              <Button type="button" variant="ghost" size="icon" @click="openEditDialog(s)">
                <Edit class="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" class="text-destructive" @click="deleteSchedule(s.id)">
                <Trash2 class="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="isDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editingId ? 'Edit Schedule' : 'New Schedule' }}</DialogTitle>
          <DialogDescription> Configure the execution frequency and recipients. </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <Tabs v-model="form.executionType" class="w-full">
            <TabsList class="grid w-full grid-cols-2">
              <TabsTrigger value="recurring">Recurring</TabsTrigger>
              <TabsTrigger value="one-off">One-off</TabsTrigger>
            </TabsList>

            <TabsContent value="recurring" class="space-y-4 pt-4">
              <div class="space-y-2">
                <div class="flex justify-between">
                  <Label>Cron Expression</Label>
                  <a href="https://crontab.guru/" target="_blank"
                    class="text-xs text-blue-500 hover:underline">Help?</a>
                </div>
                <Input v-model="form.cronExpression" placeholder="0 9 * * *" />
                <p class="text-xs text-muted-foreground">Format: Minute Hour Day Month DayOfWeek</p>
                <div v-if="nextExecutions.length > 0" class="mt-2 text-xs bg-muted p-2 rounded text-muted-foreground">
                  <p class="font-semibold mb-1">Next executions:</p>
                  <ul class="list-disc pl-4 space-y-0.5">
                    <li v-for="d in nextExecutions" :key="d">{{ d }}</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="one-off" class="space-y-4 pt-4">
              <div class="space-y-2">
                <Label>Execution Time</Label>
                <DateTimePicker v-model="form.runAt" :timezone="systemTimezone" />
                <div class="flex flex-wrap gap-2 mt-3">
                  <Button type="button" variant="outline" size="sm" class="h-6 px-2 text-xs" @click="
                    form.runAt = (DateTime.now()
                      .setZone(systemTimezone)
                      .plus({ minutes: 10 })
                      .toUTC()
                      .toISO() || '') as string
                    ">
                    +10 Min
                  </Button>
                  <Button type="button" variant="outline" size="sm" class="h-6 px-2 text-xs" @click="
                    form.runAt = (DateTime.now()
                      .setZone(systemTimezone)
                      .plus({ hours: 1 })
                      .toUTC()
                      .toISO() || '') as string
                    ">
                    +1 Hour
                  </Button>
                  <Button type="button" variant="outline" size="sm" class="h-6 px-2 text-xs" @click="
                    form.runAt = (DateTime.now()
                      .setZone(systemTimezone)
                      .plus({ days: 1 })
                      .toUTC()
                      .toISO() || '') as string
                    ">
                    Tomorrow
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div class="space-y-2">
            <Label>Recipients (comma separated)</Label>
            <Input v-model="form.recipients" placeholder="user@example.com, manager@example.com" />
            <p class="text-[10px] text-muted-foreground italic">Required if Webhook URL is empty.</p>
          </div>
          <div class="space-y-2">
            <Label>Webhook URL (Optional)</Label>
            <Input v-model="form.webhookUrl" placeholder="https://api.example.com/webhook" />
            <p class="text-[10px] text-muted-foreground italic">Required if Recipients is empty. If filled, email will
              NOT be sent.</p>
          </div>
          <div class="flex flex-row items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <Label class="text-base">Active</Label>
              <p class="text-sm text-muted-foreground">
                Enable or disable this schedule without deleting it.
              </p>
            </div>
            <Switch id="active" :model-value="form.isActive" @update:model-value="(v) => (form.isActive = v)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="isDialogOpen = false">Cancel</Button>
          <Button @click="saveSchedule" :disabled="isSubmitting">
            {{ isSubmitting ? 'Saving...' : 'Save' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
