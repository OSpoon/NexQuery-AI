<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'
import { useSettingsStore } from '@/stores/settings'
import {
  BadgeCheck,
  ChevronsUpDown,
  LogOut,
  Palette,
  Check,
  Github,
  Languages,
  Webhook,
  Mail,
  Database,
  HardDrive,
  Activity,
} from 'lucide-vue-next'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

defineProps<{
  user: {
    name: string
    email: string
  }
}>()

const { isMobile } = useSidebar()
const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()

const handleLogout = () => {
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

import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

const setLocale = (newLocale: string) => {
  locale.value = newLocale
  localStorage.setItem('locale', newLocale)
  toast.success('Language switched')
}

const setTheme = (themeValue: string) => {
  settingsStore.setThemeColor(themeValue)
}
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
            <Avatar class="h-8 w-8 rounded-lg">
              <AvatarFallback class="rounded-lg"> CN </AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ user.name }}</span>
              <span class="truncate text-xs">{{ user.email }}</span>
            </div>
            <ChevronsUpDown class="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-[--reka-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          :side="isMobile ? 'bottom' : 'right'" align="end" :side-offset="4">
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar class="h-8 w-8 rounded-lg">
                <AvatarFallback class="rounded-lg"> CN </AvatarFallback>
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
                <DropdownMenuItem v-for="theme in themes" :key="theme.value" @click="setTheme(theme.value)"
                  class="gap-2 cursor-pointer">
                  <div class="h-4 w-4 rounded-full border border-muted" :class="theme.color"></div>
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
                <DropdownMenuItem @click="setLocale('en')" class="gap-2 cursor-pointer">
                  <span>English</span>
                  <Check v-if="locale === 'en'" class="h-4 w-4 ml-auto" />
                </DropdownMenuItem>
                <DropdownMenuItem @click="setLocale('zh-CN')" class="gap-2 cursor-pointer">
                  <span>中文 (简体)</span>
                  <Check v-if="locale === 'zh-CN'" class="h-4 w-4 ml-auto" />
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem v-for="item in [
              { href: 'https://webhook.site', icon: Webhook, label: 'Webhook.site' },
              { href: 'http://localhost:1080', icon: Mail, label: 'MailCatcher' },
              { href: 'http://localhost:8080', icon: Database, label: 'Adminer' },
              { href: 'http://localhost:6333/dashboard', icon: HardDrive, label: 'Qdrant' },
              { href: 'https://us.cloud.langfuse.com', icon: Activity, label: 'Langfuse' },
            ]" :key="item.label" as-child>
              <a :href="item.href" target="_blank" rel="noopener noreferrer"
                class="flex items-center gap-2 cursor-pointer w-full">
                <component :is="item.icon" class="size-4" />
                {{ item.label }}
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem as-child>
              <a href="https://github.com/OSpoon/nexquery-ai" target="_blank" rel="noopener noreferrer"
                class="flex items-center gap-2 cursor-pointer w-full">
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
