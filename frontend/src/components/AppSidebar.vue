<script setup lang="ts">
import type { SidebarProps } from '@/components/ui/sidebar'
import * as LucideIcons from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import NavMain from '@/components/NavMain.vue'
import NavUser from '@/components/NavUser.vue'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useAuthStore } from '@/stores/auth'

import { useSettingsStore } from '@/stores/settings'

const props = withDefaults(defineProps<SidebarProps>(), {
  variant: 'inset',
})

const authStore = useAuthStore()
const settingsStore = useSettingsStore()

const userData = computed(() => {
  if (authStore.user) {
    return {
      name: authStore.user.fullName || 'User',
      email: authStore.user.email,
      avatar: authStore.user.avatar || '',
    }
  }
  return {
    name: 'Guest',
    email: 'guest@example.com',
    avatar: '',
  }
})

// Helper to resolve icon component from string name
function getIcon(name: string | undefined) {
  if (!name)
    return LucideIcons.Circle // Default icon
  // @ts-expect-error - indexing LucideIcons with string
  return LucideIcons[name] || LucideIcons.Circle
}

const { t } = useI18n()

const navData = computed(() => {
  const menus = authStore.menus || []

  // If 2FA is required but not enabled, hide all navigation
  if (authStore.user && !authStore.user.twoFactorEnabled && settingsStore.require2fa) {
    return []
  }

  // Transform backend menu structure to frontend sidebar structure
  // Separate into 'navMain' (Platform) and others if needed.
  // For now, we put everything in navMain or split by top-level "Administration"

  // Dynamic Grouping Logic
  const groups: { title: string, items: any[] }[] = []
  const defaultGroupItems: any[] = []

  // Helper to translate menu title
  const translateTitle = (title: string) => {
    // Try to map known titles to keys
    const keyMap: Record<string, string> = {
      'Dashboard': 'sidebar.dashboard',
      'Profile': 'sidebar.profile',
      'Settings': 'sidebar.settings',
      'Data Sources': 'sidebar.data_sources',
      'Query Tasks': 'sidebar.query_tasks',
      'History': 'sidebar.history',
      'Administration': 'sidebar.admin.title', // Legacy mapping
      'Users': 'sidebar.admin.users',
      'Roles': 'sidebar.admin.roles',
      'Permissions': 'sidebar.admin.permissions',
      'Menus': 'sidebar.admin.menus',
      'API Access': 'sidebar.admin.api_keys',
      'Knowledge Base': 'sidebar.knowledge_base',
      'AI Intelligence': 'sidebar.ai_intelligence',
      'AI Feedback': 'sidebar.ai_feedback',
      'FinOps Monitoring': 'sidebar.admin.finops',
    }
    const key = keyMap[title]
    // If translation exists, use it. Otherwise use title as-is (allow user-defined strings)
    return key ? t(key) : title
  }

  // Recursive mapper
  const mapMenuToItem = (menu: any): any => ({
    title: translateTitle(menu.title),
    url: menu.path,
    icon: getIcon(menu.icon),
    items: menu.children?.map(mapMenuToItem),
  })

  // Grouping Strategy:
  // 1. Root items WITH children -> Distinct Group
  // 2. Root items WITHOUT children -> Default Group (Platform)

  for (const menu of menus) {
    if (menu.children && menu.children.length > 0) {
      groups.push({
        title: translateTitle(menu.title),
        items: menu.children.map(mapMenuToItem),
      })
    }
    else {
      defaultGroupItems.push(mapMenuToItem(menu))
    }
  }

  // Place default group at the top (if it has items)
  if (defaultGroupItems.length > 0) {
    groups.unshift({
      title: t('sidebar.platform'),
      items: defaultGroupItems,
    })
  }

  return groups
})
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child>
            <RouterLink to="/">
              <div
                class="flex aspect-square size-8 items-center justify-center rounded-lg text-sidebar-primary-foreground"
              >
                <img src="/logo.png" alt="NexQuery AI" class="size-10 object-contain">
              </div>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">{{ settingsStore.platformName }}</span>
                <span class="truncate text-xs">Data Platform</span>
              </div>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain
        v-for="(group, idx) in navData"
        :key="idx"
        :items="group.items"
        :title="group.title"
      />
    </SidebarContent>
    <SidebarFooter>
      <NavUser :user="userData" />
    </SidebarFooter>
  </Sidebar>
</template>
