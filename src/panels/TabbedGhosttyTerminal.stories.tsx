import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect, useRef, useState } from 'react';
import { TabbedGhosttyTerminal, type TerminalTab } from './TabbedGhosttyTerminal';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  PanelEvent,
  PanelEventType,
} from '../types';

/**
 * Create a mock event emitter with terminal data sending capability
 */
const createInteractiveEvents = (): PanelEventEmitter & {
  sendOutput: (sessionId: string, data: string) => void;
  sendExit: (sessionId: string, exitCode: number) => void;
} => {
  const handlers = new Map<
    PanelEventType,
    Set<(event: PanelEvent<unknown>) => void>
  >();

  const emitter: PanelEventEmitter & {
    sendOutput: (sessionId: string, data: string) => void;
    sendExit: (sessionId: string, exitCode: number) => void;
  } = {
    emit: (event) => {
      const eventHandlers = handlers.get(event.type);
      if (eventHandlers) {
        eventHandlers.forEach((handler) => handler(event));
      }
    },
    on: (type, handler) => {
      if (!handlers.has(type)) {
        handlers.set(type, new Set());
      }
      handlers.get(type)!.add(handler as (event: PanelEvent<unknown>) => void);
      return () => {
        handlers.get(type)?.delete(handler as (event: PanelEvent<unknown>) => void);
      };
    },
    off: (type, handler) => {
      handlers.get(type)?.delete(handler as (event: PanelEvent<unknown>) => void);
    },
    sendOutput: (sessionId: string, data: string) => {
      emitter.emit({
        type: 'terminal:data',
        source: 'storybook',
        timestamp: Date.now(),
        payload: { sessionId, data },
      });
    },
    sendExit: (sessionId: string, exitCode: number) => {
      emitter.emit({
        type: 'terminal:exit',
        source: 'storybook',
        timestamp: Date.now(),
        payload: { sessionId, exitCode },
      });
    },
  };

  return emitter;
};

/**
 * Create mock context
 */
const createMockContext = (): PanelContextValue => ({
  currentScope: {
    type: 'repository',
    workspace: { name: 'demo-workspace', path: '/demo' },
    repository: { name: 'demo-repo', path: '/demo/repo' },
  },
  slices: new Map(),
  getSlice: () => undefined,
  getWorkspaceSlice: () => undefined,
  getRepositorySlice: () => undefined,
  hasSlice: () => false,
  isSliceLoading: () => false,
  refresh: async () => {},
});

// Sample terminal outputs
const WELCOME_OUTPUT = `\x1b[1;32m╔════════════════════════════════════════════════════════════╗\x1b[0m
\x1b[1;32m║\x1b[0m  \x1b[1;36m🌟 Welcome to Ghostty Terminal\x1b[0m                            \x1b[1;32m║\x1b[0m
\x1b[1;32m║\x1b[0m  \x1b[90mPowered by ghostty-web WebAssembly\x1b[0m                        \x1b[1;32m║\x1b[0m
\x1b[1;32m╚════════════════════════════════════════════════════════════╝\x1b[0m

\x1b[1;33muser@ghostty\x1b[0m:\x1b[1;34m~/projects\x1b[0m$ `;

const GIT_STATUS = `\x1b[1mOn branch \x1b[36mmain\x1b[0m
\x1b[1mYour branch is up to date with '\x1b[36morigin/main\x1b[0m\x1b[1m'.\x1b[0m

\x1b[1mChanges to be committed:\x1b[0m
  \x1b[32m(use "git restore --staged <file>..." to unstage)\x1b[0m
	\x1b[32mmodified:   src/index.tsx\x1b[0m
	\x1b[32mnew file:   src/panels/TabbedGhosttyTerminal.tsx\x1b[0m

\x1b[1;33muser@ghostty\x1b[0m:\x1b[1;34m~/projects\x1b[0m$ `;

/**
 * Interactive wrapper component for stories
 */
const InteractiveTabbedTerminalWrapper: React.FC<{
  initialOutput?: string;
  showTabControls?: boolean;
}> = ({ initialOutput, showTabControls = false }) => {
  const eventsRef = useRef(createInteractiveEvents());
  const sessionCounterRef = useRef(0);
  const sessionsRef = useRef<Map<string, { cwd: string }>>(new Map());
  const [tabState, setTabState] = useState<TerminalTab[]>([]);

  const context = createMockContext();

  // Create mock actions with terminal support
  const actions: PanelActions & {
    createTerminalSession: (options?: { cwd?: string }) => Promise<string>;
    writeToTerminal: (sessionId: string, data: string) => Promise<void>;
    resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
    destroyTerminalSession: (sessionId: string) => Promise<void>;
    claimTerminalOwnership: (sessionId: string, force?: boolean) => Promise<{ success: boolean }>;
    refreshTerminal: (sessionId: string) => Promise<boolean>;
  } = {
    openFile: (path) => console.log('[Mock] openFile:', path),
    openGitDiff: (path) => console.log('[Mock] openGitDiff:', path),
    navigateToPanel: (id) => console.log('[Mock] navigateToPanel:', id),
    notifyPanels: (event) => console.log('[Mock] notifyPanels:', event),
    createTerminalSession: async (options) => {
      const id = `mock-session-${++sessionCounterRef.current}`;
      const cwd = options?.cwd || '/demo/repo';
      sessionsRef.current.set(id, { cwd });
      console.log('[Mock] Creating terminal session:', id, options);

      // Send welcome message after a delay
      setTimeout(() => {
        eventsRef.current.sendOutput(id, initialOutput || WELCOME_OUTPUT);
      }, 300);

      return id;
    },
    writeToTerminal: async (sessionId, data) => {
      console.log('[Mock] writeToTerminal:', sessionId, JSON.stringify(data));
      // Echo input back
      eventsRef.current.sendOutput(sessionId, data);

      // Handle Enter key
      if (data === '\r') {
        eventsRef.current.sendOutput(sessionId, '\n');
        // Simulate command response
        setTimeout(() => {
          eventsRef.current.sendOutput(sessionId, `\x1b[1;33muser@ghostty\x1b[0m:\x1b[1;34m~/projects\x1b[0m$ `);
        }, 100);
      }
    },
    resizeTerminal: async (sessionId, cols, rows) => {
      console.log('[Mock] resizeTerminal:', sessionId, cols, 'x', rows);
    },
    destroyTerminalSession: async (sessionId) => {
      console.log('[Mock] destroyTerminalSession:', sessionId);
      sessionsRef.current.delete(sessionId);
    },
    claimTerminalOwnership: async (sessionId) => {
      console.log('[Mock] claimTerminalOwnership:', sessionId);
      return { success: true };
    },
    refreshTerminal: async (sessionId) => {
      console.log('[Mock] refreshTerminal:', sessionId);
      return true;
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {showTabControls && (
        <div
          style={{
            padding: '10px',
            backgroundColor: '#2a2a2a',
            borderBottom: '1px solid #3c3c3c',
            fontSize: '12px',
            color: '#888',
          }}
        >
          <div style={{ marginBottom: '8px' }}>
            <strong style={{ color: '#d4d4d4' }}>Keyboard Shortcuts:</strong>
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <span><kbd style={kbdStyle}>⌘T</kbd> New Tab</span>
            <span><kbd style={kbdStyle}>⌘W</kbd> Close Tab</span>
            <span><kbd style={kbdStyle}>⌘1-9</kbd> Switch Tabs</span>
          </div>
          {tabState.length > 0 && (
            <div style={{ marginTop: '10px', color: '#666' }}>
              Active tabs: {tabState.length} | Active: {tabState.find(t => t.isActive)?.label || 'none'}
            </div>
          )}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <TabbedGhosttyTerminal
          context={context}
          actions={actions}
          events={eventsRef.current}
          onTabsChange={setTabState}
        />
      </div>
    </div>
  );
};

const kbdStyle: React.CSSProperties = {
  backgroundColor: '#3c3c3c',
  padding: '2px 6px',
  borderRadius: '3px',
  border: '1px solid #555',
  fontFamily: 'monospace',
  fontSize: '11px',
};

const meta: Meta<typeof TabbedGhosttyTerminal> = {
  title: 'Panels/TabbedGhosttyTerminal',
  component: TabbedGhosttyTerminal,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100vw', height: '100vh', backgroundColor: '#1e1e1e' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TabbedGhosttyTerminal>;

/**
 * Default tabbed terminal with one tab
 */
export const Default: Story = {
  render: () => <InteractiveTabbedTerminalWrapper />,
};

/**
 * Tabbed terminal with keyboard shortcut hints
 */
export const WithKeyboardHints: Story = {
  render: () => <InteractiveTabbedTerminalWrapper showTabControls />,
};

/**
 * Terminal showing git status output
 */
export const WithGitStatus: Story = {
  render: () => (
    <InteractiveTabbedTerminalWrapper initialOutput={GIT_STATUS} showTabControls />
  ),
};

/**
 * Multiple tabs demo - start with one, use ⌘T to add more
 */
export const MultipleTabsDemo: Story = {
  render: () => {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '16px',
            backgroundColor: '#1f2937',
            borderBottom: '1px solid #374151',
            color: '#e5e7eb',
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
            🎯 Multi-Tab Terminal Demo
          </h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#9ca3af' }}>
            Try the keyboard shortcuts to manage tabs:
          </p>
          <div style={{ display: 'flex', gap: '24px', fontSize: '12px' }}>
            <div>
              <kbd style={kbdStyle}>⌘T</kbd>
              <span style={{ marginLeft: '8px' }}>Create new tab</span>
            </div>
            <div>
              <kbd style={kbdStyle}>⌘W</kbd>
              <span style={{ marginLeft: '8px' }}>Close current tab</span>
            </div>
            <div>
              <kbd style={kbdStyle}>⌘1</kbd> - <kbd style={kbdStyle}>⌘9</kbd>
              <span style={{ marginLeft: '8px' }}>Switch to tab 1-9</span>
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <InteractiveTabbedTerminalWrapper />
        </div>
      </div>
    );
  },
};

/**
 * Compact size container
 */
export const CompactSize: Story = {
  render: () => <InteractiveTabbedTerminalWrapper showTabControls />,
  decorators: [
    (Story) => (
      <div
        style={{
          width: '700px',
          height: '500px',
          backgroundColor: '#1e1e1e',
          margin: '20px',
          border: '1px solid #333',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

/**
 * With initial tabs pre-configured
 */
export const WithInitialTabs: Story = {
  render: () => {
    const eventsRef = useRef(createInteractiveEvents());
    const sessionCounterRef = useRef(0);
    const context = createMockContext();

    const initialTabs: TerminalTab[] = [
      { id: 'tab-1', label: 'frontend', directory: '/demo/frontend', isActive: true },
      { id: 'tab-2', label: 'backend', directory: '/demo/backend', isActive: false },
      { id: 'tab-3', label: 'scripts', directory: '/demo/scripts', isActive: false },
    ];

    const actions: PanelActions & {
      createTerminalSession: (options?: { cwd?: string }) => Promise<string>;
      writeToTerminal: (sessionId: string, data: string) => Promise<void>;
      resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
      destroyTerminalSession: (sessionId: string) => Promise<void>;
      claimTerminalOwnership: (sessionId: string, force?: boolean) => Promise<{ success: boolean }>;
      refreshTerminal: (sessionId: string) => Promise<boolean>;
    } = {
      openFile: () => {},
      openGitDiff: () => {},
      navigateToPanel: () => {},
      notifyPanels: () => {},
      createTerminalSession: async (options) => {
        const id = `mock-session-${++sessionCounterRef.current}`;
        const dir = options?.cwd?.split('/').pop() || 'terminal';
        setTimeout(() => {
          eventsRef.current.sendOutput(
            id,
            `\x1b[1;33muser@ghostty\x1b[0m:\x1b[1;34m~/${dir}\x1b[0m$ `
          );
        }, 300);
        return id;
      },
      writeToTerminal: async (sessionId, data) => {
        eventsRef.current.sendOutput(sessionId, data);
        if (data === '\r') {
          eventsRef.current.sendOutput(sessionId, '\n');
          setTimeout(() => {
            eventsRef.current.sendOutput(sessionId, `\x1b[1;33muser@ghostty\x1b[0m:\x1b[1;34m~/projects\x1b[0m$ `);
          }, 100);
        }
      },
      resizeTerminal: async () => {},
      destroyTerminalSession: async () => {},
      claimTerminalOwnership: async () => ({ success: true }),
      refreshTerminal: async () => true,
    };

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '12px',
            backgroundColor: '#2a2a2a',
            borderBottom: '1px solid #3c3c3c',
            fontSize: '12px',
            color: '#888',
          }}
        >
          <strong style={{ color: '#d4d4d4' }}>Pre-configured with 3 tabs:</strong>
          <span style={{ marginLeft: '12px' }}>frontend, backend, scripts</span>
        </div>
        <div style={{ flex: 1 }}>
          <TabbedGhosttyTerminal
            context={context}
            actions={actions}
            events={eventsRef.current}
            initialTabs={initialTabs}
          />
        </div>
      </div>
    );
  },
};
