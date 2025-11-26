import { GhosttyTerminal } from './panels/GhosttyTerminal';
import { TabbedGhosttyTerminal } from './panels/TabbedGhosttyTerminal';
import type { PanelDefinition, PanelContextValue } from './types';

/**
 * Export array of panel definitions.
 * This is the required export for panel extensions.
 */
export const panels: PanelDefinition[] = [
  {
    metadata: {
      id: 'com.ghostty.terminal-panel',
      name: 'Ghostty Terminal',
      icon: '💻',
      version: '0.1.0',
      author: 'Ghostty Integration',
      description:
        'High-performance Wasm-based terminal panel using the Ghostty rendering engine',
      slices: ['terminal'], // Data slices this panel depends on
    },
    component: GhosttyTerminal,

    // Called when this specific panel is mounted
    onMount: async (context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log(
        'Ghostty Terminal mounted',
        context.currentScope.repository?.path
      );

      // Request terminal initialization from host
      // The host should spawn a PTY process and begin streaming data
    },

    // Called when this specific panel is unmounted
    onUnmount: async (_context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log('Ghostty Terminal unmounting');

      // The host should be notified to clean up the PTY process
    },
  },
  {
    metadata: {
      id: 'com.ghostty.tabbed-terminal-panel',
      name: 'Tabbed Ghostty Terminal',
      icon: '📑',
      version: '0.1.0',
      author: 'Ghostty Integration',
      description:
        'Multi-tab terminal panel with keyboard shortcuts (⌘T, ⌘W, ⌘1-9) using Ghostty rendering engine',
      slices: ['terminal'],
    },
    component: TabbedGhosttyTerminal,

    onMount: async (context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log(
        'Tabbed Ghostty Terminal mounted',
        context.currentScope.repository?.path
      );
    },

    onUnmount: async (_context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log('Tabbed Ghostty Terminal unmounting');
    },
  },
];

/**
 * Optional: Called once when the entire package is loaded.
 * Use this for package-level initialization.
 */
export const onPackageLoad = async () => {
  // eslint-disable-next-line no-console
  console.log('Ghostty Terminal Panel package loaded');
};

/**
 * Optional: Called once when the package is unloaded.
 * Use this for package-level cleanup.
 */
export const onPackageUnload = async () => {
  // eslint-disable-next-line no-console
  console.log('Ghostty Terminal Panel package unloading');
};

// Re-export components for direct use
export { GhosttyTerminal } from './panels/GhosttyTerminal';
export { TabbedGhosttyTerminal } from './panels/TabbedGhosttyTerminal';
export type { TerminalTab, TabbedGhosttyTerminalProps } from './panels/TabbedGhosttyTerminal';

// Re-export types
export type {
  PanelDefinition,
  PanelContextValue,
  PanelComponentProps,
  PanelActions,
  PanelEventEmitter,
  PanelEvent,
  TerminalTab as TerminalTabType,
  TabbedGhosttyTerminalProps as TabbedTerminalProps,
} from './types';
