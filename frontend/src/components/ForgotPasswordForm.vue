<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'

const email = ref('')
const isLoading = ref(false)
const isSubmitted = ref(false)

async function handleSubmit(e: Event) {
  e.preventDefault()
  if (!email.value)
    return

  isLoading.value = true
  try {
    await api.post('/password/email', { email: email.value })
    toast.success('Reset link sent to your email')
    isSubmitted.value = true
  }
  catch (error: any) {
    toast.error(error.response?.data?.message || 'Failed to send reset link')
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Forgot Password</CardTitle>
      <CardDescription>
        Enter your email address and we'll send you a link to reset your password.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div v-if="isSubmitted" class="text-center space-y-4">
        <p class="text-sm text-muted-foreground">
          If an account exists for {{ email }}, you will receive a password reset link shortly.
        </p>
        <Button variant="outline" as-child>
          <RouterLink to="/login">
            Back to Login
          </RouterLink>
        </Button>
      </div>
      <form v-else @submit="handleSubmit">
        <FieldGroup>
          <Field>
            <FieldLabel for="email">
              Email
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
            <Button type="submit" :disabled="isLoading" class="w-full">
              {{ isLoading ? 'Sending...' : 'Send Reset Link' }}
            </Button>
            <div class="text-center text-sm">
              <RouterLink to="/login" class="underline">
                Back to Login
              </RouterLink>
            </div>
          </Field>
        </FieldGroup>
      </form>
    </CardContent>
  </Card>
</template>
