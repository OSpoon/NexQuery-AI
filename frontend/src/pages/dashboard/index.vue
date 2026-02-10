<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AiChatAssistant from '@/components/AiChatAssistant.vue'
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

defineOptions({
  name: 'DashboardLayout',
})

const route = useRoute()
const { t } = useI18n()

// Helper to translate route name to readable title
function getRouteTitle(name: string): string {
  const keyMap: Record<string, string> = {
    'home': 'sidebar.dashboard',
    'dashboard': 'sidebar.dashboard',
    'profile': 'sidebar.profile',
    'data-sources': 'sidebar.data_sources',
    'knowledge-base': 'sidebar.knowledge_base',
    'query-tasks': 'sidebar.query_tasks',
    'query-run': 'sidebar.query_run',

    'history': 'sidebar.history',
    'admin-users': 'sidebar.admin.users',
    'admin-roles': 'sidebar.admin.roles',
    'admin-permissions': 'sidebar.admin.permissions',
    'admin-menus': 'sidebar.admin.menus',
    'admin-api-keys': 'sidebar.admin.api_keys',
    'admin-settings': 'sidebar.admin.settings',
    'admin-evaluations': 'sidebar.spider_evaluation',
    'ai-feedback': 'sidebar.ai_feedback',
  }

  // 1. Check if title is passed in meta (for dynamic routes)
  if (route.meta.title) {
    return translateTitle(route.meta.title as string)
  }

  const key = keyMap[name]
  if (key && t(key) !== key) {
    return t(key)
  }

  // Default to capitalizing the name if no translation found
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// Helper to translate menu title (same logic as AppSidebar)
function translateTitle(title: string): string {
  const keyMap: Record<string, string> = {
    'Dashboard': 'sidebar.dashboard',
    'Profile': 'sidebar.profile',
    'Settings': 'sidebar.settings',
    'Data Sources': 'sidebar.data_sources',
    'Query Tasks': 'sidebar.query_tasks',
    'History': 'sidebar.history',
    'Administration': 'sidebar.admin.title',
    'Users': 'sidebar.admin.users',
    'Roles': 'sidebar.admin.roles',
    'Permissions': 'sidebar.admin.permissions',
    'Menus': 'sidebar.admin.menus',
    'API Access': 'sidebar.admin.api_keys',
    'Knowledge Base': 'sidebar.knowledge_base',
    'AI Intelligence': 'sidebar.ai_intelligence',
    'AI Feedback': 'sidebar.ai_feedback',
    'FinOps Monitoring': 'sidebar.admin.finops',
    'Spider Evaluation': 'sidebar.spider_evaluation',
  }
  const key = keyMap[title]
  return key ? t(key) : title
}

// Generate breadcrumbs based on route
const breadcrumbs = computed(() => {
  const path = route.path
  if (path === '/') {
    return [{ label: t('sidebar.dashboard'), href: '/' }]
  }

  // If we are deep in workflow, we might want intermediate crumbs?
  // For now, keep it simple: Dashboard > Current Page Name
  const currentTitle = getRouteTitle(route.name as string || '')

  return [
    { label: t('sidebar.dashboard'), href: '/' },
    { label: currentTitle, href: path },
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
