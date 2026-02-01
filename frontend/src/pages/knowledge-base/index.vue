<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import DataTable from '@/components/common/DataTable.vue'
import SqlEditor from '@/components/shared/SqlEditor.vue'
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
const formData = ref({
  id: 0,
  keyword: '',
  description: '',
  exampleSql: '',
  status: 'approved',
})

function stripSqlMarkdown(content: string) {
  if (!content)
    return ''
  if (!content.includes('```') && !content.includes('###'))
    return content

  const sqlMatch = content.match(/```sql([\s\S]*?)```/)
  if (sqlMatch)
    return sqlMatch[1].trim()

  return content
    .replace(/###\s+(?:\S.*)?\n/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/```/g, '')
    .trim()
}

function openEditDialog(item: KnowledgeBaseItem) {
  isEditing.value = true
  formData.value = {
    id: item.id,
    keyword: item.keyword,
    description: item.description,
    exampleSql: stripSqlMarkdown(item.exampleSql || ''),
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
      const sql = stripSqlMarkdown(row.getValue('exampleSql') as string)
      return sql
        ? h(
            'div',
            {
              class:
                'bg-muted/50 p-2 rounded text-[10px] font-mono whitespace-pre-wrap break-all line-clamp-3 max-w-[300px] border border-border/50',
              title: sql,
            },
            sql,
          )
        : '-'
    },
  },
  {
    id: 'actions',
    header: t('knowledge_base.actions'),
    cell: ({ row }) => {
      const item = row.original

      return h('div', { class: 'flex items-center gap-2' }, [
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
      ])
    },
  },
])

async function fetchItems() {
  loading.value = true
  try {
    const res = await api.get('/knowledge-base')
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
