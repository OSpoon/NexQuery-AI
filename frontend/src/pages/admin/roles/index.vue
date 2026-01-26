<script setup lang="ts">
import type { Role } from '@nexquery/shared'
import type { ColumnDef } from '@tanstack/vue-table'
import { Edit, Plus, Shield, Trash2 } from 'lucide-vue-next'
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

import RoleForm from './components/RoleForm.vue'

const { t } = useI18n()
const roles = ref<Role[]>([])
const isDialogOpen = ref(false)
const editingRole = ref<Role | undefined>(undefined)

async function fetchRoles() {
  try {
    const response = await api.get('/roles')
    roles.value = response.data
  }
  catch {
    toast.error('Failed to fetch roles')
  }
}

function openCreateDialog() {
  editingRole.value = undefined
  isDialogOpen.value = true
}

function openEditDialog(role: any) {
  editingRole.value = role
  isDialogOpen.value = true
}

async function deleteRole(id: number) {
  // eslint-disable-next-line no-alert
  if (!confirm(t('roles.delete_confirm')))
    return
  try {
    await api.delete(`/roles/${id}`)
    toast.success(t('roles.delete_success'))
    fetchRoles()
  }
  catch {
    toast.error('Cannot delete role')
  }
}

const columns: ColumnDef<Role>[] = [
  {
    accessorKey: 'name',
    header: () => t('roles.role_name'),
    cell: ({ row }) => {
      return h('div', { class: 'flex items-center' }, [
        h(Shield, { class: 'mr-2 h-4 w-4 text-primary' }),
        row.getValue('name') as string,
      ])
    },
  },
  {
    accessorKey: 'slug',
    header: () => t('roles.slug'),
  },
  {
    accessorKey: 'permissions',
    header: () => t('roles.permissions'),
    cell: ({ row }) => {
      const permissions = row.original.permissions || []
      return h(
        'div',
        { class: 'flex flex-wrap gap-1' },
        permissions.map((p: any) =>
          h(Badge, { variant: 'secondary', class: 'text-[10px]', key: p.id }, () => p.name),
        ),
      )
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const role = row.original
      return h('div', { class: 'text-center space-x-2' }, [
        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            onClick: () => openEditDialog(role),
          },
          () => h(Edit, { class: 'h-4 w-4' }),
        ),

        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            class: 'text-destructive',
            onClick: () => deleteRole(role.id),
          },
          () => h(Trash2, { class: 'h-4 w-4' }),
        ),
      ])
    },
  },
]

onMounted(fetchRoles)
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">
          {{ t('roles.title') }}
        </h1>
        <p class="text-muted-foreground">
          {{ t('roles.desc') }}
        </p>
      </div>
      <Button @click="openCreateDialog">
        <Plus class="mr-2 h-4 w-4" /> {{ t('roles.create_role') }}
      </Button>
    </div>

    <div class="border rounded-lg bg-card p-4">
      <DataTable :columns="columns" :data="roles" search-key="name" />
    </div>

    <Dialog v-model:open="isDialogOpen">
      <DialogContent class="sm:max-w-[600px] max-h-[90vh] p-0 flex flex-col">
        <DialogHeader class="p-6 pb-2 shrink-0">
          <DialogTitle>
            {{
              editingRole ? t('roles.edit_role') : t('roles.create_role')
            }}
          </DialogTitle>
          <DialogDescription>{{ t('roles.config_desc') }}</DialogDescription>
        </DialogHeader>
        <RoleForm
          v-if="isDialogOpen"
          :initial-values="editingRole"
          :is-editing="!!editingRole"
          class="flex-1 overflow-hidden"
          @success="
            () => {
              isDialogOpen = false
              fetchRoles()
            }
          "
          @cancel="isDialogOpen = false"
        />
      </DialogContent>
    </Dialog>
  </div>
</template>
