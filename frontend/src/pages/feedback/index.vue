<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { useDark } from '@vueuse/core'
import { Eye, GraduationCap, MessageSquare, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-vue-next'
import { MarkdownRender } from 'markstream-vue'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import AgentSteps from '@/components/AgentSteps.vue'
import DataTable from '@/components/common/DataTable.vue'
import MonacoEditor from '@/components/shared/MonacoEditor.vue'
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
  sourceType: string
  isHelpful: boolean
  userCorrection: string | null
  isAdopted: boolean
  createdAt: string
}

const items = ref<FeedbackItem[]>([])
const loading = ref(false)

const isPromoteOpen = ref(false)
const promoteForm = ref({
  keyword: '',
  description: '',
  exampleSql: '',
  sourceType: 'sql',
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

function stripSqlMarkdown(content: string) {
  if (!content)
    return ''
  // If it's already pure (no markdown markers), return it
  if (!content.includes('```') && !content.includes('###'))
    return content

  // Try to extract SQL or Lucene block
  const sqlMatch = content.match(/```(?:sql|lucene)?([\s\S]*?)```/)
  if (sqlMatch && sqlMatch[1])
    return sqlMatch[1].trim()

  // Fallback: Remove all markdown headers and bolding
  return content
    .replace(/###\s+(?:\S.*)?\n/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/```/g, '')
    .trim()
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

const columns = computed<ColumnDef<FeedbackItem>[]>(() => [
  {
    accessorKey: 'isHelpful',
    header: t('feedback.rating'),
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
    accessorKey: 'sourceType',
    header: t('common.source_type'),
    cell: ({ row }) => {
      const type = row.getValue('sourceType') as string
      return h(Badge, { variant: type === 'elasticsearch' ? 'secondary' : 'outline', class: 'capitalize' }, () => type === 'elasticsearch' ? 'Elasticsearch' : 'SQL')
    },
  },
  {
    accessorKey: 'question',
    header: t('feedback.question'),
    cell: ({ row }) => {
      const question = row.getValue('question') as string
      return h(
        'div',
        { class: 'max-w-[150px] truncate font-medium' },
        question === 'Unknown'
          ? h('span', { class: 'text-muted-foreground italic' }, t('feedback.na_greeting'))
          : question,
      )
    },
  },
  {
    accessorKey: 'generatedSql',
    header: t('feedback.ai_sql'),
    cell: ({ row }) => {
      const sql = stripSqlMarkdown(row.getValue('generatedSql') as string)
      return h(
        'div',
        {
          class:
            'bg-muted/50 p-2 rounded text-[10px] font-mono whitespace-pre-wrap break-all line-clamp-3 max-w-[250px] border border-border/50',
          title: sql,
        },
        sql || '-',
      )
    },
  },
  {
    accessorKey: 'userCorrection',
    header: t('feedback.user_correction'),
    cell: ({ row }) => {
      const correction = row.getValue('userCorrection') as string
      return correction
        ? h(
            'div',
            {
              class:
                'bg-primary/5 text-primary p-2 rounded text-[10px] font-mono whitespace-pre-wrap break-all line-clamp-3 max-w-[250px] border border-primary/10',
              title: correction,
            },
            correction,
          )
        : h('span', { class: 'text-muted-foreground italic' }, t('feedback.none'))
    },
  },
  {
    accessorKey: 'isAdopted',
    header: t('knowledge_base.status'),
    cell: ({ row }) => {
      const isAdopted = row.getValue('isAdopted') as boolean
      return isAdopted
        ? h(Badge, { variant: 'default' }, () => t('feedback.status_filter.approved'))
        : h(Badge, { variant: 'secondary' }, () => t('feedback.status_filter.pending'))
    },
  },
  {
    accessorKey: 'createdAt',
    header: t('feedback.date'),
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
          () => [h(Eye, { class: 'h-3.5 w-3.5' }), t('feedback.view')],
        ),
        item.userCorrection && !item.isAdopted
          ? h(
              Button,
              {
                variant: 'outline',
                size: 'sm',
                class: 'h-8 gap-1',
                onClick: () => promoteToKnowledge(item),
              },
              () => [h(GraduationCap, { class: 'h-3.5 w-3.5' }), t('feedback.promote')],
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
])

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
    exampleSql: stripSqlMarkdown(item.userCorrection || item.generatedSql),
    sourceType: item.sourceType || 'sql',
    sourceId: item.id,
  }
  isPromoteOpen.value = true
}

async function confirmPromotion() {
  try {
    const res = await api.post('/knowledge-base', {
      keyword: promoteForm.value.keyword,
      description: promoteForm.value.description,
      exampleSql: promoteForm.value.exampleSql,
      sourceType: promoteForm.value.sourceType,
      status: 'approved',
    })
    if (res.status === 201 || res.status === 200) {
      toast.success(t('feedback.toast.promote_success'))
      isPromoteOpen.value = false
      // Mark as adopted instead of deleting
      await api.post(`/ai/feedback/${promoteForm.value.sourceId}/adopt`)
      fetchFeedbacks()
    }
  }
  catch {
    toast.error(t('feedback.toast.promote_failed'))
  }
}

async function deleteFeedback(id: number, silent = false) {
  // eslint-disable-next-line no-alert
  if (!silent && !confirm(`${t('common.confirm_delete')}\n\n${t('knowledge_base.confirm.desc')}`)) {
    return
  }
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
          {{ t('feedback.title') }}
        </h2>
        <p class="text-muted-foreground text-sm">
          {{ t('feedback.desc') }}
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
          <DialogTitle>{{ t('feedback.promote_dialog.title') }}</DialogTitle>
          <DialogDescription>
            {{ t('feedback.promote_dialog.desc') }}
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="grid gap-2">
              <Label>{{ t('knowledge_base.keyword') }}</Label>
              <Input v-model="promoteForm.keyword" />
            </div>
            <div class="grid gap-2">
              <Label>{{ t('common.source_type') }}</Label>
              <Input :value="promoteForm.sourceType" disabled />
            </div>
          </div>
          <div class="grid gap-2">
            <Label>{{ t('knowledge_base.description') }}</Label>
            <Input v-model="promoteForm.description" />
          </div>
          <div class="grid gap-2">
            <Label>{{ t('common.query_example') }}</Label>
            <MonacoEditor
              v-model="promoteForm.exampleSql"
              class="h-64 border rounded-md overflow-hidden"
              :language="promoteForm.sourceType === 'elasticsearch' ? 'lucene' : 'sql'"
            />
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
            {{ t('feedback.detail_dialog.title') }}
            <Badge :variant="selectedItem?.isHelpful ? 'default' : 'destructive'" class="ml-2">
              <ThumbsUp v-if="selectedItem?.isHelpful" class="h-3 w-3 mr-1" />
              <ThumbsDown v-else class="h-3 w-3 mr-1" />
              {{ selectedItem?.isHelpful ? t('feedback.helpful') : t('feedback.needs_improvement') }}
            </Badge>
            <Badge variant="outline" class="ml-1 capitalize">
              {{ selectedItem?.sourceType }}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {{ t('feedback.detail_dialog.desc') }}
          </DialogDescription>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto px-6 py-4">
          <div class="space-y-6">
            <!-- Question -->
            <div class="space-y-2">
              <Label class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{{ t('feedback.detail_dialog.original_question') }}</Label>
              <div class="p-3 bg-muted/50 rounded-lg text-sm border">
                {{
                  selectedItem?.question === 'Unknown'
                    ? t('feedback.detail_dialog.na_greeting')
                    : selectedItem?.question
                }}
              </div>
            </div>

            <!-- Unified Interaction Flow -->
            <div class="space-y-3">
              <Label class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{{ t('feedback.detail_dialog.interaction') }}</Label>

              <div v-if="loadingContext" class="flex items-center justify-center py-12">
                <span class="text-sm text-muted-foreground italic animate-pulse">{{ t('feedback.detail_dialog.retrieving') }}</span>
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
                  {{ t('feedback.detail_dialog.deleted_history') }}
                </div>
                <div
                  v-else
                  class="px-4 py-2 bg-muted/50 border rounded text-[11px] text-muted-foreground text-center italic"
                >
                  {{ t('feedback.detail_dialog.captured_response') }}
                </div>

                <div class="flex flex-col gap-1 mr-auto items-start max-w-[92%]">
                  <span class="text-[10px] text-muted-foreground font-semibold px-2 uppercase">assistant</span>
                  <div class="text-xs p-4 rounded-2xl bg-background border shadow-sm w-full">
                    <pre
                      v-if="selectedItem?.generatedSql"
                      class="whitespace-pre-wrap font-mono text-[11px] leading-relaxed"
                    >{{ stripSqlMarkdown(selectedItem.generatedSql) }}</pre>
                    <span v-else class="text-muted-foreground italic">{{ t('feedback.detail_dialog.no_captured') }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- User Correction -->
            <div v-if="selectedItem?.userCorrection" class="space-y-2 pt-2 border-t">
              <Label class="text-sm font-semibold text-primary uppercase tracking-wider">{{ t('feedback.detail_dialog.user_expected') }}</Label>
              <MonacoEditor
                v-model="selectedItem.userCorrection"
                readonly
                class="h-[200px] border rounded-md overflow-hidden"
                :language="selectedItem.sourceType === 'elasticsearch' ? 'lucene' : 'sql'"
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
