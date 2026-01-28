import type { ConfirmOptions } from '@/stores/confirm'
import { useConfirmStore } from '@/stores/confirm'

export function useConfirm() {
  const store = useConfirmStore()

  const confirm = (options: ConfirmOptions) => {
    return store.open(options)
  }

  return {
    confirm,
  }
}
