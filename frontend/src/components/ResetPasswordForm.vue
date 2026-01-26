<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import PasswordStrength from '@/components/PasswordStrength.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'

const route = useRoute()
const router = useRouter()

const email = ref('')
const token = ref('')
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)

onMounted(() => {
  email.value = (route.query.email as string) || ''
  token.value = (route.query.token as string) || ''

  if (!email.value || !token.value) {
    toast.error('Invalid reset link')
    router.push('/login')
  }
})

async function handleSubmit(e: Event) {
  e.preventDefault()

  if (password.value !== confirmPassword.value) {
    toast.error('Passwords do not match')
    return
  }

  // Password Strength Check
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/
  if (!passwordRegex.test(password.value)) {
    toast.error(
      'Password must be at least 12 characters long and contain uppercase, lowercase, number, and special character.',
    )
    return
  }

  isLoading.value = true
  try {
    await api.post('/password/reset', {
      email: email.value,
      token: token.value,
      password: password.value,
    })
    toast.success('Password reset successfully')
    router.push('/login')
  }
  catch (error: any) {
    toast.error(error.response?.data?.message || 'Failed to reset password')
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Reset Password</CardTitle>
      <CardDescription> Enter your new password below. </CardDescription>
    </CardHeader>
    <CardContent>
      <form @submit="handleSubmit">
        <FieldGroup>
          <Field>
            <FieldLabel for="password">
              New Password
            </FieldLabel>
            <Input
              id="password"
              v-model="password"
              type="password"
              required
              :disabled="isLoading"
            />
            <PasswordStrength :password="password" />
          </Field>
          <Field>
            <FieldLabel for="confirmPassword">
              Confirm New Password
            </FieldLabel>
            <Input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              required
              :disabled="isLoading"
            />
          </Field>
          <Field>
            <Button type="submit" :disabled="isLoading" class="w-full">
              {{ isLoading ? 'Resetting...' : 'Reset Password' }}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </CardContent>
  </Card>
</template>
