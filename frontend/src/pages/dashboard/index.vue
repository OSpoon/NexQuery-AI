<script setup lang="ts">
import AppSidebar from '@/components/AppSidebar.vue'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AiChatAssistant from '@/components/AiChatAssistant.vue'

defineOptions({
  name: 'DashboardLayout',
})

const route = useRoute()
const { t } = useI18n()

// Generate breadcrumbs based on route
const breadcrumbs = computed(() => {
  const path = route.path
  if (path === '/') {
    return [{ label: t('sidebar.dashboard'), href: '/' }]
  }
  // Can be dynamically generated based on actual routes
  return [
    { label: t('sidebar.dashboard'), href: '/' },
    { label: (route.name as string) || 'Page', href: path },
  ]
})
</script>

<template>
  <SidebarProvider class="h-svh overflow-hidden">
    <AppSidebar />
    <SidebarInset class="flex flex-col min-h-0 overflow-hidden">
      <header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <div class="flex items-center gap-2">
          <SidebarTrigger class="-ml-1" />
          <Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <template v-for="(crumb, index) in breadcrumbs" :key="index">
                <BreadcrumbItem class="hidden md:block">
                  <BreadcrumbLink v-if="index < breadcrumbs.length - 1" :href="crumb.href">
                    {{ crumb.label }}
                  </BreadcrumbLink>
                  <BreadcrumbPage v-else>
                    {{ crumb.label }}
                  </BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator
                  v-if="index < breadcrumbs.length - 1"
                  class="hidden md:block"
                />
              </template>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div class="flex-1 overflow-auto bg-muted/5 font-sans flex flex-col">
        <div class="flex-1">
          <RouterView />
        </div>
        <footer class="py-4 text-center text-sm text-muted-foreground">
          Built with ❤️ by the NexQuery AI Team.
        </footer>
      </div>
    </SidebarInset>
    <AiChatAssistant />
  </SidebarProvider>
</template>
