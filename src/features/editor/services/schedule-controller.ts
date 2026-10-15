import type { z } from 'zod'
import type { Workspace } from '@/features/editor/core/editor-types'
import { useRef, useState } from 'react'
import { openDocumentSchema } from '@/content/contracts'
import {
  scheduleAckSchema,
  scheduleListSchema,
  scheduleTimeSchema,
} from '@/content/service-contracts'
import { APIError, get } from '@/features/editor/services/api-client'
import { useAdminResource } from '@/shared/admin/resource'

export type ScheduleModel = {
  localTime: string
  timezone: string
  chosen: string
  busy: boolean
  checking: boolean
  loading: boolean
  listError: boolean
  notice: string
  choices: z.infer<typeof scheduleTimeSchema>['choices']
  items: z.infer<typeof scheduleListSchema>['items']
  setChosen: (value: string) => void
  update: (field: 'localTime' | 'timezone', value: string) => void
  times: () => Promise<void>
  load: () => Promise<void>
  submit: (id?: string) => Promise<void>
}

export function useScheduleList(workspace: Workspace):
ReturnType<typeof useAdminResource<z.infer<typeof scheduleListSchema>>> {
  const base = `/api/admin/documents/${workspace.props.initial.documentId}/schedule`
  return useAdminResource(`${base}?version=${workspace.draft.ack.version}`, scheduleListSchema)
}

export function useSchedule(workspace: Workspace, list: ReturnType<typeof useScheduleList>): ScheduleModel {
  const time = useScheduleTime()
  const [busy, setBusy] = useState(false)
  const flightRef = useRef(false)
  const base = `/api/admin/documents/${workspace.props.initial.documentId}`
  const load = async (): Promise<void> => {
    await list.refresh()
  }
  const submit = async (id?: string): Promise<void> => {
    if (flightRef.current) {
      return
    }
    flightRef.current = true
    setBusy(true)
    try {
      await workspace.perform(async () => {
        if (id === undefined) {
          await submitSchedule({ workspace, base, ...time })
        }
        else {
          await workspace.draft.coordinator.mutateMetadata(async () => await cancelSchedule(workspace, base, id))
        }
      }, { saveDraft: id === undefined })
    }
    finally {
      flightRef.current = false
      setBusy(false)
      await load()
    }
  }
  return {
    ...time,
    items: list.data?.items ?? [],
    loading: list.loading,
    listError: list.error !== '',
    busy,
    load,
    submit,
  }
}
function useScheduleTime(): Pick<
  ScheduleModel,
  'localTime' | 'timezone' | 'choices' | 'chosen' | 'notice' | 'checking' | 'setChosen' | 'update' | 'times'
> {
  const [localTime, setLocalTime] = useState('')
  const [timezone, setTimezone] = useState(
    () => new Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const [choices, setChoices] = useState<ScheduleModel['choices']>([])
  const [chosen, setChosen] = useState('')
  const [notice, setNotice] = useState('')
  const [checking, setChecking] = useState(false)
  const requestRef = useRef(0)
  const update = (field: 'localTime' | 'timezone', value: string): void => {
    requestRef.current++
    setChecking(false)
    if (field === 'localTime') {
      setLocalTime(value)
    }
    else {
      setTimezone(value)
    }
    setChoices([])
    setChosen('')
    setNotice('')
  }
  const times = async (): Promise<void> => {
    const request = ++requestRef.current
    setChecking(true)
    setNotice('')
    setChoices([])
    setChosen('')
    try {
      const value = await get(
        `/api/admin/schedule-time?localTime=${encodeURIComponent(localTime)}&timezone=${encodeURIComponent(timezone)}`,
        scheduleTimeSchema,
      )
      if (request === requestRef.current) {
        setChoices(value.choices)
        setNotice(value.choices.length === 0 ? 'This local time does not exist in this timezone.' : '')
      }
    }
    catch (error) {
      if (request === requestRef.current) {
        setNotice(error instanceof APIError ? error.code : 'CONNECTION_FAILED')
      }
    }
    finally {
      if (request === requestRef.current) {
        setChecking(false)
      }
    }
  }
  return { localTime, timezone, choices, chosen, notice, checking, update, times, setChosen }
}

async function submitSchedule(input: {
  workspace: Workspace
  base: string
  choices: ScheduleModel['choices']
  chosen: string
  localTime: string
  timezone: string
}): Promise<void> {
  const { workspace } = input
  const base = workspace.draft.coordinator.acknowledgement
  const choice = input.choices.find(value => String(value.runAt) === input.chosen)
  if (choice === undefined) {
    throw new Error('Choose a verified UTC offset.')
  }
  const body = {
    localTime: input.localTime,
    timezone: input.timezone,
    ...choice,
    revisionId: base.headRevisionId,
    expectedVersion: base.version,
    expectedLiveGeneration: base.liveGeneration,
  }
  const ack = await workspace.draft.client.mutate({
    path: `${input.base}/schedule`,
    method: 'POST',
    body,
    schema: scheduleAckSchema,
  })
  workspace.draft.coordinator.accept(ack)
}

async function cancelSchedule(workspace: Workspace, base: string, id: string) {
  const latest = await get(base, openDocumentSchema)
  return await workspace.draft.client.mutate({
    path: `${base}/schedule`,
    method: 'DELETE',
    body: { scheduleId: id, expectedVersion: latest.version },
    schema: scheduleAckSchema,
  })
}
