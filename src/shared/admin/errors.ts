import { APIError } from '@/shared/admin/api-client'

export const apiErrorMessages: Record<string, string> = {
  TIMEZONE_INVALID:
    'Enter a valid IANA timezone, such as Asia/Taipei or UTC.',
  SCHEDULE_TIME_INVALID:
    'Choose a valid date and time within the next 366 days, then check the timezone again.',
  STALE_LIVE:
    'The public version changed after this plan was created. Create a new plan if publication is still needed.',
  SCHEDULE_TRANSIENT:
    'The scheduled publication could not complete. Check the plan status; pending plans retry automatically.',
  PUBLICATION_INVALID:
    'The planned revision does not meet publication requirements. Correct the draft and create a new plan.',
  EDIT_CONFLICT: 'This entry changed elsewhere. Refresh before saving again.',
  MAINTENANCE: 'Writes are paused for maintenance. Try again after maintenance finishes.',
  SLUG_CONFLICT: 'This slug is already in use. Choose another slug.',
  CATALOG_LIMIT: 'The catalog has reached its entry limit.',
  INVALID_REQUEST:
    'Check the name and slug. Use lowercase letters, numbers and hyphens for the slug.',
  ASSET_TYPE_UNSUPPORTED: 'This file format is not supported for the selected media role.',
  ASSET_TOO_LARGE: 'The file exceeds the size limit for this media role.',
  ASSET_SIGNATURE_INVALID: 'The file content does not match its declared format.',
  UPLOAD_SESSION_EXPIRED: 'The upload session expired. Select the file to upload again.',
  UPLOAD_OUTCOME_UNKNOWN:
    'The upload result could not be confirmed. Retry to check the original upload before starting another.',
  PUBLICATION_CONFLICT: 'A slug or series position is already in use. Check the conflicting entry.',
  CONNECTION_FAILED: 'Connection failed. Your local changes are kept; retry when connected.',
  INVALID_RESPONSE: 'The server returned an unexpected response. Refresh and retry.',
  SAVE_FAILED: 'Unable to save. Your local changes are kept.',
  REFERENCE_NOT_FOUND: 'A referenced asset or catalog entry is unavailable. Review the document settings.',
  ASSET_NOT_READY: 'A referenced media asset is not ready. Wait for uploads to finish.',
  DATABASE_CAPACITY: 'The database reached its write limit. Review storage in Operations.',
  CSRF_INVALID: 'Your session expired. Refresh the page and retry.',
  AUTH_INVALID: 'Your session expired. Refresh the page and retry.',
}

export function adminError(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    return apiErrorMessages[error.code] ?? fallback
  }
  return fallback
}
