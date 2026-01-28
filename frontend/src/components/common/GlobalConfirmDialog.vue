<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useConfirmStore } from '@/stores/confirm'

const store = useConfirmStore()

function handleConfirm() {
  store.confirm()
}

function handleCancel() {
  store.cancel()
}
</script>

<template>
  <AlertDialog :open="store.isOpen" @update:open="(val) => !val && store.cancel()">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ store.options.title }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ store.options.description }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="handleCancel">
          {{ store.options.cancelText || 'Cancel' }}
        </AlertDialogCancel>
        <AlertDialogAction
          :class="store.options.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''"
          @click="handleConfirm"
        >
          {{ store.options.confirmText || 'Confirm' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
