<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-vue-next'
import { computed, h, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import DataTable from '@/components/common/DataTable.vue'
import SqlEditor from '@/components/shared/SqlEditor.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import api from '@/lib/api'

const { t } = useI18n()

interface KnowledgeBaseItem {
  id: number
  keyword: string
  description: string
  exampleSql: string | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

const items = ref<KnowledgeBaseItem[]>([])
const loading = ref(false)
const dialogOpen = ref(false)
const isEditing = ref(false)
const currentTab = ref('pending') // default to pending for review workflow
const formData = ref({
  id: 0,
  keyword: '',
  description: '',
  exampleSql: '',
  status: 'approved',
})

const statusFilters = computed(() => [
  { label: t('knowledge_base.status_filter.pending'), value: 'pending' },
  { label: t('knowledge_base.status_filter.approved'), value: 'approved' },
  { label: t('knowledge_base.status_filter.rejected'), value: 'rejected' },
])

function openEditDialog(item: KnowledgeBaseItem) {
  isEditing.value = true
  formData.value = {
    id: item.id,
    keyword: item.keyword,
    description: item.description,
    exampleSql: item.exampleSql || '',
    status: item.status,
  }
  dialogOpen.value = true
}

async function deleteItem(id: number) {
  // eslint-disable-next-line no-alert
  if (!confirm(`${t('knowledge_base.confirm.title')}\n\n${t('knowledge_base.confirm.desc')}`)) {
    return
  }
  try {
    await api.delete(`/knowledge-base/${id}`)
    toast.success(t('knowledge_base.toast.delete_success'))
    fetchItems()
  }
  catch {
    toast.error(t('knowledge_base.toast.delete_failed'))
  }
}

async function updateStatus(item: KnowledgeBaseItem, status: 'approved' | 'rejected') {
  try {
    await api.put(`/knowledge-base/${item.id}`, {
      ...item,
      status,
    })
    toast.success(t('knowledge_base.toast.status_success', { status }))
    fetchItems()
  }
  catch {
    toast.error(t('knowledge_base.toast.status_failed'))
  }
}

const columns = computed<ColumnDef<KnowledgeBaseItem>[]>(() => [
  {
    accessorKey: 'keyword',
    header: t('knowledge_base.keyword'),
    cell: ({ row }) => h('div', { class: 'font-medium' }, row.getValue('keyword')),
  },
  {
    accessorKey: 'description',
    header: t('knowledge_base.description'),
    cell: ({ row }) => h('div', { class: 'max-w-[300px] truncate' }, row.getValue('description')),
  },
  {
    accessorKey: 'exampleSql',
    header: t('knowledge_base.example_sql'),
    cell: ({ row }) => {
      const sql = row.getValue('exampleSql') as string
      return sql
        ? h(
            'code',
            {
              class:
                'bg-muted px-2 py-1 rounded text-xs block whitespace-pre-wrap break-all max-w-[300px] line-clamp-2',
            },
            sql,
          )
        : '-'
    },
  },
  {
    accessorKey: 'status',
    header: t('knowledge_base.status'),
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      const variant
        = status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'
      return h(Badge, { variant }, () => status)
    },
  },
  {
    id: 'actions',
    header: t('knowledge_base.actions'),
    cell: ({ row }) => {
      const item = row.original
      const isPending = item.status === 'pending'

      const actions = []

      if (isPending) {
        // Allow Edit for Pending items too (Edit -> Approve flow)
        actions.push(
          h(
            Button,
            {
              variant: 'ghost',
              size: 'icon',
              class: 'h-8 w-8 mr-1',
              onClick: () => openEditDialog(item),
              title: 'Edit Content',
            },
            () => h(Pencil, { class: 'h-4 w-4' }),
          ),
        )

        actions.push(
          h(
            Button,
            {
              variant: 'outline',
              size: 'icon',
              class: 'h-8 w-8 text-green-600 border-green-200 hover:bg-green-50 mr-1',
              onClick: () => updateStatus(item, 'approved'),
              title: 'Approve',
            },
            () => h(Check, { class: 'h-4 w-4' }),
          ),
        )
        actions.push(
          h(
            Button,
            {
              variant: 'outline',
              size: 'icon',
              class: 'h-8 w-8 text-red-600 border-red-200 hover:bg-red-50 mr-2',
              onClick: () => updateStatus(item, 'rejected'),
              title: 'Reject',
            },
            () => h(X, { class: 'h-4 w-4' }),
          ),
        )
      }
      else {
        actions.push(
          h(
            Button,
            {
              variant: 'ghost',
              size: 'icon',
              class: 'h-8 w-8',
              onClick: () => openEditDialog(item),
            },
            () => h(Pencil, { class: 'h-4 w-4' }),
          ),
        )
      }

      actions.push(
        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            class: 'h-8 w-8 text-muted-foreground hover:text-destructive',
            onClick: () => deleteItem(item.id),
          },
          () => h(Trash2, { class: 'h-4 w-4' }),
        ),
      )

      return h('div', { class: 'flex items-center' }, actions)
    },
  },
])

async function fetchItems() {
  loading.value = true
  try {
    const res = await api.get('/knowledge-base', {
      params: { status: currentTab.value },
    })
    items.value = res.data
  }
  catch {
    toast.error(t('knowledge_base.toast.load_failed'))
  }
  finally {
    loading.value = false
  }
}

function openCreateDialog() {
  isEditing.value = false
  formData.value = {
    id: 0,
    keyword: '',
    description: '',
    exampleSql: '',
    status: 'approved',
  }
  dialogOpen.value = true
}

async function handleSubmit() {
  try {
    if (isEditing.value) {
      await api.put(`/knowledge-base/${formData.value.id}`, formData.value)
      toast.success(t('knowledge_base.toast.update_success'))
    }
    else {
      await api.post('/knowledge-base', formData.value)
      toast.success(t('knowledge_base.toast.create_success'))
    }
    dialogOpen.value = false
    fetchItems()
  }
  catch (error: any) {
    toast.error(error.response?.data?.message || t('knowledge_base.toast.op_failed'))
  }
}

watch(currentTab, () => {
  fetchItems()
})

onMounted(fetchItems)
</script>

<template>
  <div class="h-full flex-1 flex-col space-y-8 p-8 flex">
    <div class="flex items-center justify-between space-y-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          {{ t('knowledge_base.title') }}
        </h2>
        <p class="text-muted-foreground">
          {{ t('knowledge_base.desc') }}
        </p>
      </div>
      <div class="flex items-center space-x-2">
        <Button @click="openCreateDialog">
          <Plus class="mr-2 h-4 w-4" />
          {{ t('knowledge_base.add_term') }}
        </Button>
      </div>
    </div>

    <div class="flex-1 space-y-4">
      <Tabs v-model="currentTab" class="w-[400px]">
        <TabsList>
          <TabsTrigger v-for="tab in statusFilters" :key="tab.value" :value="tab.value">
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable :columns="columns" :data="items" :loading="loading" />
    </div>

    <Dialog :open="dialogOpen" @update:open="dialogOpen = $event">
      <DialogContent class="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? t('knowledge_base.dialog.edit_title') : t('knowledge_base.dialog.create_title') }}</DialogTitle>
          <DialogDescription>
            {{ t('knowledge_base.dialog.desc') }}
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label for="keyword"> {{ t('knowledge_base.keyword') }} </Label>
            <Input
              id="keyword"
              v-model="formData.keyword"
              :placeholder="t('knowledge_base.dialog.keyword_placeholder')"
            />
          </div>
          <div class="grid gap-2">
            <Label for="description"> {{ t('knowledge_base.description') }} </Label>
            <Textarea
              id="description"
              v-model="formData.description"
              :placeholder="t('knowledge_base.dialog.desc_placeholder')"
            />
          </div>
          <div class="grid gap-2">
            <Label for="exampleSql"> {{ t('knowledge_base.example_sql') }} </Label>
            <SqlEditor v-model="formData.exampleSql" class="h-64" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" @click="handleSubmit">
            {{ t('knowledge_base.dialog.save') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
