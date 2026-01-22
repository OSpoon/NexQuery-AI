<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import PasswordStrength from '@/components/PasswordStrength.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)

const reason = route.query.reason as string
const isExpired = reason === 'expired'

const handleSubmit = async (e: Event) => {
  e.preventDefault()

  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    toast.error('Please fill in all fields')
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    toast.error('New passwords do not match')
    return
  }

  // Password Strength Check
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/
  if (!passwordRegex.test(newPassword.value)) {
    toast.error(
      'Password must be at least 12 characters long and contain uppercase, lowercase, number, and special character.',
    )
    return
  }

  isLoading.value = true
  try {
    await authStore.changePassword(currentPassword.value, newPassword.value)
    toast.success('Password changed successfully')

    // Redirect to dashboard or login depending on flow
    if (authStore.isAuthenticated) {
      router.push('/')
    } else {
      router.push('/login')
    }
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Failed to change password')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div
    class="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-1 lg:px-0"
  >
    <div class="mx-auto w-full max-w-[350px]">
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription v-if="isExpired" class="text-destructive">
            Your password has expired. Please create a new one.
          </CardDescription>
          <CardDescription v-else>
            Update your password to keep your account secure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form @submit="handleSubmit">
            <FieldGroup>
              <Field>
                <FieldLabel for="currentPassword">Current Password</FieldLabel>
                <Input
                  id="currentPassword"
                  v-model="currentPassword"
                  type="password"
                  required
                  :disabled="isLoading"
                />
              </Field>
              <Field>
                <FieldLabel for="newPassword">New Password</FieldLabel>
                <Input
                  id="newPassword"
                  v-model="newPassword"
                  type="password"
                  required
                  :disabled="isLoading"
                />
                <PasswordStrength :password="newPassword" />
              </Field>
              <Field>
                <FieldLabel for="confirmPassword">Confirm New Password</FieldLabel>
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
                  {{ isLoading ? 'Changing...' : 'Change Password' }}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
