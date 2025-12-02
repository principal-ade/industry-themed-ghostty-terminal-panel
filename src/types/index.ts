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

import type {
  PanelActions as CorePanelActions,
  PanelContextValue,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';

/**
 * Terminal session info returned from list
 */
export interface TerminalSessionInfo {
  id: string;
  pid: number;
  cwd: string;
  shell: string;
  createdAt: number;
  lastActivity: number;
  repositoryPath?: string;
  /** Context identifier used to filter/group sessions */
  context?: string;
}

/**
 * Options for creating a terminal session.
 */
export interface CreateTerminalSessionOptions {
  cwd?: string;
  command?: string;
  env?: Record<string, string>;
  /** Context identifier for filtering/grouping sessions */
  context?: string;
}

/**
 * Terminal ownership status returned by checkTerminalOwnership
 */
export interface OwnershipStatus {
  exists: boolean;
  ownedByWindowId: number | null;
  ownedByThisWindow?: boolean;
  canClaim: boolean;
  ownerWindowExists?: boolean;
}

/**
 * Result of ownership operations (claim/release)
 */
export interface OwnershipResult {
  success: boolean;
  reason?: string;
  ownedByWindowId?: number;
}

/**
 * Result of requesting a MessagePort for terminal data
 */
export interface RequestDataPortResult {
  success: boolean;
  reason?: string;
}

/**
 * Data provided when ownership of a terminal session is lost
 */
export interface OwnershipLostData {
  sessionId: string;
  newOwnerWindowId: number;
}

/**
 * Data provided when a MessagePort is ready
 */
export interface PortReadyData {
  sessionId: string;
  writable: boolean;
  ownershipToken?: string;
}

/**
 * Extended terminal actions interface for terminal-specific panel actions.
 * These actions are provided by the host application's PanelContext.
 */
export interface TerminalActions extends CorePanelActions {
  // Session management
  createTerminalSession?: (options?: CreateTerminalSessionOptions) => Promise<string>;
  writeToTerminal?: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal?: (sessionId: string, cols: number, rows: number) => Promise<void>;
  destroyTerminalSession?: (sessionId: string) => Promise<void>;

  // MessagePort-based data streaming (high-performance path)
  /**
   * Request a MessagePort for receiving terminal data directly.
   * This bypasses IPC for high-performance data streaming.
   * The port will be delivered via onTerminalPortReady callback.
   */
  requestTerminalDataPort?: (sessionId: string) => Promise<RequestDataPortResult>;

  /**
   * Register a callback to receive MessagePorts for terminal data streaming.
   * Call this before requestTerminalDataPort() to ensure you receive the port.
   * Returns an unsubscribe function.
   */
  onTerminalPortReady?: (
    callback: (data: PortReadyData, port: MessagePort) => void
  ) => () => void;

  // Session-specific data subscription (alternative to MessagePort)
  /**
   * Subscribe to terminal data for a specific session.
   * This is an alternative to MessagePort that uses the host's internal
   * data subscription mechanism (which may use MessagePort internally).
   * Returns an unsubscribe function.
   */
  onTerminalData?: (
    sessionId: string,
    callback: (data: string) => void
  ) => () => void;

  // List existing terminal sessions
  listTerminalSessions?: () => Promise<TerminalSessionInfo[]>;

  // Ownership management
  checkTerminalOwnership?: (sessionId: string) => Promise<OwnershipStatus>;
  claimTerminalOwnership?: (sessionId: string, force?: boolean) => Promise<OwnershipResult>;
  releaseTerminalOwnership?: (sessionId: string) => Promise<OwnershipResult>;

  /**
   * Subscribe to ownership lost events.
   * Called when another window takes ownership of a terminal this window was using.
   * Returns an unsubscribe function.
   */
  onOwnershipLost?: (callback: (data: OwnershipLostData) => void) => () => void;

  // Terminal control
  refreshTerminal?: (sessionId: string) => Promise<boolean>;
}

/**
 * Terminal tab representation for tabbed terminal panel.
 */
export interface TerminalTab {
  /** Unique tab identifier */
  id: string;
  /** Display label for the tab */
  label: string;
  /** Working directory for this tab's terminal */
  directory: string;
  /** Optional command to run */
  command?: string;
  /** Whether this tab is currently active/visible */
  isActive: boolean;
}

/**
 * Base props for terminal panel components
 */
export interface BaseTerminalPanelProps {
  /** Panel context from framework */
  context: PanelContextValue;
  /** Panel actions from framework (with terminal extensions) */
  actions: TerminalActions;
  /** Panel event emitter from framework */
  events: PanelEventEmitter;
}

/**
 * Props for the TabbedGhosttyTerminal component.
 */
export interface TabbedGhosttyTerminalProps extends BaseTerminalPanelProps {
  /**
   * Context identifier for terminal sessions.
   * Used to tag sessions so they can be restored/filtered.
   * The host decides how to construct this (e.g., by repository, workspace, etc.)
   */
  terminalContext: string;

  /**
   * Default directory for new terminal sessions.
   */
  directory: string;

  /**
   * Whether to hide the tab header bar
   * @default false
   */
  hideHeader?: boolean;

  /**
   * Whether the panel is currently visible (affects resize behavior)
   * @default true
   */
  isVisible?: boolean;

  /**
   * Callback when tabs change
   */
  onTabsChange?: (tabs: TerminalTab[]) => void;

  /**
   * Initial tabs to display
   */
  initialTabs?: TerminalTab[];

  /**
   * Whether to show all terminals (ignores context filtering)
   * @default false
   */
  showAllTerminals?: boolean;

  /**
   * Callback when showAllTerminals changes
   */
  onShowAllTerminalsChange?: (showAll: boolean) => void;
}

/**
 * Props for the single GhosttyTerminal component
 */
export interface GhosttyTerminalProps extends BaseTerminalPanelProps {
  /** Session ID if restoring an existing session */
  sessionId?: string;
  /** Working directory for new terminal */
  directory?: string;
  /** Optional command to run */
  command?: string;
  /** Whether terminal is visible */
  isVisible?: boolean;
}
