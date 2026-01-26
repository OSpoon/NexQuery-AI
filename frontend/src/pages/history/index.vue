<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import {
  ArrowUpDown,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCode,
  User as UserIcon,
  XCircle,
} from 'lucide-vue-next'
import { h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { toast } from 'vue-sonner'
import DataTable from '@/components/common/DataTable.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import api, { cryptoService } from '@/lib/api'

interface QueryLog {
  id: number
  userId: number | null
  taskId: number | null
  executedSql: string
  parameters: any
  results: any
  executionTimeMs: number | null
  status: string
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  ipAddress?: string
  userAgent?: string
  deviceInfo?: any
  isInternalIp?: boolean
  user?: {
    fullName: string
    email: string
  }
  task?: {
    id: number
    name: string
  }
}

const { t } = useI18n()
const logs = ref<QueryLog[]>([])
const loading = ref(true)
const isDialogOpen = ref(false)
const selectedLog = ref<QueryLog | null>(null)

function openLogDetails(log: QueryLog) {
  // Auto-decryption for API tasks if they appear encrypted
  const processedLog = { ...log }

  // We check if it's an API task and if the results look like an encrypted object
  // Note: QueryLog doesn't directly have the task type, but we can detect it from the results structure
  // Or if it's a curl command in executedSql, it's likely API.
  const isPossiblyApi = processedLog.executedSql?.trim().startsWith('curl')

  if (isPossiblyApi && processedLog.results) {
    const results = processedLog.results
    if (
      results
      && typeof results === 'object'
      && results.data
      && typeof results.data === 'string'
      && cryptoService
    ) {
      try {
        const decrypted = cryptoService.decrypt(results.data)
        if (decrypted) {
          processedLog.results = decrypted
        }
      }
      catch (e) {
        console.error('Web: Auto-decryption failed', e)
      }
    }
  }

  selectedLog.value = processedLog
  isDialogOpen.value = true
}

async function fetchLogs() {
  loading.value = true
  try {
    const response = await api.get('/query-logs')
    logs.value = response.data.data
  }
  catch {
    toast.error('Failed to fetch logs')
  }
  finally {
    loading.value = false
  }
}

function formatDuration(ms: number | null) {
  if (ms === null)
    return '-'
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

const columns: ColumnDef<QueryLog>[] = [
  {
    accessorKey: 'createdAt',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => [t('history.time'), h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })],
      )
    },
    cell: ({ row }) => {
      return h('span', { class: 'text-sm' }, new Date(row.getValue('createdAt')).toLocaleString())
    },
  },
  {
    accessorKey: 'user',
    header: () => t('history.user'),
    cell: ({ row }) => {
      const user = row.original.user
      return h('div', { class: 'flex items-center' }, [
        h(UserIcon, { class: 'mr-2 h-4 w-4 text-muted-foreground' }),
        user?.fullName || 'Anonymous',
      ])
    },
  },
  {
    accessorKey: 'task',
    header: () => t('history.task'),
    cell: ({ row }) => {
      const task = row.original.task
      return h('div', { class: 'flex items-center' }, [
        h(FileCode, { class: 'mr-2 h-4 w-4 text-primary' }),
        task?.name || 'Deleted Task',
      ])
    },
  },
  {
    accessorKey: 'status',
    header: () => t('history.status'),
    cell: ({ row }) => {
      const status = row.getValue('status')
      const errorMessage = row.original.errorMessage

      if (status === 'success') {
        return h('div', { class: 'flex items-center text-green-600' }, [
          h(CheckCircle2, { class: 'mr-1 h-4 w-4' }),
          t('history.success'),
        ])
      }
      else {
        return h(
          'div',
          {
            class: 'flex items-center text-red-600',
            title: errorMessage || undefined,
          },
          [h(XCircle, { class: 'mr-1 h-4 w-4' }), t('history.failed')],
        )
      }
    },
  },
  {
    accessorKey: 'executionTimeMs',
    header: () => t('history.duration'),
    cell: ({ row }) => formatDuration(row.getValue('executionTimeMs')),
  },
  {
    accessorKey: 'ipAddress',
    header: () => t('history.source'),
    cell: ({ row }) => {
      const ip = row.original.ipAddress || '-'
      const isInternal = row.original.isInternalIp

      return h('div', { class: 'flex flex-col text-xs' }, [
        h('span', { class: 'font-mono' }, ip),
        isInternal !== undefined
          ? h(
              Badge,
              {
                variant: isInternal ? 'secondary' : 'outline',
                class: 'text-[10px] w-fit px-1 h-4 mt-0.5',
              },
              () => (isInternal ? 'Int' : 'Ext'),
            )
          : null,
      ])
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const log = row.original
      const elements = [
        h(
          Button,
          {
            variant: 'ghost',
            size: 'sm',
            onClick: (e: Event) => {
              e.stopPropagation()
              openLogDetails(log)
            },
          },
          () => 'View',
        ),
      ]

      if (log.task) {
        elements.push(
          h(
            Button,
            {
              variant: 'ghost',
              size: 'sm',
              asChild: true,
              onClick: (e: Event) => e.stopPropagation(),
            },
            () =>
              h(RouterLink, { to: { name: 'query-run', params: { id: log.task!.id } } }, () =>
                h(ExternalLink, { class: 'h-4 w-4' })),
          ),
        )
      }

      return h('div', { class: 'flex justify-end gap-2 pr-6' }, elements)
    },
  },
]

onMounted(() => {
  fetchLogs()
})
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">
          {{ t('history.title') }}
        </h1>
        <p class="text-muted-foreground">
          {{ t('history.desc') }}
        </p>
      </div>
      <Button variant="outline" @click="fetchLogs">
        <Clock class="mr-2 h-4 w-4" /> {{ t('history.refresh') }}
      </Button>
    </div>

    <div class="border rounded-lg bg-card p-4">
      <DataTable
        :columns="columns"
        :data="logs"
        search-key="status"
        empty-message="No history found."
        @row-click="openLogDetails"
      />
    </div>

    <!-- Log Details Dialog -->
    <Dialog v-model:open="isDialogOpen">
      <DialogContent class="sm:max-w-[700px] max-h-[80vh] p-0 flex flex-col">
        <DialogHeader class="p-6 pb-2 shrink-0">
          <DialogTitle>{{ t('history.details_title') }}</DialogTitle>
          <DialogDescription> {{ t('history.log_id') }}: {{ selectedLog?.id }} </DialogDescription>
        </DialogHeader>

        <div v-if="selectedLog" class="flex-1 overflow-y-auto p-6 pt-0 space-y-4">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-muted-foreground">{{ t('history.executed_by') }}:</span>
              <p class="font-medium">
                {{ selectedLog.user?.fullName || 'Anonymous' }}
              </p>
            </div>
            <div>
              <span class="text-muted-foreground">{{ t('history.time') }}:</span>
              <p class="font-medium">
                {{ new Date(selectedLog.createdAt).toLocaleString() }}
              </p>
            </div>
            <div>
              <span class="text-muted-foreground">{{ t('history.status') }}:</span>
              <div class="flex items-center mt-1">
                <Badge :variant="selectedLog.status === 'success' ? 'default' : 'destructive'">
                  {{ selectedLog.status }}
                </Badge>
              </div>
            </div>
            <div>
              <span class="text-muted-foreground">{{ t('history.duration') }}:</span>
              <p class="font-medium">
                {{ formatDuration(selectedLog.executionTimeMs) }}
              </p>
            </div>

            <div v-if="selectedLog.ipAddress" class="col-span-2 border-t pt-2 mt-2">
              <span class="text-muted-foreground block mb-1">{{ t('history.source_info') }}:</span>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <span class="text-xs text-muted-foreground">{{ t('history.ip_address') }}:</span>
                  <p class="font-mono text-sm">
                    {{ selectedLog.ipAddress }}
                    <span v-if="selectedLog.isInternalIp" class="text-xs text-muted-foreground">(Internal)</span>
                  </p>
                </div>
                <div>
                  <span class="text-xs text-muted-foreground">{{ t('history.user_agent') }}:</span>
                  <p class="text-xs break-all" :title="selectedLog.userAgent || ''">
                    {{ selectedLog.userAgent || '-' }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="selectedLog.errorMessage"
            class="p-3 rounded-md bg-destructive/10 text-destructive text-sm"
          >
            <p class="font-semibold">
              {{ t('history.error') }}:
            </p>
            {{ selectedLog.errorMessage }}
          </div>

          <div>
            <h4 class="text-sm font-semibold mb-2">
              {{ t('history.parameters') }}
            </h4>
            <div
              v-if="selectedLog.parameters && Object.keys(selectedLog.parameters).length > 0"
              class="p-3 bg-muted rounded-md font-mono text-xs whitespace-pre-wrap break-all"
            >
              {{ JSON.stringify(selectedLog.parameters, null, 2) }}
            </div>
            <p v-else class="text-sm text-muted-foreground italic">
              {{ t('history.no_parameters') }}
            </p>
          </div>

          <div>
            <h4 class="text-sm font-semibold mb-2">
              {{ t('history.executed_sql') }}
            </h4>
            <div class="p-3 bg-muted rounded-md font-mono text-xs whitespace-pre-wrap break-all">
              {{ selectedLog.executedSql }}
            </div>
          </div>

          <div v-if="selectedLog.results">
            <h4 class="text-sm font-semibold mb-2">
              {{ t('history.results_snapshot') }}
            </h4>
            <div
              class="p-3 bg-muted rounded-md font-mono text-xs max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all"
            >
              {{ JSON.stringify(selectedLog.results, null, 2) }}
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('history.snapshot_note') }}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
