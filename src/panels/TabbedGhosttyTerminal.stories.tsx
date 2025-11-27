import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { TabbedGhosttyTerminal } from './TabbedGhosttyTerminal';
import { createMockContext, createMockEvents } from '../mocks/panelContext';
import type {
  TerminalActions,
  PanelEventEmitter,
  PanelEvent,
  CreateTerminalSessionOptions,
  TerminalSessionInfo,
} from '../types';

/**
 * Mock Terminal Backend Simulator for TabbedGhosttyTerminal
 *
 * Similar to TabbedTerminalPanel's mock:
 * - onTerminalData subscription (the key difference from MessagePort)
 * - listTerminalSessions for session restoration
 * - Session context tracking
 */
class MockTabbedTerminalBackend {
  private sessions = new Map<string, { cwd: string; shell: string; context?: string }>();
  private sessionCounter = 0;
  private eventEmitter: PanelEventEmitter | null = null;
  private dataSubscribers = new Map<string, Set<(data: string) => void>>();

  setEventEmitter(emitter: PanelEventEmitter) {
    this.eventEmitter = emitter;
  }

  createSession(options?: CreateTerminalSessionOptions): string {
    const sessionId = `mock-session-${++this.sessionCounter}`;
    const cwd = options?.cwd || '/Users/developer/my-project';
    const shell = 'zsh';
    const context = options?.context;

    this.sessions.set(sessionId, { cwd, shell, context });

    // Emit session created event
    this.emitEvent({
      type: 'terminal:created',
      source: 'mock-backend',
      timestamp: Date.now(),
      payload: {
        sessionId,
        info: {
          id: sessionId,
          pid: Math.floor(Math.random() * 10000),
          cwd,
          shell,
          createdAt: Date.now(),
          lastActivity: Date.now(),
          context,
        },
      },
    });

    // Send welcome message after a short delay
    setTimeout(() => {
      this.sendData(sessionId, `\x1b[1;32m➜\x1b[0m  \x1b[1;36m${cwd.split('/').pop()}\x1b[0m \x1b[1;34mgit:(\x1b[1;31mmain\x1b[1;34m)\x1b[0m $ `);
    }, 100);

    // Execute initial command if provided
    if (options?.command) {
      setTimeout(() => {
        this.handleCommand(sessionId, options.command!);
      }, 200);
    }

    return sessionId;
  }

  destroySession(sessionId: string) {
    this.sessions.delete(sessionId);
    this.dataSubscribers.delete(sessionId);
    this.emitEvent({
      type: 'terminal:exit',
      source: 'mock-backend',
      timestamp: Date.now(),
      payload: { sessionId, exitCode: 0 },
    });
  }

  writeToTerminal(sessionId: string, data: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Echo the input character
    this.sendData(sessionId, data);

    // Check for Enter key (carriage return)
    if (data === '\r') {
      this.sendData(sessionId, '\n');
      this.handleCommand(sessionId, '');
    }
  }

  // Subscribe to data for a specific session (used by TabbedGhosttyTerminal)
  onDataForSession(sessionId: string, callback: (data: string) => void): () => void {
    if (!this.dataSubscribers.has(sessionId)) {
      this.dataSubscribers.set(sessionId, new Set());
    }
    this.dataSubscribers.get(sessionId)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.dataSubscribers.get(sessionId)?.delete(callback);
    };
  }

  // List all sessions (for session restoration)
  listSessions(): TerminalSessionInfo[] {
    const sessions: TerminalSessionInfo[] = [];
    this.sessions.forEach((session, id) => {
      sessions.push({
        id,
        pid: Math.floor(Math.random() * 10000),
        cwd: session.cwd,
        shell: session.shell,
        createdAt: Date.now() - 60000,
        lastActivity: Date.now(),
        context: session.context,
      });
    });
    return sessions;
  }

  private handleCommand(sessionId: string, command: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const cmd = command.trim();

    setTimeout(() => {
      if (cmd === 'ls') {
        this.sendData(
          sessionId,
          '\x1b[1;34msrc\x1b[0m      \x1b[1;34mdist\x1b[0m     package.json  README.md     tsconfig.json\n'
        );
      } else if (cmd === 'pwd') {
        this.sendData(sessionId, `${session.cwd}\n`);
      } else if (cmd.startsWith('echo ')) {
        const message = cmd.substring(5);
        this.sendData(sessionId, `${message}\n`);
      } else if (cmd === 'git status') {
        this.sendData(sessionId, '\x1b[1;32mOn branch main\x1b[0m\n');
        this.sendData(sessionId, "Your branch is up to date with 'origin/main'.\n\n");
      } else if (cmd === 'clear') {
        this.sendData(sessionId, '\x1b[2J\x1b[H');
      } else if (cmd === 'help') {
        this.sendData(sessionId, 'Available mock commands: ls, pwd, echo, git status, clear, help\n');
      } else if (cmd) {
        this.sendData(sessionId, `\x1b[31mzsh: command not found: ${cmd}\x1b[0m\n`);
      }

      // Show prompt again
      this.sendData(
        sessionId,
        `\x1b[1;32m➜\x1b[0m  \x1b[1;36m${session.cwd.split('/').pop()}\x1b[0m \x1b[1;34mgit:(\x1b[1;31mmain\x1b[1;34m)\x1b[0m $ `
      );
    }, 50);
  }

  private sendData(sessionId: string, data: string) {
    // Send to direct subscribers (TabbedGhosttyTerminal uses this)
    const subscribers = this.dataSubscribers.get(sessionId);
    if (subscribers) {
      subscribers.forEach(callback => callback(data));
    }

    // Also emit event (for compatibility)
    this.emitEvent({
      type: 'terminal:data',
      source: 'mock-backend',
      timestamp: Date.now(),
      payload: { sessionId, data },
    });
  }

  private emitEvent(event: PanelEvent) {
    if (this.eventEmitter) {
      this.eventEmitter.emit(event);
    }
  }
}

// Global backend instance for stories
const mockBackend = new MockTabbedTerminalBackend();

/**
 * Create mock actions with tabbed terminal backend
 */
const createTabbedTerminalMockActions = (): TerminalActions => ({
  createTerminalSession: async (options?: CreateTerminalSessionOptions) => {
    console.log('[Mock] Creating terminal session:', options);
    return mockBackend.createSession(options);
  },
  destroyTerminalSession: async (sessionId: string) => {
    console.log('[Mock] Destroying terminal session:', sessionId);
    mockBackend.destroySession(sessionId);
  },
  writeToTerminal: async (sessionId: string, data: string) => {
    mockBackend.writeToTerminal(sessionId, data);
  },
  resizeTerminal: async (sessionId: string, cols: number, rows: number) => {
    console.log('[Mock] Resizing terminal:', sessionId, cols, rows);
  },
  // Key action for TabbedGhosttyTerminal - subscribe to session data
  onTerminalData: (sessionId: string, callback: (data: string) => void) => {
    console.log('[Mock] Subscribing to terminal data for session:', sessionId);
    return mockBackend.onDataForSession(sessionId, callback);
  },
  // List sessions for restoration
  listTerminalSessions: async () => {
    console.log('[Mock] Listing terminal sessions');
    return mockBackend.listSessions();
  },
  // Ownership actions (mock)
  claimTerminalOwnership: async (sessionId: string) => {
    console.log('[Mock] Claiming terminal ownership:', sessionId);
    return { success: true };
  },
  refreshTerminal: async (sessionId: string) => {
    console.log('[Mock] Refreshing terminal:', sessionId);
    return true;
  },
});

const meta: Meta<typeof TabbedGhosttyTerminal> = {
  title: 'Panels/TabbedGhosttyTerminal',
  component: TabbedGhosttyTerminal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A tabbed terminal panel using the Ghostty WebAssembly engine.\n\n' +
          '**Key Features:**\n' +
          '- Multiple terminal tabs with create/close functionality\n' +
          '- Session restoration from existing terminals filtered by context\n' +
          '- Keyboard shortcuts (Cmd+T, Cmd+W, Cmd+1-9)\n\n' +
          '**Required Props:**\n' +
          '- `terminalContext`: Identifier for filtering/grouping sessions\n' +
          '- `directory`: Default directory for new terminal sessions\n\n' +
          '**Required Actions from Host:**\n' +
          '- `onTerminalData(sessionId, callback)`: Subscribe to session data\n' +
          '- `listTerminalSessions()`: List existing sessions for restoration',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TabbedGhosttyTerminal>;

/**
 * Story wrapper that sets up mock context, actions, and events
 */
const StoryWrapper: React.FC<{
  children: (props: { context: ReturnType<typeof createMockContext>; actions: TerminalActions; events: PanelEventEmitter }) => React.ReactNode;
  actionsOverrides?: Partial<TerminalActions>;
}> = ({ children, actionsOverrides }) => {
  const context = createMockContext({
    currentScope: {
      type: 'repository' as const,
      repository: {
        name: 'my-project',
        path: '/Users/developer/my-project',
      },
    },
  });
  const events = createMockEvents();
  const actions = { ...createTabbedTerminalMockActions(), ...actionsOverrides };

  mockBackend.setEventEmitter(events);

  return <>{children({ context, actions, events })}</>;
};

/**
 * Default tabbed terminal panel
 *
 * Features:
 * - Click the + button or press Cmd+T to add new tabs
 * - Hover over a tab and click X to close it (or press Cmd+W)
 * - Press Cmd+1-9 to switch between tabs
 * - Try typing commands like: ls, pwd, echo hello, git status, help
 */
export const Default: Story = {
  render: () => (
    <ThemeProvider>
      <div style={{ height: '600px', width: '100%' }}>
        <StoryWrapper>
          {({ context, actions, events }) => (
            <TabbedGhosttyTerminal
              context={context}
              actions={actions}
              events={events}
              terminalContext="terminal:my-project"
              directory="/Users/developer/my-project"
            />
          )}
        </StoryWrapper>
      </div>
    </ThemeProvider>
  ),
};

/**
 * With initial tabs
 *
 * Demonstrates pre-configured tabs on load.
 */
export const WithInitialTabs: Story = {
  render: () => (
    <ThemeProvider>
      <div style={{ height: '600px', width: '100%' }}>
        <StoryWrapper>
          {({ context, actions, events }) => (
            <TabbedGhosttyTerminal
              context={context}
              actions={actions}
              events={events}
              terminalContext="terminal:my-project"
              directory="/Users/developer/my-project"
              initialTabs={[
                {
                  id: 'tab-1',
                  label: 'my-project',
                  directory: '/Users/developer/my-project',
                  isActive: true,
                },
                {
                  id: 'tab-2',
                  label: 'docs',
                  directory: '/Users/developer/my-project/docs',
                  isActive: false,
                },
              ]}
            />
          )}
        </StoryWrapper>
      </div>
    </ThemeProvider>
  ),
};

/**
 * Hidden header (tabs only)
 *
 * Shows how the panel looks with the header hidden.
 */
export const HiddenHeader: Story = {
  render: () => (
    <ThemeProvider>
      <div style={{ height: '600px', width: '100%' }}>
        <StoryWrapper>
          {({ context, actions, events }) => (
            <TabbedGhosttyTerminal
              context={context}
              actions={actions}
              events={events}
              terminalContext="terminal:my-project"
              directory="/Users/developer/my-project"
              hideHeader={true}
              initialTabs={[
                {
                  id: 'tab-1',
                  label: 'my-project',
                  directory: '/Users/developer/my-project',
                  isActive: true,
                },
              ]}
            />
          )}
        </StoryWrapper>
      </div>
    </ThemeProvider>
  ),
};

/**
 * Empty state
 *
 * Shows the empty state when no tabs exist.
 */
export const EmptyState: Story = {
  render: () => (
    <ThemeProvider>
      <div style={{ height: '600px', width: '100%' }}>
        <StoryWrapper actionsOverrides={{ listTerminalSessions: async () => [] }}>
          {({ context, actions, events }) => (
            <TabbedGhosttyTerminal
              context={context}
              actions={actions}
              events={events}
              terminalContext="terminal:my-project"
              directory="/Users/developer/my-project"
              initialTabs={[]}
            />
          )}
        </StoryWrapper>
      </div>
    </ThemeProvider>
  ),
};

/**
 * Error: No onTerminalData action
 *
 * Demonstrates error when host doesn't provide the required onTerminalData action.
 */
export const ErrorNoDataAction: Story = {
  render: () => (
    <ThemeProvider>
      <div style={{ height: '600px', width: '100%' }}>
        <StoryWrapper actionsOverrides={{ onTerminalData: undefined }}>
          {({ context, actions, events }) => (
            <TabbedGhosttyTerminal
              context={context}
              actions={actions}
              events={events}
              terminalContext="terminal:my-project"
              directory="/Users/developer/my-project"
              initialTabs={[
                {
                  id: 'tab-1',
                  label: 'my-project',
                  directory: '/Users/developer/my-project',
                  isActive: true,
                },
              ]}
            />
          )}
        </StoryWrapper>
      </div>
    </ThemeProvider>
  ),
};
