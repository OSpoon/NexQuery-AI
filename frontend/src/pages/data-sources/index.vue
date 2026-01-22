<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import AdvancedConfigDialog from './components/AdvancedConfigDialog.vue'
import {
  Plus,
  Database,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  ArrowUpDown,
  Settings,
  RefreshCw,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useI18n } from 'vue-i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import api from '@/lib/api'
import DataSourceForm from './components/DataSourceForm.vue'
import { toast } from 'vue-sonner'
import DataTable from '@/components/common/DataTable.vue'
import type { ColumnDef } from '@tanstack/vue-table'

import type { DataSource } from '@nexquery/shared'

import { useDataSourceStore } from '@/stores/dataSource'

const { t } = useI18n()
const dataSourceStore = useDataSourceStore()

const isDialogOpen = ref(false)
const isAdvancedDialogOpen = ref(false)
const editingDataSource = ref<DataSource | null>(null)
const advancedConfigDataSource = ref<DataSource | null>(null)

const fetchDataSources = () => dataSourceStore.fetchDataSources()

const isRefreshing = ref(false)
const refreshStatuses = async () => {
  isRefreshing.value = true
  try {
    await api.post('/data-sources/refresh')
    await fetchDataSources()
    toast.success('Status refresh complete')
  } catch (error) {
    toast.error('Failed to refresh statuses')
  } finally {
    isRefreshing.value = false
  }
}

const openCreateDialog = () => {
  editingDataSource.value = null
  isDialogOpen.value = true
}

const openEditDialog = (ds: any) => {
  editingDataSource.value = ds
  isDialogOpen.value = true
}

const openAdvancedDialog = (ds: any) => {
  advancedConfigDataSource.value = ds
  isAdvancedDialogOpen.value = true
}

const deleteDataSource = async (id: number) => {
  if (!confirm('Are you sure you want to delete this data source?')) return

  try {
    await api.delete(`/data-sources/${id}`)
    toast.success('Deleted successfully')
    fetchDataSources()
  } catch (error) {
    toast.error('Failed to delete')
  }
}

const syncSchema = async (id: number) => {
  const promise = api.post(`/data-sources/${id}/sync-schema`)
  toast.promise(promise, {
    loading: 'Syncing schema to vector store...',
    success: 'Schema synced successfully',
    error: (err) => `Failed to sync: ${err.message || 'Unknown error'}`,
  })
}

const columns: ColumnDef<DataSource>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => [t('data_sources.name'), h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })],
      )
    },
    cell: ({ row }) => {
      return h('div', { class: 'flex items-center font-medium' }, [
        h(Database, { class: 'mr-2 h-4 w-4 text-muted-foreground' }),
        row.getValue('name') as string,
      ])
    },
  },
  {
    accessorKey: 'type',
    header: () => t('data_sources.type'),
    cell: ({ row }) => {
      return h(
        Badge,
        { variant: 'outline', class: 'uppercase' },
        () => row.getValue('type') as string,
      )
    },
  },
  {
    accessorKey: 'host',
    header: () => t('data_sources.host'),
    cell: ({ row }) => {
      const ds = row.original
      return ds.type === 'api' ? ds.host : `${ds.host}:${ds.port}`
    },
  },
  {
    accessorKey: 'database',
    header: () => t('data_sources.database'),
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => {
      const isActive = row.getValue('isActive')
      return isActive
        ? h('div', { class: 'flex items-center text-green-600' }, [
            h(CheckCircle2, { class: 'mr-1 h-4 w-4' }),
            'Active',
          ])
        : h('div', { class: 'flex items-center text-red-600' }, [
            h(XCircle, { class: 'mr-1 h-4 w-4' }),
            'Inactive',
          ])
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const ds = row.original
      const isSql = ds.type === 'mysql' || ds.type === 'postgresql'

      return h('div', { class: 'text-center space-x-2' }, [
        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            onClick: () => openEditDialog(ds),
          },
          () => h(Edit, { class: 'h-4 w-4' }),
        ),
        isSql
          ? h(
              Button,
              {
                variant: 'ghost',
                size: 'icon',
                title: 'Sync Schema (Text-to-SQL)',
                onClick: () => syncSchema(ds.id),
              },
              () => h(RefreshCw, { class: 'h-4 w-4 text-blue-500' }),
            )
          : null,
        isSql
          ? h(
              Button,
              {
                variant: 'ghost',
                size: 'icon',
                title: 'Advanced Configuration',
                onClick: () => openAdvancedDialog(ds),
              },
              () => h(Settings, { class: 'h-4 w-4' }),
            )
          : null,
        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            class: 'text-destructive',
            onClick: () => deleteDataSource(ds.id),
          },
          () => h(Trash2, { class: 'h-4 w-4' }),
        ),
      ])
    },
  },
]

onMounted(fetchDataSources)
</script>

<template>
  <div class="h-full flex flex-col p-4 gap-4 relative">
    <div class="flex justify-between items-center shrink-0">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">{{ t('data_sources.title') }}</h1>
        <p class="text-muted-foreground">{{ t('data_sources.desc') }}</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="refreshStatuses" :disabled="isRefreshing">
          <RefreshCcw class="mr-2 h-4 w-4" :class="{ 'animate-spin': isRefreshing }" />
          Refresh Status
        </Button>
        <Button @click="openCreateDialog">
          <Plus class="mr-2 h-4 w-4" /> {{ t('data_sources.add_new') }}
        </Button>
      </div>
    </div>

    <div class="border rounded-lg bg-card p-4">
      <DataTable
        :columns="columns"
        :data="dataSourceStore.dataSources"
        search-key="name"
        empty-message="No data sources found. Click 'Add Data Source' to create one."
      />
    </div>

    <Dialog v-model:open="isDialogOpen">
      <DialogContent class="sm:max-w-[600px] max-h-[90vh] p-0 flex flex-col">
        <DialogHeader class="p-6 pb-2 shrink-0">
          <DialogTitle>{{
            editingDataSource ? t('data_sources.edit_title') : t('data_sources.add_title')
          }}</DialogTitle>
          <DialogDescription> Configure your database connection details below. </DialogDescription>
        </DialogHeader>
        <DataSourceForm
          v-if="isDialogOpen"
          :initial-values="editingDataSource"
          :is-editing="!!editingDataSource"
          class="flex-1 overflow-hidden"
          @success="
            () => {
              isDialogOpen = false
              fetchDataSources()
            }
          "
          @cancel="isDialogOpen = false"
        />
      </DialogContent>
    </Dialog>

    <AdvancedConfigDialog
      v-model:open="isAdvancedDialogOpen"
      :data-source="advancedConfigDataSource"
      @success="fetchDataSources"
    />
  </div>
</template>
