<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { MessageSquare, Trash2, GraduationCap, ThumbsUp, ThumbsDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import DataTable from '@/components/common/DataTable.vue'
import type { ColumnDef } from '@tanstack/vue-table'
import api from '@/lib/api'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import { Badge } from '@/components/ui/badge'
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

const { t } = useI18n()

interface FeedbackItem {
  id: number
  question: string
  generatedSql: string
  isHelpful: boolean
  userCorrection: string | null
  createdAt: string
}

const items = ref<FeedbackItem[]>([])
const loading = ref(false)

const isPromoteOpen = ref(false)
const promoteForm = ref({
  keyword: '',
  description: '',
  exampleSql: '',
  sourceId: null as number | null,
})

const columns: ColumnDef<FeedbackItem>[] = [
  {
    accessorKey: 'isHelpful',
    header: 'Rating',
    cell: ({ row }) => {
      const isHelpful = row.getValue('isHelpful')
      return h('div', { class: 'flex justify-center' }, [
        isHelpful
          ? h(ThumbsUp, { class: 'h-4 w-4 text-primary fill-primary/20' })
          : h(ThumbsDown, { class: 'h-4 w-4 text-destructive fill-destructive/20' }),
      ])
    },
  },
  {
    accessorKey: 'question',
    header: 'Question',
    cell: ({ row }) => {
      const question = row.getValue('question') as string
      return h(
        'div',
        { class: 'max-w-[200px] truncate font-medium' },
        question === 'Unknown'
          ? h('span', { class: 'text-muted-foreground italic' }, 'N/A (Greeting)')
          : question,
      )
    },
  },
  {
    accessorKey: 'generatedSql',
    header: 'AI SQL',
    cell: ({ row }) =>
      h(
        'code',
        { class: 'bg-muted px-1 py-0.5 rounded text-xs block max-w-[250px] truncate' },
        row.getValue('generatedSql') || '-',
      ),
  },
  {
    accessorKey: 'userCorrection',
    header: 'User Correction',
    cell: ({ row }) => {
      const correction = row.getValue('userCorrection') as string
      return correction
        ? h(
            'code',
            {
              class:
                'bg-primary/10 text-primary px-1 py-0.5 rounded text-xs block max-w-[250px] truncate',
            },
            correction,
          )
        : h('span', { class: 'text-muted-foreground italic' }, 'None')
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Date',
    cell: ({ row }) => {
      const date = row.getValue('createdAt') as string
      return date ? new Date(date).toLocaleString() : '-'
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const item = row.original
      return h('div', { class: 'flex gap-2' }, [
        item.userCorrection
          ? h(
              Button,
              {
                variant: 'outline',
                size: 'sm',
                class: 'h-8 gap-1',
                onClick: () => promoteToKnowledge(item),
              },
              () => [h(GraduationCap, { class: 'h-3.5 w-3.5' }), 'Promote'],
            )
          : null,
        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            class: 'h-8 w-8 text-destructive',
            onClick: () => deleteFeedback(item.id),
          },
          () => h(Trash2, { class: 'h-4 w-4' }),
        ),
      ])
    },
  },
]

const fetchFeedbacks = async () => {
  loading.value = true
  try {
    const res = await api.get('/ai/feedback')
    items.value = res.data.data // Pagination object
  } catch (error) {
    toast.error(t('common.error'))
  } finally {
    loading.value = false
  }
}

const promoteToKnowledge = (item: FeedbackItem) => {
  promoteForm.value = {
    keyword: item.question.length > 50 ? item.question.substring(0, 47) + '...' : item.question,
    description: `Improved logic for: ${item.question}`,
    exampleSql: item.userCorrection || item.generatedSql,
    sourceId: item.id,
  }
  isPromoteOpen.value = true
}

const confirmPromotion = async () => {
  try {
    await api.post('/knowledge-base', {
      keyword: promoteForm.value.keyword,
      description: promoteForm.value.description,
      exampleSql: promoteForm.value.exampleSql,
    })
    toast.success('Successfully promoted to Knowledge Base')
    isPromoteOpen.value = false
    // Optionally delete feedback after promotion
    await deleteFeedback(promoteForm.value.sourceId!, true)
  } catch (error) {
    toast.error('Failed to promote feedback')
  }
}

const deleteFeedback = async (id: number, silent = false) => {
  if (!silent && !confirm(t('common.confirm_delete'))) return
  try {
    await api.delete(`/ai/feedback/${id}`)
    toast.success(t('common.success'))
    fetchFeedbacks()
  } catch (error) {
    toast.error(t('common.error'))
  }
}

onMounted(fetchFeedbacks)
</script>

<template>
  <div class="h-full flex-1 flex-col space-y-8 p-8 flex">
    <div class="flex items-center justify-between space-y-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare class="h-6 w-6 text-primary" />
          AI Feedback Management
        </h2>
        <p class="text-muted-foreground">
          Review user ratings and corrections to improve AI accuracy.
        </p>
      </div>
    </div>

    <div class="flex-1">
      <DataTable :columns="columns" :data="items" :loading="loading" />
    </div>

    <!-- Promote Dialog -->
    <Dialog v-model:open="isPromoteOpen">
      <DialogContent class="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Promote to Knowledge Base</DialogTitle>
          <DialogDescription>
            Refine the keyword and SQL before saving to the knowledge base.
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label>{{ t('common.keyword') }}</Label>
            <Input v-model="promoteForm.keyword" />
          </div>
          <div class="grid gap-2">
            <Label>{{ t('common.description') }}</Label>
            <Input v-model="promoteForm.description" />
          </div>
          <div class="grid gap-2">
            <Label>{{ t('common.sql_example') }}</Label>
            <Textarea v-model="promoteForm.exampleSql" class="font-mono text-xs h-32" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isPromoteOpen = false">{{ t('common.cancel') }}</Button>
          <Button @click="confirmPromotion">{{ t('common.confirm') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
