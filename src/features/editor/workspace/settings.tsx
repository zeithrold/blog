import type { ReactNode } from 'react'
import type { RevealPublicationProblem } from '@/features/editor/publication/publication-issue-list'
import type { ScheduleModel, useScheduleList } from '@/features/editor/publication/schedule-controller'
import type { Envelope } from '@/features/editor/workspace/document-model'
import type { ContentSettingsWorkspace, Workspace } from '@/features/editor/workspace/editor-types'
import { FileText, Send } from 'lucide-react'
import { useRef, useState } from 'react'
import {
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/ztd-me/client'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { CatalogSettings } from '@/features/catalog/catalog-settings'
import { LivePreview } from '@/features/editor/preview/live-preview'
import { PublicationSummary } from '@/features/editor/publication/publication-summary'
import { useSchedule } from '@/features/editor/publication/schedule-controller'
import { ScheduleSettings } from '@/features/editor/publication/schedule-settings'
import { ReferenceSettings } from '@/features/editor/references/reference-settings'
import { EditorHistory } from '@/features/editor/workspace/editor-history'
import { MetaFields } from '@/features/editor/workspace/meta-fields'
import { SettingsDrawer } from '@/features/editor/workspace/settings-drawer'
import { useCompactLayout } from '@/hooks/use-compact-layout'
import { useEditorLabels } from '@/i18n/use-labels'
import {
  editorSectionClass,
  layout4Class,
  layout5Class,
  layout6Class,
} from './settings-layout'

const sectionHeadingClass = [
  'editor-section-heading flex items-center gap-2 m-0 text-muted-foreground text-help font-semibold',
].join(' ')

type SettingsProps = {
  workspace: Workspace
  update: (patch: Partial<Envelope>) => void
  restore: (revision: string) => Promise<void>
  livePath: string | null
  schedules: ReturnType<typeof useScheduleList>
}

export function EditorSettings(props: SettingsProps): ReactNode {
  const text = useEditorLabels()
  const compact = useCompactLayout()
  const [tab, setTab] = useState('content')
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [referenceOpen, setReferenceOpen] = useState(false)
  const [drawerLayout, setDrawerLayout] = useState(compact)
  const revealRef = useRef<(() => void) | null>(null)
  const reveal: RevealPublicationProblem = (run) => {
    if (drawerLayout && inspectorOpen) {
      revealRef.current = run
      setInspectorOpen(false)
    }
    else { run() }
  }
  // Keep the active form mounted through rotation or split-screen resizing.
  // Apply the new layout once the author saves or explicitly discards it.
  if (!referenceOpen && drawerLayout !== compact) {
    setDrawerLayout(compact)
    setInspectorOpen(false)
  }
  const schedule = useSchedule(props.workspace, props.schedules)
  const tabs = {
    ...props,
    tab,
    setTab,
    schedule,
    scheduleOpen,
    setScheduleOpen,
    referenceOpen,
    setReferenceOpen,
    reveal,
  }
  return drawerLayout
    ? (
        <SettingsDrawer
          open={inspectorOpen}
          changeOpen={setInspectorOpen}
          uploading={props.workspace.model.uploading}
          revealRef={revealRef}
        >
          <SettingsTabs {...tabs} />
        </SettingsDrawer>
      )
    : (
        <aside className={layout4Class} aria-label={text('Document settings')}>
          <h2>{text('Document settings')}</h2>
          <SettingsTabs {...tabs} />
        </aside>
      )
}

type SettingsTabsProps = SettingsProps & {
  reveal: RevealPublicationProblem
  referenceOpen: boolean
  setReferenceOpen: (open: boolean) => void
  tab: string
  setTab: (tab: string) => void
  schedule: ScheduleModel
  scheduleOpen: boolean
  setScheduleOpen: (open: boolean) => void
}

function SettingsTabs(props: SettingsTabsProps): ReactNode {
  const text = useEditorLabels()
  const { workspace, update, restore, livePath } = props
  return (
    <Tabs value={props.tab} onValueChange={props.setTab} className={layout5Class}>
      <TabsList aria-label={text('Document settings')}>
        <TabsTrigger value="content">
          <FileText size={16} aria-hidden="true" />
          {text('Content')}
        </TabsTrigger>
        <TabsTrigger value="publication">
          <Send size={16} aria-hidden="true" />
          {text('Publication')}
        </TabsTrigger>
      </TabsList>
      <ScrollArea
        className={layout6Class}
        data-vaul-no-drag=""
        viewportProps={{
          'tabIndex': 0,
          'role': 'region',
          'aria-label': text('Document settings'),
        }}
      >
        <ContentSettings
          workspace={workspace}
          update={update}
          livePath={livePath}
          referenceOpen={props.referenceOpen}
          setReferenceOpen={props.setReferenceOpen}
        />
        <TabsContent forceMount value="publication">
          <section className={editorSectionClass}>
            <h3 className={sectionHeadingClass}>
              {text('Publication')}
            </h3>
            <PublicationSummary workspace={workspace} reveal={props.reveal} />
            <ScheduleSettings
              workspace={workspace}
              model={props.schedule}
              open={props.scheduleOpen}
              setOpen={props.setScheduleOpen}
            />
            <EditorHistory workspace={workspace} restore={restore} />
          </section>
        </TabsContent>
      </ScrollArea>
    </Tabs>
  )
}

export function ContentSettings({ workspace, update, livePath, referenceOpen, setReferenceOpen }: {
  workspace: ContentSettingsWorkspace
  update: (patch: Partial<Envelope>) => void
  livePath: string | null
  referenceOpen: boolean
  setReferenceOpen: (open: boolean) => void
}): ReactNode {
  const text = useEditorLabels()
  return (
    <TabsContent forceMount value="content">
      <section className={editorSectionClass}>
        <h3 className={sectionHeadingClass}>
          {text('Metadata')}
        </h3>
        <MetaFields workspace={workspace} update={update} livePath={livePath} />
      </section>
      <section className={editorSectionClass}>
        <h3 className={sectionHeadingClass}>
          {text('Preview')}
        </h3>
        <div className="editor-preview-actions grid gap-2 [&_.ztd-button]:w-full [&_a]:no-underline">
          <LivePreview />
        </div>
      </section>
      <section className={cn(editorSectionClass, 'gap-0 pb-0')}>
        <ReferenceSettings workspace={workspace} update={update} open={referenceOpen} setOpen={setReferenceOpen} />
        <CatalogSettings workspace={workspace} update={update} />
      </section>
    </TabsContent>
  )
}
