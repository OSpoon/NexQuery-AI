<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, MailOpen, XCircle } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useNotificationStore } from '@/stores/notification'

const store = useNotificationStore()
const isOpen = ref(false)

onMounted(() => {
  store.fetchNotifications()
})

function getIcon(type: string) {
  switch (type) {
    case 'success': return CheckCircle2
    case 'error': return XCircle
    case 'warning': return AlertTriangle
    default: return Info
  }
}

function getIconColor(type: string) {
  switch (type) {
    case 'success': return 'text-green-500'
    case 'error': return 'text-red-500'
    case 'warning': return 'text-amber-500'
    default: return 'text-blue-500'
  }
}

async function handleMarkAllRead() {
  await store.markAllAsRead()
}

async function handleMarkRead(id: number) {
  await store.markAsRead(id)
}
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetTrigger as-child>
      <Button variant="ghost" size="icon" class="relative group h-8 w-8 rounded-full hover:bg-accent">
        <Bell class="h-4 w-4 opacity-70 group-hover:opacity-100 transition-opacity" />
        <Badge
          v-if="store.unreadCount > 0"
          variant="destructive"
          class="absolute -top-1 -right-1 h-3.5 w-3.5 flex items-center justify-center p-0 text-[8px] animate-in zoom-in border border-background shadow-sm"
        >
          {{ store.unreadCount > 99 ? '99+' : store.unreadCount }}
        </Badge>
      </Button>
    </SheetTrigger>

    <SheetContent side="right" class="w-[400px] sm:w-[540px] p-0 flex flex-col h-full bg-background/95 backdrop-blur-sm">
      <SheetHeader class="p-6 pb-4">
        <div class="flex items-center justify-between">
          <SheetTitle class="text-xl font-bold flex items-center gap-2">
            消息中心
            <Badge v-if="store.unreadCount > 0" variant="secondary" class="font-normal">
              {{ store.unreadCount }} 条未读
            </Badge>
          </SheetTitle>
          <SheetDescription>
            查看并管理您的系统通知和任务动态。
          </SheetDescription>
          <Button
            v-if="store.unreadCount > 0"
            variant="ghost"
            size="sm"
            class="text-xs h-8 gap-1.5"
            @click="handleMarkAllRead"
          >
            <CheckCheck class="h-3.5 w-3.5" />
            全部已读
          </Button>
        </div>
      </SheetHeader>

      <Separator />

      <ScrollArea class="flex-1 px-1">
        <div v-if="store.notifications.length === 0" class="flex flex-col items-center justify-center h-[400px] text-muted-foreground gap-3">
          <MailOpen class="h-12 w-12 opacity-20" />
          <p>暂无消息通知</p>
        </div>

        <div v-else class="flex flex-col">
          <div
            v-for="item in store.notifications"
            :key="item.id"
            class="group relative flex flex-col gap-1 p-6 transition-colors hover:bg-accent/50 cursor-pointer"
            :class="{ 'bg-accent/30': !item.isRead }"
            @click="handleMarkRead(item.id)"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-3">
                <component
                  :is="getIcon(item.type)"
                  class="h-5 w-5 shrink-0"
                  :class="getIconColor(item.type)"
                />
                <h4 class="font-semibold text-sm leading-none" :class="{ 'font-bold': !item.isRead }">
                  {{ item.title }}
                </h4>
              </div>
              <span class="text-[10px] text-muted-foreground whitespace-nowrap">
                {{ formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: zhCN }) }}
              </span>
            </div>

            <p class="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed pl-8">
              {{ item.content }}
            </p>

            <div v-if="!item.isRead" class="absolute left-2 top-1/2 -translate-y-1/2 w-1 h-3/4 bg-primary rounded-full" />

            <div class="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <!-- Future actions like 'Delete' can go here -->
            </div>
          </div>
        </div>
      </ScrollArea>

      <Separator />

      <div class="p-4 bg-muted/30">
        <p class="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-medium">
          仅保留最近 50 条消息通知
        </p>
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
