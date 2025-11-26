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
export interface TerminalActions {
  // Session management
  createTerminalSession?: (options?: { cwd?: string; context?: string }) => Promise<string>;
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

  // Ownership management
  checkTerminalOwnership?: (sessionId: string) => Promise<OwnershipStatus>;
  claimTerminalOwnership?: (sessionId: string, force?: boolean) => Promise<OwnershipResult>;
  releaseTerminalOwnership?: (sessionId: string) => Promise<OwnershipResult>;

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
