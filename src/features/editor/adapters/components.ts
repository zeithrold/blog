import type { Components } from '@blocknote/react'
import {
  FilePanelButton,
  FilePanelFileInput,
  FilePanelTabPanel,
  FilePanelTextInput,
  GenericBadgeGroup,
  GenericBadgeRoot,
  GenericMenuDivider,
  GenericMenuLabel,
  GenericPopoverTrigger,
  SideMenuRoot,
  SuggestionMenuEmptyItem,
  SuggestionMenuLabel,
  SuggestionMenuLoader,
  SuggestionMenuRoot,
  TableHandleExtendButton,
  TableHandleRoot,
} from '@/features/editor/adapters/components-extra'
import { DisabledFeature, FormRoot, FormTextInput, SuggestionItem } from '@/features/editor/adapters/components-form'
import { MenuButton, MenuDropdown, MenuItem, MenuRoot, MenuTrigger } from '@/features/editor/adapters/components-menu'
import { PopoverContent, PopoverRoot } from '@/features/editor/adapters/components-popover'
import { ToolbarButton, ToolbarRoot, ToolbarSelect } from '@/features/editor/adapters/components-toolbar'
import { SideMenuButton } from '@/features/editor/controls/block-actions/side-menu-button'

const toolbar = {
  Root: ToolbarRoot,
  Button: ToolbarButton,
  Select: ToolbarSelect,
}
const disabledGrid = {
  Root: DisabledFeature,
  EmptyItem: DisabledFeature,
  Item: DisabledFeature,
  Loader: DisabledFeature,
}
export const editorComponents = {
  FormattingToolbar: toolbar,
  LinkToolbar: toolbar,
  Generic: {
    Toolbar: toolbar,
    Menu: {
      Root: MenuRoot,
      Dropdown: MenuDropdown,
      Trigger: MenuTrigger,
      Item: MenuItem,
      Button: MenuButton,
      Divider: GenericMenuDivider,
      Label: GenericMenuLabel,
    },
    Popover: {
      Root: PopoverRoot,
      Content: PopoverContent,
      Trigger: GenericPopoverTrigger,
    },
    Form: {
      Root: FormRoot,
      TextInput: FormTextInput,
    },
    Badge: {
      Root: GenericBadgeRoot,
      Group: GenericBadgeGroup,
    },
  },
  SideMenu: {
    Root: SideMenuRoot,
    Button: SideMenuButton,
  },
  SuggestionMenu: {
    Root: SuggestionMenuRoot,
    Item: SuggestionItem,
    Label: SuggestionMenuLabel,
    EmptyItem: SuggestionMenuEmptyItem,
    Loader: SuggestionMenuLoader,
  },
  TableHandle: {
    Root: TableHandleRoot,
    ExtendButton: TableHandleExtendButton,
  },
  FilePanel: {
    Root: DisabledFeature,
    Button: FilePanelButton,
    TabPanel: FilePanelTabPanel,
    FileInput: FilePanelFileInput,
    TextInput: FilePanelTextInput,
  },
  GridSuggestionMenu: disabledGrid,
  Comments: {
    Card: DisabledFeature,
    CardSection: DisabledFeature,
    ExpandSectionsPrompt: DisabledFeature,
    Editor: DisabledFeature,
    Comment: DisabledFeature,
  },
  Versioning: {
    Sidebar: DisabledFeature,
    Snapshot: DisabledFeature,
  },
  AttributionTooltip: {
    Root: DisabledFeature,
  },
} satisfies Components
