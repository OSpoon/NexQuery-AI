<script setup lang="ts">
import type { SidebarProps } from '@/components/ui/sidebar'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import * as LucideIcons from 'lucide-vue-next'
import { Command } from 'lucide-vue-next'

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
const getIcon = (name: string | undefined) => {
  if (!name) return LucideIcons.Circle // Default icon
  // @ts-expect-error - indexing LucideIcons with string
  return LucideIcons[name] || LucideIcons.Circle
}

import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const navData = computed(() => {
  const menus = authStore.menus || []

  // If 2FA is required but not enabled, hide all navigation
  if (authStore.user && !authStore.user.twoFactorEnabled && settingsStore.require2fa) {
    return {
      navMain: [],
      admin: [],
    }
  }

  // Transform backend menu structure to frontend sidebar structure
  // Separate into 'navMain' (Platform) and others if needed.
  // For now, we put everything in navMain or split by top-level "Administration"

  const platformMenus = []
  const adminMenus = []

  // Helper to translate menu title
  const translateTitle = (title: string) => {
    // Try to map known titles to keys
    const keyMap: Record<string, string> = {
      Dashboard: 'sidebar.dashboard',
      Profile: 'sidebar.profile',
      Settings: 'sidebar.settings',
      'Data Sources': 'sidebar.data_sources',
      'Query Tasks': 'sidebar.query_tasks',
      History: 'sidebar.history',
      Administration: 'sidebar.admin.title',
      Users: 'sidebar.admin.users',
      Roles: 'sidebar.admin.roles',
      Menus: 'sidebar.admin.menus',
      'API Access': 'sidebar.admin.api_keys',
      'Knowledge Base': 'sidebar.knowledge_base',
      'AI Intelligence': 'sidebar.ai_intelligence',
      'AI Feedback': 'sidebar.ai_feedback',
    }
    const key = keyMap[title]
    return key ? t(key) : title
  }

  for (const menu of menus) {
    const item = {
      title: translateTitle(menu.title),
      url: menu.path,
      icon: getIcon(menu.icon),
      items: menu.children?.map((child) => ({
        title: translateTitle(child.title),
        url: child.path,
        icon: getIcon(child.icon),
        // Recursive children if needed, but Sidebar usually supports 1-2 levels only in this template
      })),
    }

    if (menu.title === 'Administration') {
      adminMenus.push(item)
    } else {
      platformMenus.push(item)
    }
  }

  // Inject Knowledge Base manually (MVP) - REMOVED, now in database

  // If Administration is a single item with children, we might want to extract children to be the group
  // The current sidebar template supports groups titles?
  // NavMain takes 'items' and 'title'.

  let adminItems: any[] = []
  if (adminMenus.length > 0) {
    const mainAdminMenu = adminMenus[0]
    // Assuming 'Administration' is a parent node and its children are the visible items
    if (mainAdminMenu?.items && mainAdminMenu.items.length > 0) {
      adminItems = mainAdminMenu.items
    } else if (mainAdminMenu) {
      adminItems = [mainAdminMenu]
    }
  }

  return {
    navMain: platformMenus,
    admin: adminItems,
  }
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
                class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <img src="/logo.png" alt="NexQuery AI" class="size-6 object-contain" />
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
      <NavMain :items="navData.navMain" :title="t('sidebar.platform')" />
      <NavMain :items="navData.admin" :title="t('sidebar.admin.title')" v-if="navData.admin.length > 0" />
    </SidebarContent>
    <SidebarFooter>
      <NavUser :user="userData" />
    </SidebarFooter>
  </Sidebar>
</template>
