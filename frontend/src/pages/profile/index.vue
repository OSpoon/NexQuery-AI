<script setup lang="ts">
import { DateTime } from 'luxon'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'

const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const user = authStore.user
const { t } = useI18n()

// State
const twoFactorEnabled = ref(false)
const isLoading = ref(false)
// Disable Flow
const disablePassword = ref('')
const showEnableDialog = ref(false)
const showDisableDialog = ref(false)

// Enable Flow
const qrCodeUrl = ref('')
const secret = ref('')
const enableCode = ref('')
const recoveryCodes = ref<string[]>([])
const showRecoveryCodes = ref(false)

const lastPasswordChangeAt = ref<string | null>(null)
const createdAt = ref<string | null>(null)
const isWechatBound = ref(false)
const showUnbindDialog = ref(false)

onMounted(async () => {
  await fetchData()
})

async function fetchData() {
  // Assuming /me returns 2fa status in user object or separate field
  // We might need to update authStore.fetchPermissions or /me endpoint to include 'twoFactorEnabled' boolean in user object
  // Or we can just try to fetch 2fa status.
  // The current User interface doesn't have it.
  // However, we can check if it's in the response of /me if we update it.
  // For now, let's assume valid user object has it or we fetch it.
  try {
    const res = await api.get('/me')
    if (res.data.user) {
      twoFactorEnabled.value = !!res.data.user.twoFactorEnabled
      lastPasswordChangeAt.value = res.data.user.lastPasswordChangeAt
      createdAt.value = res.data.user.createdAt
      isWechatBound.value = !!res.data.user.isWechatBound

      // Auto-trigger setup if mandatory and not enabled
      if (!twoFactorEnabled.value) {
        startEnable2FA()
      }
    }
  }
  catch (e) {
    console.error(e)
  }
}

// Recovery Codes Dialog

const lastPasswordChangeAtFormatted = computed(() => {
  if (!lastPasswordChangeAt.value) {
    return createdAt.value
      ? `${DateTime.fromISO(createdAt.value).toLocaleString(DateTime.DATETIME_MED)
      } (Account Created)`
      : 'Never'
  }
  return DateTime.fromISO(lastPasswordChangeAt.value).toLocaleString(DateTime.DATETIME_MED)
})

const expirationDateFormatted = computed(() => {
  const baseDate = lastPasswordChangeAt.value || createdAt.value
  if (!baseDate)
    return 'Unknown'
  return DateTime.fromISO(baseDate).plus({ days: 90 }).toLocaleString(DateTime.DATETIME_MED)
})

const daysRemaining = computed(() => {
  const baseDate = lastPasswordChangeAt.value || createdAt.value
  if (!baseDate)
    return 0 // Force change if no dates
  const expiresAt = DateTime.fromISO(baseDate).plus({ days: 90 })
  const diff = expiresAt.diff(DateTime.now(), 'days').days
  return Math.max(0, Math.floor(diff))
})

async function startEnable2FA() {
  isLoading.value = true
  try {
    const res = await api.post('/auth/2fa/generate')
    qrCodeUrl.value = res.data.qrCode
    secret.value = res.data.secret
    enableCode.value = ''
    showEnableDialog.value = true
  }
  catch (e: any) {
    toast.error(e.response?.data?.message || 'Failed to generate 2FA secret')
  }
  finally {
    isLoading.value = false
  }
}

async function confirmEnable2FA() {
  if (!enableCode.value) {
    toast.error('Please enter the code')
    return
  }

  isLoading.value = true
  try {
    const res = await api.post('/auth/2fa/enable', {
      secret: secret.value,
      token: enableCode.value,
    })

    recoveryCodes.value = res.data.recoveryCodes
    twoFactorEnabled.value = true
    showEnableDialog.value = false
    showRecoveryCodes.value = true // Show codes in a separate dialog or step
    toast.success('Two-factor authentication enabled')

    // Refresh user state immediately to unblock navigation
    await authStore.fetchPermissions()
    await authStore.fetchMenus()
  }
  catch (e: any) {
    toast.error(e.response?.data?.message || 'Invalid code')
  }
  finally {
    isLoading.value = false
  }
}

function handleDisableClick() {
  if (settingsStore.require2fa) {
    toast.error('Two-factor authentication is mandatory and cannot be disabled.')
    return
  }
  showDisableDialog.value = true
}

async function confirmDisable2FA() {
  if (!disablePassword.value) {
    toast.error('Please enter your password')
    return
  }

  isLoading.value = true
  try {
    await api.post('/auth/2fa/disable', {
      password: disablePassword.value,
    })
    twoFactorEnabled.value = false
    showDisableDialog.value = false
    disablePassword.value = ''
    toast.success('Two-factor authentication disabled')
    await authStore.fetchPermissions() // Refresh state
  }
  catch (e: any) {
    toast.error(e.response?.data?.message || 'Incorrect password')
  }
  finally {
    isLoading.value = false
  }
}

// Recovery Codes Dialog

function handleUnbindClick() {
  showUnbindDialog.value = true
}

async function confirmUnbind() {
  isLoading.value = true
  try {
    await api.post('/auth/miniprogram/unbind')
    isWechatBound.value = false
    showUnbindDialog.value = false
    toast.success('WeChat account unbound successfully')
  }
  catch (e: any) {
    toast.error(e.response?.data?.message || 'Unbind failed')
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="container p-6 mx-auto max-w-4xl space-y-6">
    <div>
      <h2 class="text-3xl font-bold tracking-tight">
        {{ t('profile.title') }}
      </h2>
      <p class="text-muted-foreground">
        {{ t('profile.desc') }}
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>{{ t('profile.info') }}</CardTitle>
        <CardDescription>{{ t('profile.info_desc') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex items-center gap-6 mb-6">
          <Avatar class="h-24 w-24 border-2 border-muted">
            <AvatarImage v-if="user?.avatar" :src="user?.avatar" />
            <AvatarFallback class="text-xl">
              {{ user?.fullName?.slice(0, 2).toUpperCase() || '?' }}
            </AvatarFallback>
          </Avatar>
        </div>

        <div class="grid w-full max-w-sm items-center gap-1.5">
          <Label>{{ t('profile.full_name') }}</Label>
          <Input :model-value="user?.fullName" disabled />
        </div>
        <div class="grid w-full max-w-sm items-center gap-1.5">
          <Label>{{ t('auth.email') }}</Label>
          <Input :model-value="user?.email" disabled />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ t('profile.security') }}</CardTitle>
        <CardDescription>{{ t('profile.security_desc') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-6">
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <div class="font-medium">
              {{ t('profile.password') }}
            </div>
            <div class="text-sm text-muted-foreground">
              {{ t('profile.change_password_desc') }}
            </div>
          </div>
          <Button variant="outline" @click="$router.push('/change-password')">
            {{ t('profile.change_password') }}
          </Button>
        </div>

        <!-- Password Expiration Info -->
        <div class="rounded-lg border p-4 bg-muted/50">
          <div class="flex flex-row items-center justify-between space-y-0 pb-2">
            <div class="space-y-1">
              <p class="text-sm font-medium leading-none">
                {{ t('profile.password_exp') }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t('profile.exp_desc') }}
              </p>
            </div>
            <div :class="cn('font-bold', daysRemaining < 14 ? 'text-destructive' : 'text-primary')">
              {{ t('profile.days_remaining', { days: daysRemaining }) }}
            </div>
          </div>
          <div class="mt-4 text-xs text-muted-foreground">
            {{ t('profile.last_changed', { date: lastPasswordChangeAtFormatted }) }}
            <br>
            {{ t('profile.expires_on', { date: expirationDateFormatted }) }}
          </div>
        </div>

        <Separator />
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <div class="font-medium">
              {{ t('profile.2fa') }}
            </div>
            <div class="text-sm text-muted-foreground">
              {{ t('profile.2fa_desc') }}
            </div>
          </div>
          <div>
            <Button v-if="!twoFactorEnabled" :disabled="isLoading" @click="startEnable2FA">
              {{ t('profile.enable_2fa') }}
            </Button>
            <div v-else>
              <Button
                v-if="settingsStore.require2fa"
                variant="secondary"
                :disabled="isLoading"
                @click="handleDisableClick"
              >
                {{ t('profile.enabled_mandatory') }}
              </Button>
              <Button
                v-else
                variant="destructive"
                :disabled="isLoading"
                @click="handleDisableClick"
              >
                {{ t('profile.disable_2fa') }}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Third Party Binding</CardTitle>
        <CardDescription>Manage your connected third-party accounts.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-6">
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <div class="font-medium">
              WeChat (Mini Program)
            </div>
            <div class="text-sm text-muted-foreground">
              {{
                isWechatBound ? 'Bound to a WeChat account.' : 'Not bound to any WeChat account.'
              }}
            </div>
          </div>
          <div>
            <Button
              v-if="isWechatBound"
              variant="destructive"
              :disabled="isLoading"
              @click="handleUnbindClick"
            >
              Unbind
            </Button>
            <Button v-else variant="outline" disabled>
              Unbound
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Disable 2FA Dialog -->
    <Dialog v-model:open="showDisableDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('profile.dialog_disable_title') }}</DialogTitle>
          <DialogDescription>
            {{ t('profile.dialog_disable_desc') }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="password">{{ t('auth.password') }}</Label>
            <Input id="password" v-model="disablePassword" type="password" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showDisableDialog = false">
            {{
              t('common.cancel')
            }}
          </Button>
          <Button variant="destructive" :disabled="isLoading" @click="confirmDisable2FA">
            {{ t('profile.disable_2fa') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Enable 2FA Dialog -->
    <Dialog v-model:open="showEnableDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('profile.dialog_enable_title') }}</DialogTitle>
          <DialogDescription>
            {{ t('profile.dialog_enable_desc') }}
          </DialogDescription>
        </DialogHeader>
        <div class="flex flex-col items-center justify-center py-4 space-y-4">
          <div v-if="qrCodeUrl" class="bg-white p-2 rounded">
            <img :src="qrCodeUrl" alt="2FA QR Code" class="w-48 h-48">
          </div>
          <div class="w-full max-w-xs space-y-2 flex flex-col items-center">
            <Label for="code">{{ t('auth.2fa_code') }}</Label>
            <InputOTP id="code" v-model="enableCode" :maxlength="6">
              <InputOTPGroup>
                <InputOTPSlot :index="0" />
                <InputOTPSlot :index="1" />
                <InputOTPSlot :index="2" />
                <InputOTPSlot :index="3" />
                <InputOTPSlot :index="4" />
                <InputOTPSlot :index="5" />
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showEnableDialog = false">
            {{
              t('common.cancel')
            }}
          </Button>
          <Button :disabled="isLoading" @click="confirmEnable2FA">
            {{
              t('profile.verify_enable')
            }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Recovery Codes Dialog -->
    <Dialog v-model:open="showRecoveryCodes">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('profile.recovery_codes') }}</DialogTitle>
          <DialogDescription class="text-destructive font-semibold">
            {{ t('profile.recovery_desc') }}
          </DialogDescription>
        </DialogHeader>
        <div class="grid grid-cols-2 gap-4 py-4">
          <div
            v-for="code in recoveryCodes"
            :key="code"
            class="bg-muted p-2 text-center rounded text-sm font-mono"
          >
            {{ code }}
          </div>
        </div>
        <DialogFooter>
          <Button @click="showRecoveryCodes = false">
            {{ t('profile.saved_codes') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Unbind Dialog -->
    <Dialog v-model:open="showUnbindDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unbind WeChat Account</DialogTitle>
          <DialogDescription>
            Are you sure you want to unbind your WeChat account? You will no longer be able to use
            WeChat One-Click Login.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showUnbindDialog = false">
            {{
              t('common.cancel')
            }}
          </Button>
          <Button variant="destructive" :disabled="isLoading" @click="confirmUnbind">
            Confirm Unbind
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
