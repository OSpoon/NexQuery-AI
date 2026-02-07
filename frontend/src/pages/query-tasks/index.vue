<script setup lang="ts">
import type { QueryTask } from '@nexquery/shared'
import type { ColumnDef } from '@tanstack/vue-table'
import { ArrowUpDown, Edit, FileCode, Play, Plus, Settings, Trash2 } from 'lucide-vue-next'
import { defineAsyncComponent, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import DataTable from '@/components/common/DataTable.vue'
import { Button } from '@/components/ui/button'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import api from '@/lib/api'

const QueryTaskForm = defineAsyncComponent({
  loader: () => import('./components/QueryTaskForm.vue'),
  loadingComponent: {
    template: '<div class="p-8 text-center text-muted-foreground">Loading editor...</div>',
  },
})

const ScheduleManager = defineAsyncComponent({
  loader: () => import('./components/ScheduleManager.vue'),
  loadingComponent: {
    template: '<div class="p-8 text-center text-muted-foreground">Loading schedules...</div>',
  },
})

const router = useRouter()
const { t } = useI18n()
const tasks = ref<QueryTask[]>([])
const isDialogOpen = ref(false)
const editingTask = ref<QueryTask | null>(null)

const isSheetOpen = ref(false)
const schedulingTask = ref<QueryTask | null>(null)

async function fetchTasks() {
  try {
    const response = await api.get('/query-tasks')
    tasks.value = response.data
  }
  catch {
    toast.error('Failed to fetch tasks')
  }
}

function openCreateDialog() {
  editingTask.value = null
  isDialogOpen.value = true
}

function openEditDialog(task: any) {
  editingTask.value = task
  isDialogOpen.value = true
}

function openScheduleSheet(task: QueryTask) {
  schedulingTask.value = task
  isSheetOpen.value = true
}

async function deleteTask(id: number) {
  // eslint-disable-next-line no-alert
  if (!confirm(t('query_tasks.delete_confirm')))
    return
  try {
    await api.delete(`/query-tasks/${id}`)
    toast.success(t('query_tasks.delete_success'))
    fetchTasks()
  }
  catch {
    toast.error('Failed to delete task')
  }
}

const columns: ColumnDef<QueryTask>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => [t('query_tasks.task_name'), h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })],
      )
    },
    cell: ({ row }) => {
      const task = row.original
      return h('div', { class: 'flex items-center' }, [
        h(FileCode, { class: 'mr-2 h-4 w-4 text-primary' }),
        h('div', null, [
          h('div', { class: 'font-bold' }, task.name),
          h(
            'div',
            { class: 'text-xs text-muted-foreground truncate max-w-[300px]' },
            task.description,
          ),
        ]),
      ])
    },
  },
  {
    accessorKey: 'tags',
    header: () => t('query_tasks.tags'),
    cell: ({ row }) => {
      const tags = row.original.tags
      if (!tags || tags.length === 0)
        return '-'
      return h(
        'div',
        { class: 'flex flex-wrap gap-1' },
        tags.map((tag: string) =>
          h(
            'span',
            {
              class:
                'px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[10px]',
            },
            tag,
          ),
        ),
      )
    },
  },
  {
    accessorKey: 'dataSource',
    header: () => t('query_tasks.data_source'),
    cell: ({ row }) => {
      const ds = row.original.dataSource
      return ds ? `${ds.name} (${ds.type})` : '-'
    },
  },
  {
    accessorKey: 'creator',
    header: () => t('query_tasks.created_by'),
    cell: ({ row }) => {
      return row.original.creator?.fullName || 'System'
    },
  },
  {
    accessorKey: 'createdAt',
    header: () => t('query_tasks.created_at'),
    cell: ({ row }) => {
      return new Date(row.getValue('createdAt') as string).toLocaleDateString()
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const task = row.original
      return h('div', { class: 'text-center space-x-2 flex items-center justify-center' }, [
        h(
          Button,
          {
            variant: 'outline',
            size: 'sm',
            onClick: () => router.push({ name: 'query-run', params: { id: task.id } }),
          },
          () => [h(Play, { class: 'mr-1 h-3 w-3' }), t('query_tasks.run')],
        ),

        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            onClick: () => openEditDialog(task),
          },
          () => h(Edit, { class: 'h-4 w-4' }),
        ),

        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            title: t('query_tasks.schedules'),
            onClick: () => openScheduleSheet(task),
          },
          () => h(Settings, { class: 'h-4 w-4' }),
        ),

        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            class: 'text-destructive',
            onClick: () => deleteTask(task.id),
          },
          () => h(Trash2, { class: 'h-4 w-4' }),
        ),
      ])
    },
  },
]

onMounted(fetchTasks)
</script>

<template>
  <div class="h-full flex flex-col p-8 gap-4">
    <div class="flex justify-between items-center shrink-0">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">
          {{ t('query_tasks.title') }}
        </h1>
        <p class="text-muted-foreground">
          {{ t('query_tasks.desc') }}
        </p>
      </div>
      <Button @click="openCreateDialog">
        <Plus class="mr-2 h-4 w-4" /> {{ t('query_tasks.create_task') }}
      </Button>
    </div>

    <div class="border rounded-lg bg-card p-4">
      <DataTable
        :columns="columns"
        :data="tasks"
        search-key="name"
        storage-key="query-tasks-columns"
        empty-message="No query tasks found. Create one to get started."
      />
    </div>

    <Dialog v-model:open="isDialogOpen">
      <DialogContent class="sm:max-w-[800px] max-h-[90vh] p-0 flex flex-col">
        <DialogHeader class="p-6 pb-2 shrink-0">
          <DialogTitle>
            {{
              editingTask ? t('query_tasks.edit_task') : t('query_tasks.create_task')
            }}
          </DialogTitle>
          <DialogDescription>
            {{ t('query_tasks.desc') }}
          </DialogDescription>
        </DialogHeader>
        <QueryTaskForm
          v-if="isDialogOpen"
          :initial-values="editingTask"
          :is-editing="!!editingTask"
          class="flex-1 overflow-hidden"
          @success="
            () => {
              isDialogOpen = false
              fetchTasks()
            }
          "
          @cancel="isDialogOpen = false"
        />
      </DialogContent>
    </Dialog>

    <!-- Schedule Management Sheet -->
    <Sheet v-model:open="isSheetOpen">
      <SheetContent side="right" class="sm:max-w-[600px] p-0 flex flex-col">
        <SheetHeader class="p-6 pb-2 shrink-0">
          <SheetTitle class="flex items-center gap-2">
            <Settings class="h-5 w-5 text-primary" />
            {{ t('query_tasks.schedules') }}
          </SheetTitle>
          <SheetDescription>
            管理任务 "{{ schedulingTask?.name }}" 的自动化调度规则。
          </SheetDescription>
        </SheetHeader>
        <div class="flex-1 overflow-y-auto px-6 py-4">
          <ScheduleManager
            v-if="isSheetOpen && schedulingTask"
            :query-task-id="schedulingTask.id"
            :has-parameters="!!(schedulingTask.formSchema && (Array.isArray(schedulingTask.formSchema) ? schedulingTask.formSchema.length > 0 : Object.keys(schedulingTask.formSchema as any).length > 0))"
          />
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
