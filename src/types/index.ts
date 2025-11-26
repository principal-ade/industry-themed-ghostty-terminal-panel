/**
 * Panel Extension Type Definitions
 *
 * Re-exports core types from @principal-ade/panel-framework-core
 */

// Re-export all core types from panel-framework-core
export type {
  // Core data types
  DataSlice,
  WorkspaceMetadata,
  RepositoryMetadata,
  FileTreeSource,
  ActiveFileSlice,

  // Event system
  PanelEventType,
  PanelEvent,
  PanelEventEmitter,

  // Panel interface
  PanelActions,
  PanelContextValue,
  PanelComponentProps,

  // Panel definition
  PanelMetadata,
  PanelLifecycleHooks,
  PanelDefinition,
  PanelModule,

  // Registry types
  PanelRegistryEntry,
  PanelLoader,
  PanelRegistryConfig,
} from '@principal-ade/panel-framework-core';

/**
 * Terminal tab representation for tabbed terminal panel.
 */
export interface TerminalTab {
  /** Unique tab identifier */
  id: string;
  /** Display label for the tab */
  label: string;
  /** Working directory for this tab's terminal */
  directory?: string;
  /** Whether this tab is currently active/visible */
  isActive: boolean;
}

/**
 * Props for the TabbedGhosttyTerminal component.
 */
export interface TabbedGhosttyTerminalProps {
  /** Panel context from framework */
  context: import('@principal-ade/panel-framework-core').PanelContextValue;
  /** Panel actions from framework */
  actions: import('@principal-ade/panel-framework-core').PanelActions;
  /** Panel event emitter from framework */
  events: import('@principal-ade/panel-framework-core').PanelEventEmitter;
  /**
   * Initial tabs to create. If not provided, creates a single tab
   * in the current directory.
   */
  initialTabs?: TerminalTab[];
  /**
   * Callback fired when tabs change (add, remove, reorder).
   * Useful for persisting tab state.
   */
  onTabsChange?: (tabs: TerminalTab[]) => void;
}
