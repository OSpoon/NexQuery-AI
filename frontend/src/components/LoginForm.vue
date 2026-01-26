<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { cn } from '@/lib/utils'

import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { t } = useI18n()

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const isTwoFactorStep = ref(false)
const twoFactorCode = ref('')
const tempToken = ref('')

async function handleSubmit(e: Event) {
  e.preventDefault()

  if (isTwoFactorStep.value) {
    if (!twoFactorCode.value) {
      toast.error('Please enter the verification code')
      return
    }
  }
  else {
    if (!email.value || !password.value) {
      toast.error('Please enter email and password')
      return
    }
  }

  isLoading.value = true
  try {
    if (isTwoFactorStep.value) {
      await authStore.verify2fa(tempToken.value, twoFactorCode.value)
      toast.success('Login successful')
      const redirect = (route.query.redirect as string) || '/'
      router.push(redirect)
    }
    else {
      const result = await authStore.login(email.value, password.value)

      if (result && result.requiresPasswordChange) {
        toast.warning(t('auth.password_expired'))
        router.push('/change-password?reason=expired')
        return
      }

      if (result && result.requiresTwoFactor) {
        isTwoFactorStep.value = true
        tempToken.value = result.tempToken!
        toast.info(t('auth.code_error')) // Reusing code_error or create new 'please_enter_code'
        isLoading.value = false
        return
      }

      toast.success(t('auth.login_success'))
      // Redirect to previous page or home
      const redirect = (route.query.redirect as string) || '/'
      router.push(redirect)
    }
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : t('auth.login_failed'))
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div :class="cn('flex flex-col gap-6', props.class)">
    <Card>
      <CardHeader>
        <CardTitle>{{ t('auth.title') }}</CardTitle>
        <CardDescription>
          {{ isTwoFactorStep ? t('auth.desc_2fa') : t('auth.desc_default') }}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit="handleSubmit">
          <FieldGroup v-if="!isTwoFactorStep">
            <Field>
              <FieldLabel for="email">
                {{ t('auth.email') }}
              </FieldLabel>
              <Input
                id="email"
                v-model="email"
                type="email"
                placeholder="m@example.com"
                required
                :disabled="isLoading"
              />
            </Field>
            <Field>
              <div class="flex items-center">
                <FieldLabel for="password">
                  {{ t('auth.password') }}
                </FieldLabel>
                <RouterLink
                  to="/forgot-password"
                  class="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                >
                  {{ t('auth.forgot_password') }}
                </RouterLink>
              </div>
              <Input
                id="password"
                v-model="password"
                type="password"
                required
                :disabled="isLoading"
              />
            </Field>
          </FieldGroup>

          <FieldGroup v-else>
            <Field
              class="flex flex-col items-center justify-center [&>*]:w-auto text-center space-y-2"
            >
              <FieldLabel for="code">
                {{ t('auth.2fa_code') }}
              </FieldLabel>
              <InputOTP id="code" v-model="twoFactorCode" :maxlength="6">
                <InputOTPGroup>
                  <InputOTPSlot :index="0" />
                  <InputOTPSlot :index="1" />
                  <InputOTPSlot :index="2" />
                  <InputOTPSlot :index="3" />
                  <InputOTPSlot :index="4" />
                  <InputOTPSlot :index="5" />
                </InputOTPGroup>
              </InputOTP>
            </Field>
          </FieldGroup>

          <div class="mt-4">
            <Button type="submit" :disabled="isLoading" class="w-full">
              {{
                isLoading
                  ? t('common.loading')
                  : isTwoFactorStep
                    ? t('auth.verify')
                    : t('auth.login')
              }}
            </Button>
          </div>

          <FieldDescription v-if="!isTwoFactorStep" class="text-center mt-4">
            {{ t('auth.no_account') }}
            <RouterLink to="/register" class="underline">
              {{ t('auth.sign_up') }}
            </RouterLink>
          </FieldDescription>
          <FieldDescription v-else class="text-center mt-4">
            <Button variant="link" size="sm" @click="isTwoFactorStep = false">
              {{
                t('auth.back_to_login')
              }}
            </Button>
          </FieldDescription>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
