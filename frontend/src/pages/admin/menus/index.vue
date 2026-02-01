<script setup lang="ts">
import type { Menu } from '@nexquery/shared'
import type { ColumnDef } from '@tanstack/vue-table'
import {
  ChevronDown,
  ChevronRight,
  Edit,
  Menu as MenuIcon,
  Plus,
  Trash2,
} from 'lucide-vue-next'
import { computed, h, onMounted, ref } from 'vue'
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
import MenuForm from './components/MenuForm.vue'

const { t } = useI18n()
const menus = ref<Menu[]>([])
const isDialogOpen = ref(false)
const editingMenu = ref(null)

async function fetchMenus() {
  try {
    const response = await api.get('/menus')
    menus.value = response.data
  }
  catch {
    toast.error('Failed to fetch menus')
  }
}

// Flatten tree for table display with depth
// Nested tree for table display (DataTable will handle flattening via getExpandedRowModel)
const treeMenus = computed(() => {
  const buildTree = (parentId: number | null): any[] => {
    return menus.value
      .filter(m => m.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(m => ({
        ...m,
        children: buildTree(m.id),
      }))
  }
  return buildTree(null)
})

function openCreateDialog() {
  editingMenu.value = null
  isDialogOpen.value = true
}

function openEditDialog(menu: any) {
  // Extract simple object if it's a proxy
  editingMenu.value = menu
  isDialogOpen.value = true
}

async function deleteMenu(id: number) {
  // eslint-disable-next-line no-alert
  if (!confirm(`${t('menus.delete_confirm')}\n\n${t('menus.desc')}`)) {
    return
  }
  try {
    await api.delete(`/menus/${id}`)
    toast.success(t('menus.delete_success'))
    fetchMenus()
  }
  catch {
    toast.error('Cannot delete menu')
  }
}

const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'sortOrder',
    header: () => t('menus.sort'),
    cell: ({ row }) => h('div', { class: 'w-[50px]' }, row.getValue('sortOrder') as string),
  },
  {
    accessorKey: 'title',
    header: () => t('menus.title_col'),
    cell: ({ row }) => {
      const menu = row.original
      return h(
        'div',
        {
          class: 'flex items-center font-medium',
          style: { paddingLeft: `${row.depth * 24}px` },
        },
        [
          row.getCanExpand()
            ? h(
                'button',
                {
                  onClick: row.getToggleExpandedHandler(),
                  style: { cursor: 'pointer' },
                  class:
                    'mr-1 rounded-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring',
                },
                h(row.getIsExpanded() ? ChevronDown : ChevronRight, {
                  class: 'h-4 w-4 text-muted-foreground',
                }),
              )
            : h('div', { class: 'w-5 mr-1' }),
          h(MenuIcon, { class: 'mr-2 h-4 w-4 text-primary' }),
          menu.title,
        ],
      )
    },
  },
  {
    accessorKey: 'path',
    header: () => t('menus.path'),
    cell: ({ row }) => h('div', { class: 'font-mono text-xs' }, row.getValue('path') as string),
  },
  {
    accessorKey: 'icon',
    header: () => t('menus.icon'),
    cell: ({ row }) => {
      const icon = row.getValue('icon')
      return icon || '-'
    },
  },
  {
    accessorKey: 'permission',
    header: () => t('menus.permission'),
    cell: ({ row }) => {
      const permission = row.getValue('permission') as string
      return permission
        ? h(Badge, { variant: 'secondary' }, () => permission)
        : h('span', { class: 'text-muted-foreground text-xs' }, '-')
    },
  },
  {
    accessorKey: 'component',
    header: () => 'Component',
    cell: ({ row }) => h('div', { class: 'font-mono text-[10px] text-muted-foreground' }, row.getValue('component') as string || '-'),
  },
  {
    accessorKey: 'parent',
    header: () => t('menus.parent'),
    cell: ({ row }) => {
      const parent = row.original.parent
      return h('span', { class: 'text-xs' }, parent?.title || '-')
    },
  },
  {
    accessorKey: 'isActive',
    header: () => t('menus.status'),
    cell: ({ row }) => {
      const isActive = row.getValue('isActive')
      return h(Badge, { variant: isActive ? 'default' : 'secondary' }, () =>
        isActive ? t('menus.active') : t('menus.hidden'))
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const menu = row.original
      return h('div', { class: 'text-center space-x-2' }, [
        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            onClick: () => openEditDialog(menu),
          },
          () => h(Edit, { class: 'h-4 w-4' }),
        ),

        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            class: 'text-destructive',
            onClick: () => deleteMenu(menu.id),
          },
          () => h(Trash2, { class: 'h-4 w-4' }),
        ),
      ])
    },
  },
]

onMounted(fetchMenus)
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">
          {{ t('menus.title') }}
        </h1>
        <p class="text-muted-foreground">
          {{ t('menus.desc') }}
        </p>
      </div>
      <Button @click="openCreateDialog">
        <Plus class="mr-2 h-4 w-4" /> {{ t('menus.create_menu') }}
      </Button>
    </div>

    <div class="border rounded-lg bg-card p-4">
      <DataTable :columns="columns" :data="treeMenus" search-key="title" />
    </div>

    <Dialog v-model:open="isDialogOpen">
      <DialogContent class="sm:max-w-[600px] max-h-[90vh] p-0 flex flex-col">
        <DialogHeader class="p-6 pb-2 shrink-0">
          <DialogTitle>
            {{
              editingMenu ? t('menus.edit_menu') : t('menus.create_item')
            }}
          </DialogTitle>
          <DialogDescription>{{ t('menus.details') }}</DialogDescription>
        </DialogHeader>
        <MenuForm
          v-if="isDialogOpen"
          :initial-values="editingMenu"
          :is-editing="!!editingMenu"
          :all-menus="menus"
          class="flex-1 overflow-hidden"
          @success="
            () => {
              isDialogOpen = false
              fetchMenus()
            }
          "
          @cancel="isDialogOpen = false"
        />
      </DialogContent>
    </Dialog>
  </div>
</template>
