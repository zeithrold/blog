'use client'
import { toast } from 'sonner'

/**
 * Announces a user-started operation only after the server confirmed it.
 *
 * The task resolves exactly `true` when an accepted response changed server
 * state. Skipped work, refusals and unknown outcomes resolve `false` (or
 * reject) and stay with the inline feedback the caller already renders, so a
 * toast never reports success for an unconfirmed or failed request.
 */
export function announceConfirmed(task: Promise<unknown>, message: string): void {
  task.then((confirmed) => {
    if (confirmed === true) {
      toast.success(message)
    }
  }, () => {})
}
