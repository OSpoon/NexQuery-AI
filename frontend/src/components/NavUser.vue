<script setup lang="ts">
import {
  Activity,
  BadgeCheck,
  Check,
  ChevronsUpDown,
  Database,
  Github,
  HardDrive,
  Languages,
  LogOut,
  Mail,
  Palette,
  Webhook,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useAuthStore } from '@/stores/auth'

import { useSettingsStore } from '@/stores/settings'

defineProps<{
  user: {
    name: string
    email: string
    avatar?: string | null
  }
}>()

const { isMobile } = useSidebar()
const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()

function handleLogout() {
  authStore.logout()
  toast.success('Logged out successfully')
  router.push('/login')
}

const themes = [
  { name: 'Zinc', value: 'theme-zinc', color: 'bg-zinc-950' },
  { name: 'Red', value: 'theme-red', color: 'bg-red-600' },
  { name: 'Blue', value: 'theme-blue', color: 'bg-blue-600' },
  { name: 'Green', value: 'theme-green', color: 'bg-green-600' },
  { name: 'Orange', value: 'theme-orange', color: 'bg-orange-600' },
  { name: 'Violet', value: 'theme-violet', color: 'bg-violet-600' },
]

const { locale } = useI18n()

function setLocale(newLocale: string) {
  locale.value = newLocale
  localStorage.setItem('locale', newLocale)
  toast.success('Language switched')
}

function setTheme(themeValue: string) {
  settingsStore.setThemeColor(themeValue)
}
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar class="h-8 w-8 rounded-lg">
              <AvatarImage v-if="user.avatar" :src="user.avatar" />
              <AvatarFallback class="rounded-lg">
                {{ user.name.slice(0, 2).toUpperCase() }}
              </AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ user.name }}</span>
              <span class="truncate text-xs">{{ user.email }}</span>
            </div>
            <ChevronsUpDown class="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-[--reka-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          :side="isMobile ? 'bottom' : 'right'"
          align="end"
          :side-offset="4"
        >
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar class="h-8 w-8 rounded-lg">
                <AvatarImage v-if="user.avatar" :src="user.avatar" />
                <AvatarFallback class="rounded-lg">
                  {{ user.name.slice(0, 2).toUpperCase() }}
                </AvatarFallback>
              </Avatar>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-semibold">{{ user.name }}</span>
                <span class="truncate text-xs">{{ user.email }}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem @click="router.push('/profile')">
              <BadgeCheck />
              Account
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette />
                <span>Theme</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  v-for="theme in themes"
                  :key="theme.value"
                  class="gap-2 cursor-pointer"
                  @click="setTheme(theme.value)"
                >
                  <div class="h-4 w-4 rounded-full border border-muted" :class="theme.color" />
                  <span class="flex-1">{{ theme.name }}</span>
                  <Check v-if="settingsStore.themeColor === theme.value" class="h-4 w-4 ml-auto" />
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Languages />
                <span>Language</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem class="gap-2 cursor-pointer" @click="setLocale('en')">
                  <span>English</span>
                  <Check v-if="locale === 'en'" class="h-4 w-4 ml-auto" />
                </DropdownMenuItem>
                <DropdownMenuItem class="gap-2 cursor-pointer" @click="setLocale('zh-CN')">
                  <span>中文 (简体)</span>
                  <Check v-if="locale === 'zh-CN'" class="h-4 w-4 ml-auto" />
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              v-for="item in [
                { href: 'https://webhook.site', icon: Webhook, label: 'Webhook.site' },
                { href: 'http://localhost:1080', icon: Mail, label: 'MailCatcher' },
                { href: 'http://localhost:8080', icon: Database, label: 'Adminer' },
                { href: 'http://localhost:6333/dashboard', icon: HardDrive, label: 'Qdrant' },
                { href: 'https://us.cloud.langfuse.com', icon: Activity, label: 'Langfuse' },
              ]"
              :key="item.label"
              as-child
            >
              <a
                :href="item.href"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 cursor-pointer w-full"
              >
                <component :is="item.icon" class="size-4" />
                {{ item.label }}
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem as-child>
              <a
                href="https://github.com/OSpoon/nexquery-ai"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 cursor-pointer w-full"
              >
                <Github class="size-4" />
                GitHub
              </a>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="handleLogout">
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
