<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { useDark } from '@vueuse/core'
import { Eye, GraduationCap, MessageSquare, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-vue-next'
import { MarkdownRender } from 'markstream-vue'
import { h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import AgentSteps from '@/components/AgentSteps.vue'
import DataTable from '@/components/common/DataTable.vue'
import SqlEditor from '@/components/shared/SqlEditor.vue'
import Badge from '@/components/ui/badge/Badge.vue'
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
import api from '@/lib/api'

const { t } = useI18n()
const isDark = useDark()

interface FeedbackItem {
  id: number
  conversationId: number | null
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

const isDetailOpen = ref(false)
const selectedItem = ref<FeedbackItem | null>(null)
const contextMessages = ref<any[]>([])
const loadingContext = ref(false)

async function fetchContext(conversationId: number) {
  loadingContext.value = true
  contextMessages.value = []
  try {
    const res = await api.get(`/ai/conversations/${conversationId}`)
    contextMessages.value = res.data.messages || []
  }
  catch {
    console.warn('Failed to fetch conversation context (it might be deleted)')
  }
  finally {
    loadingContext.value = false
  }
}

async function openDetail(item: FeedbackItem) {
  selectedItem.value = item
  isDetailOpen.value = true
  if (item.conversationId) {
    await fetchContext(item.conversationId)
  }
  else {
    contextMessages.value = []
  }
}

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
      return h('div', { class: 'flex justify-end gap-2 pr-6' }, [
        h(
          Button,
          {
            variant: 'outline',
            size: 'sm',
            class: 'h-8 gap-1',
            onClick: () => openDetail(item),
          },
          () => [h(Eye, { class: 'h-3.5 w-3.5' }), 'View'],
        ),
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

async function fetchFeedbacks() {
  loading.value = true
  try {
    const res = await api.get('/ai/feedback')
    items.value = res.data.data // Pagination object
  }
  catch {
    toast.error(t('common.error'))
  }
  finally {
    loading.value = false
  }
}

function promoteToKnowledge(item: FeedbackItem) {
  promoteForm.value = {
    keyword: item.question.length > 50 ? `${item.question.substring(0, 47)}...` : item.question,
    description: `Improved logic for: ${item.question}`,
    exampleSql: item.userCorrection || item.generatedSql,
    sourceId: item.id,
  }
  isPromoteOpen.value = true
}

async function confirmPromotion() {
  try {
    await api.post('/knowledge-base', {
      keyword: promoteForm.value.keyword,
      description: promoteForm.value.description,
      exampleSql: promoteForm.value.exampleSql,
      status: 'pending',
    })
    toast.success('Successfully promoted to Knowledge Base')
    isPromoteOpen.value = false
    // Optionally delete feedback after promotion
    await deleteFeedback(promoteForm.value.sourceId!, true)
  }
  catch {
    toast.error('Failed to promote feedback')
  }
}

async function deleteFeedback(id: number, silent = false) {
  // eslint-disable-next-line no-alert
  if (!silent && !confirm(t('common.confirm_delete')))
    return
  try {
    await api.delete(`/ai/feedback/${id}`)
    toast.success(t('common.success'))
    fetchFeedbacks()
  }
  catch {
    toast.error(t('common.error'))
  }
}

onMounted(fetchFeedbacks)
</script>

<template>
  <div class="h-full flex-1 flex-col space-y-8 p-8 flex text-foreground">
    <div class="flex items-center justify-between space-y-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare class="h-6 w-6 text-primary" />
          AI Feedback Management
        </h2>
        <p class="text-muted-foreground text-sm">
          Review user ratings and corrections to improve AI accuracy.
        </p>
      </div>
    </div>

    <div class="flex-1 space-y-4">
      <DataTable :columns="columns" :data="items" :loading="loading" />
    </div>

    <!-- Promote Dialog -->
    <Dialog v-model:open="isPromoteOpen">
      <DialogContent class="sm:max-w-[800px]">
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
            <SqlEditor v-model="promoteForm.exampleSql" class="h-64" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isPromoteOpen = false">
            {{ t('common.cancel') }}
          </Button>
          <Button @click="confirmPromotion">
            {{ t('common.confirm') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Detail Dialog -->
    <Dialog v-model:open="isDetailOpen">
      <DialogContent class="sm:max-w-[1000px] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader class="p-6 pb-2">
          <DialogTitle class="flex items-center gap-2">
            Feedback Details
            <Badge :variant="selectedItem?.isHelpful ? 'default' : 'destructive'" class="ml-2">
              <ThumbsUp v-if="selectedItem?.isHelpful" class="h-3 w-3 mr-1" />
              <ThumbsDown v-else class="h-3 w-3 mr-1" />
              {{ selectedItem?.isHelpful ? 'Helpful' : 'Needs Improvement' }}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Full record of the AI interaction and user feedback.
          </DialogDescription>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto px-6 py-4">
          <div class="space-y-6">
            <!-- Question -->
            <div class="space-y-2">
              <Label class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Original Question</Label>
              <div class="p-3 bg-muted/50 rounded-lg text-sm border">
                {{
                  selectedItem?.question === 'Unknown'
                    ? 'N/A (General Greeting)'
                    : selectedItem?.question
                }}
              </div>
            </div>

            <!-- Unified Interaction Flow -->
            <div class="space-y-3">
              <Label class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Interaction & AI Reasoning</Label>

              <div v-if="loadingContext" class="flex items-center justify-center py-12">
                <span class="text-sm text-muted-foreground italic animate-pulse">Retrieving conversation flow...</span>
              </div>

              <template v-else-if="contextMessages.length > 0">
                <div
                  class="space-y-4 p-4 bg-muted/30 border rounded-xl overflow-hidden shadow-inner"
                >
                  <div v-for="(msg, idx) in contextMessages" :key="idx" class="flex flex-col gap-2">
                    <div
                      class="flex flex-col gap-1 max-w-[92%]"
                      :class="[msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start']"
                    >
                      <span
                        class="text-[10px] text-muted-foreground font-semibold px-2 uppercase"
                      >{{ msg.role }}</span>

                      <!-- Thinking/Tool steps -->
                      <div
                        v-if="
                          msg.role === 'assistant' && msg.agentSteps && msg.agentSteps.length > 0
                        "
                        class="w-full mb-1"
                      >
                        <AgentSteps :steps="msg.agentSteps" />
                      </div>

                      <!-- Message Content -->
                      <div
                        class="text-xs p-3 rounded-2xl shadow-sm w-full"
                        :class="[
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background border',
                        ]"
                      >
                        <template v-if="msg.role === 'user'">
                          {{ msg.content }}
                        </template>
                        <MarkdownRender v-else :content="msg.content" :is-dark="isDark" />
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Fallback: Show only the stored SQL if context is unavailable -->
              <div v-else class="space-y-4">
                <div
                  v-if="selectedItem?.conversationId"
                  class="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-600 dark:text-amber-400 text-center italic"
                >
                  Original chat history was deleted. Showing captured response only.
                </div>
                <div
                  v-else
                  class="px-4 py-2 bg-muted/50 border rounded text-[11px] text-muted-foreground text-center italic"
                >
                  Captured Response (Historical Record)
                </div>

                <div class="flex flex-col gap-1 mr-auto items-start max-w-[92%]">
                  <span class="text-[10px] text-muted-foreground font-semibold px-2 uppercase">assistant</span>
                  <div class="text-xs p-4 rounded-2xl bg-background border shadow-sm w-full">
                    <MarkdownRender
                      v-if="selectedItem?.generatedSql"
                      :content="selectedItem.generatedSql"
                      :is-dark="isDark"
                    />
                    <span v-else class="text-muted-foreground italic">No captured response.</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- User Correction -->
            <div v-if="selectedItem?.userCorrection" class="space-y-2 pt-2 border-t">
              <Label class="text-sm font-semibold text-primary uppercase tracking-wider">User Expected Result</Label>
              <SqlEditor
                v-model="selectedItem.userCorrection"
                readonly
                hide-toolbar
                class="h-[200px]"
              />
            </div>
          </div>
        </div>

        <DialogFooter class="p-6 pt-4 border-t">
          <Button variant="outline" @click="isDetailOpen = false">
            {{ t('common.close') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
