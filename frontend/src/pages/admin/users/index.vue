<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import type { User } from '@/stores/auth'
import { Users, Mail, ShieldCheck, ArrowUpDown, Edit, Trash2 } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import UserForm from './components/UserForm.vue'
import api from '@/lib/api'
import { toast } from 'vue-sonner'
import DataTable from '@/components/common/DataTable.vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const users = ref<User[]>([])
const isDialogOpen = ref(false)
const selectedUser = ref(null)

const fetchUsers = async () => {
  try {
    const response = await api.get('/users')
    users.value = response.data
  } catch (error) {
    toast.error('Failed to fetch users')
  }
}

const openEditDialog = (user: any) => {
  selectedUser.value = user
  isDialogOpen.value = true
}

const toggleUserStatus = async (user: any) => {
  const newStatus = !user.isActive
  try {
    await api.put(`/users/${user.id}`, {
      fullName: user.fullName,
      email: user.email,
      isActive: newStatus,
    })
    // Simple toast, could be improved with i18n specific logic if needed foundationally
    toast.success(`User updated`)
    fetchUsers()
  } catch (error) {
    toast.error(`Failed to update user`)
  }
}

const deleteUser = async (user: any) => {
  if (!confirm(t('users.delete_confirm', { name: user.fullName }))) return

  try {
    await api.delete(`/users/${user.id}`)
    toast.success(t('users.delete_success', { name: user.fullName }))
    fetchUsers()
  } catch (error: any) {
    const message = error.response?.data?.message || 'Failed to delete user'
    toast.error(message)
  }
}

const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'fullName',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => [t('users.user_col'), h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })],
      )
    },
    cell: ({ row }) => {
      return h('div', { class: 'flex items-center' }, [
        h(Users, { class: 'mr-2 h-4 w-4 text-muted-foreground' }),
        row.getValue('fullName') as string,
      ])
    },
  },
  {
    accessorKey: 'email',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => [t('users.email'), h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })],
      )
    },
    cell: ({ row }) => {
      return h('div', { class: 'flex items-center' }, [
        h(Mail, { class: 'mr-2 h-3 w-3 text-muted-foreground' }),
        row.getValue('email') as string,
      ])
    },
  },
  {
    accessorKey: 'roles',
    header: () => t('users.roles'),
    cell: ({ row }) => {
      const roles = row.original.roles || []
      return h(
        'div',
        { class: 'flex flex-wrap gap-1' },
        roles.map((role: any) =>
          h(Badge, { variant: 'outline', key: role.id }, () => [
            h(ShieldCheck, { class: 'mr-1 h-3 w-3' }),
            role.name,
          ]),
        ),
      )
    },
  },
  {
    accessorKey: 'isActive',
    header: () => t('users.status'),
    cell: ({ row }) => {
      const isActive = row.original.isActive
      const roles = row.original.roles || []

      if (!isActive) return h(Badge, { variant: 'destructive' }, () => t('users.disabled'))
      if (roles.length === 0) return h(Badge, { variant: 'secondary' }, () => t('users.pending'))
      return h(Badge, { variant: 'default' }, () => t('users.active'))
    },
  },
  {
    accessorKey: 'createdAt',
    header: () => t('users.joined_at'),
    cell: ({ row }) => {
      return new Date(row.getValue('createdAt') as string).toLocaleDateString()
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const user = row.original
      const isActive = user.isActive
      const hasRoles = user.roles && user.roles.length > 0

      return h('div', { class: 'text-center' }, [
        !isActive
          ? h(
              Button,
              {
                variant: 'outline',
                size: 'sm',
                class: 'mr-2 h-8 px-2',
                onClick: () => toggleUserStatus(user),
              },
              () => (!hasRoles ? t('users.approve') : t('users.enable')),
            )
          : null,

        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            onClick: () => openEditDialog(user),
          },
          () => h(Edit, { class: 'h-4 w-4' }),
        ),

        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            class: 'text-destructive hover:text-destructive',
            onClick: () => deleteUser(user),
          },
          () => h(Trash2, { class: 'h-4 w-4' }),
        ),
      ])
    },
  },
]

onMounted(fetchUsers)
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">{{ t('users.title') }}</h1>
        <p class="text-muted-foreground">{{ t('users.desc') }}</p>
      </div>
    </div>

    <div class="border rounded-lg bg-card p-4">
      <DataTable
        :columns="columns"
        :data="users"
        search-key="email"
        storage-key="admin-users-columns"
      />
    </div>

    <Dialog v-model:open="isDialogOpen">
      <DialogContent class="sm:max-w-[500px] max-h-[90vh] p-0 flex flex-col">
        <DialogHeader class="p-6 pb-2 shrink-0">
          <DialogTitle>{{ t('users.edit_user') }}</DialogTitle>
          <DialogDescription>{{ t('users.edit_desc') }}</DialogDescription>
        </DialogHeader>
        <UserForm
          v-if="isDialogOpen && selectedUser"
          :user="selectedUser"
          class="flex-1 overflow-hidden"
          @success="
            () => {
              isDialogOpen = false
              fetchUsers()
            }
          "
          @cancel="isDialogOpen = false"
        />
      </DialogContent>
    </Dialog>
  </div>
</template>
