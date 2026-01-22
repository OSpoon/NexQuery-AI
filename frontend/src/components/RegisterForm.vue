<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import PasswordStrength from '@/components/PasswordStrength.vue'
import { RouterLink } from 'vue-router'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const router = useRouter()
const authStore = useAuthStore()

const fullName = ref('')
const email = ref('')
const password = ref('')
const isLoading = ref(false)

const handleSubmit = async (e: Event) => {
  e.preventDefault()

  if (!fullName.value || !email.value || !password.value) {
    toast.error('Please fill in all fields')
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
    await authStore.register(fullName.value, email.value, password.value)
    toast.success('Registration successful. Please wait for admin approval.')
    router.push('/login')
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Registration failed')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div :class="cn('flex flex-col gap-6', props.class)">
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Enter your details to register</CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit="handleSubmit">
          <FieldGroup>
            <Field>
              <FieldLabel for="fullname">Full Name</FieldLabel>
              <Input
                id="fullname"
                v-model="fullName"
                type="text"
                placeholder="John Doe"
                required
                :disabled="isLoading"
              />
            </Field>
            <Field>
              <FieldLabel for="email">Email</FieldLabel>
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
              <FieldLabel for="password">Password</FieldLabel>
              <Input
                id="password"
                v-model="password"
                type="password"
                required
                :disabled="isLoading"
              />
              <PasswordStrength :password="password" />
              <p class="text-xs text-muted-foreground mt-1">
                Must be at least 12 characters with uppercase, lowercase, number, and special char.
              </p>
            </Field>
            <Field>
              <Button type="submit" :disabled="isLoading">
                {{ isLoading ? 'Registering...' : 'Sign Up' }}
              </Button>
              <FieldDescription class="text-center">
                Already have an account?
                <RouterLink to="/login" class="underline">Login</RouterLink>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
