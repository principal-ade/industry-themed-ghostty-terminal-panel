import { GhosttyTerminal } from './panels/GhosttyTerminal';
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
