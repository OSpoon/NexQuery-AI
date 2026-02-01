<script setup lang="ts">
import type { Permission } from '@nexquery/shared'
import type { ColumnDef } from '@tanstack/vue-table'
import { Edit, Lock, Plus, Trash2 } from 'lucide-vue-next'
import { h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import DataTable from '@/components/common/DataTable.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import api from '@/lib/api'
import PermissionForm from './components/PermissionForm.vue'

const { t } = useI18n()
const permissions = ref<Permission[]>([])
const isDialogOpen = ref(false)
const editingPermission = ref<Permission | undefined>(undefined)

async function fetchPermissions() {
  try {
    const response = await api.get('/permissions')
    permissions.value = response.data
  }
  catch {
    toast.error('Failed to fetch permissions')
  }
}

function openCreateDialog() {
  editingPermission.value = undefined
  isDialogOpen.value = true
}

function openEditDialog(permission: any) {
  editingPermission.value = permission
  isDialogOpen.value = true
}

async function deletePermission(id: number) {
  // eslint-disable-next-line no-alert
  if (!confirm(t('permissions.delete_confirm')))
    return
  try {
    await api.delete(`/permissions/${id}`)
    toast.success(t('permissions.delete_success'))
    fetchPermissions()
  }
  catch {
    toast.error('Cannot delete permission')
  }
}

const columns: ColumnDef<Permission>[] = [
  {
    accessorKey: 'name',
    header: () => t('permissions.name'),
    cell: ({ row }) => {
      return h('div', { class: 'flex items-center font-medium' }, [
        h(Lock, { class: 'mr-2 h-4 w-4 text-primary' }),
        row.getValue('name') as string,
      ])
    },
  },
  {
    accessorKey: 'slug',
    header: () => t('permissions.slug'),
    cell: ({ row }) => h(Badge, { variant: 'secondary' }, () => row.getValue('slug') as string),
  },
  {
    accessorKey: 'description',
    header: () => t('permissions.description'),
    cell: ({ row }) => h('div', { class: 'text-sm text-muted-foreground max-w-[300px] truncate' }, row.getValue('description') as string || '-'),
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const permission = row.original
      return h('div', { class: 'text-center space-x-2' }, [
        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            onClick: () => openEditDialog(permission),
          },
          () => h(Edit, { class: 'h-4 w-4' }),
        ),

        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            class: 'text-destructive',
            onClick: () => deletePermission(permission.id),
          },
          () => h(Trash2, { class: 'h-4 w-4' }),
        ),
      ])
    },
  },
]

onMounted(fetchPermissions)
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">
          {{ t('permissions.title') }}
        </h1>
        <p class="text-muted-foreground">
          {{ t('permissions.desc') }}
        </p>
      </div>
      <Button @click="openCreateDialog">
        <Plus class="mr-2 h-4 w-4" /> {{ t('permissions.create') }}
      </Button>
    </div>

    <div class="border rounded-lg bg-card p-4">
      <DataTable :columns="columns" :data="permissions" search-key="name" />
    </div>

    <Dialog v-model:open="isDialogOpen">
      <DialogContent class="sm:max-w-[600px] max-h-[90vh] p-0 flex flex-col">
        <DialogHeader class="p-6 pb-2 shrink-0">
          <DialogTitle>
            {{
              editingPermission ? t('permissions.edit') : t('permissions.create')
            }}
          </DialogTitle>
          <DialogDescription>{{ t('permissions.config_desc') }}</DialogDescription>
        </DialogHeader>
        <PermissionForm
          v-if="isDialogOpen"
          :initial-values="editingPermission"
          :is-editing="!!editingPermission"
          class="flex-1 overflow-hidden"
          @success="
            () => {
              isDialogOpen = false
              fetchPermissions()
            }
          "
          @cancel="isDialogOpen = false"
        />
      </DialogContent>
    </Dialog>
  </div>
</template>
