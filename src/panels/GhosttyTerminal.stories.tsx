import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect, useRef } from 'react';
import { GhosttyTerminal } from './GhosttyTerminal';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  PanelEvent,
  PanelEventType,
} from '../types';

/**
 * Create a mock event emitter that we can use to send data to the terminal
 */
const createInteractiveEvents = (): PanelEventEmitter & {
  sendOutput: (data: string) => void;
} => {
  const handlers = new Map<
    PanelEventType,
    Set<(event: PanelEvent<unknown>) => void>
  >();

  const emitter: PanelEventEmitter & { sendOutput: (data: string) => void } = {
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
    sendOutput: (data: string) => {
      emitter.emit({
        type: 'terminal:output',
        source: 'storybook',
        timestamp: Date.now(),
        payload: { payload: data },
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

/**
 * Create mock actions
 */
const createMockActions = (): PanelActions => ({
  // eslint-disable-next-line no-console
  openFile: (path) => console.log('[Mock] openFile:', path),
  // eslint-disable-next-line no-console
  openGitDiff: (path) => console.log('[Mock] openGitDiff:', path),
  // eslint-disable-next-line no-console
  navigateToPanel: (id) => console.log('[Mock] navigateToPanel:', id),
  // eslint-disable-next-line no-console
  notifyPanels: (event) => console.log('[Mock] notifyPanels:', event),
});

/**
 * Interactive wrapper that sends data to terminal after mount
 */
const InteractiveTerminalWrapper: React.FC<{
  initialOutput?: string;
  simulateTyping?: boolean;
}> = ({ initialOutput, simulateTyping = false }) => {
  const eventsRef = useRef(createInteractiveEvents());
  const context = createMockContext();
  const actions = createMockActions();

  useEffect(() => {
    const events = eventsRef.current;

    // Wait for terminal to initialize
    const timer = setTimeout(() => {
      if (initialOutput) {
        if (simulateTyping) {
          // Simulate typing character by character
          let i = 0;
          const typeInterval = setInterval(() => {
            if (i < initialOutput.length) {
              events.sendOutput(initialOutput[i]);
              i++;
            } else {
              clearInterval(typeInterval);
            }
          }, 20);
        } else {
          events.sendOutput(initialOutput);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [initialOutput, simulateTyping]);

  return (
    <GhosttyTerminal
      context={context}
      actions={actions}
      events={eventsRef.current}
    />
  );
};

const meta: Meta<typeof GhosttyTerminal> = {
  title: 'Panels/GhosttyTerminal',
  component: GhosttyTerminal,
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
type Story = StoryObj<typeof GhosttyTerminal>;

// Sample terminal output with ANSI colors
const WELCOME_OUTPUT = `\x1b[1;32m╔════════════════════════════════════════════════════════════╗\x1b[0m
\x1b[1;32m║\x1b[0m  \x1b[1;36m🌟 Welcome to Ghostty Terminal\x1b[0m                            \x1b[1;32m║\x1b[0m
\x1b[1;32m║\x1b[0m  \x1b[90mPowered by ghostty-web WebAssembly\x1b[0m                        \x1b[1;32m║\x1b[0m
\x1b[1;32m╚════════════════════════════════════════════════════════════╝\x1b[0m

\x1b[1;33muser@ghostty\x1b[0m:\x1b[1;34m~/projects\x1b[0m$ `;

const LS_OUTPUT = `\x1b[1;34mnode_modules/\x1b[0m  \x1b[1;34msrc/\x1b[0m  \x1b[1;34mdist/\x1b[0m  package.json  README.md  tsconfig.json
\x1b[1;33muser@ghostty\x1b[0m:\x1b[1;34m~/projects\x1b[0m$ `;

const HTOP_STYLE = `\x1b[1;37;44m  CPU  \x1b[0m \x1b[32m████████████████████\x1b[90m░░░░░░░░░░\x1b[0m 67.3%
\x1b[1;37;44m  MEM  \x1b[0m \x1b[33m██████████████\x1b[90m░░░░░░░░░░░░░░░░\x1b[0m 45.2%
\x1b[1;37;44m  SWP  \x1b[0m \x1b[31m████\x1b[90m░░░░░░░░░░░░░░░░░░░░░░░░░░\x1b[0m 12.1%

\x1b[1;36mPID   USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM\x1b[0m
\x1b[1;37m1234  ghostty   20   0  123456  45678  12345 S  12.3   4.5\x1b[0m
\x1b[90m5678  node      20   0   98765  34567   8901 S   8.7   3.2\x1b[0m
\x1b[90m9012  chrome    20   0  567890 123456  45678 S   5.4   9.8\x1b[0m

`;

const GIT_STATUS = `\x1b[1;33muser@ghostty\x1b[0m:\x1b[1;34m~/projects\x1b[0m$ git status
\x1b[1mOn branch \x1b[36mmain\x1b[0m
\x1b[1mYour branch is up to date with '\x1b[36morigin/main\x1b[0m\x1b[1m'.\x1b[0m

\x1b[1mChanges to be committed:\x1b[0m
  \x1b[32m(use "git restore --staged <file>..." to unstage)\x1b[0m
	\x1b[32mmodified:   src/index.tsx\x1b[0m
	\x1b[32mnew file:   src/panels/GhosttyTerminal.tsx\x1b[0m

\x1b[1mChanges not staged for commit:\x1b[0m
  \x1b[31m(use "git add <file>..." to update what will be committed)\x1b[0m
	\x1b[31mmodified:   package.json\x1b[0m

\x1b[1;33muser@ghostty\x1b[0m:\x1b[1;34m~/projects\x1b[0m$ `;

/**
 * Default terminal with welcome message
 */
export const Default: Story = {
  render: () => <InteractiveTerminalWrapper initialOutput={WELCOME_OUTPUT} />,
};

/**
 * Terminal showing ls command output
 */
export const WithLsOutput: Story = {
  render: () => (
    <InteractiveTerminalWrapper
      initialOutput={WELCOME_OUTPUT + 'ls -la\n' + LS_OUTPUT}
    />
  ),
};

/**
 * Terminal showing htop-style system monitor
 */
export const SystemMonitor: Story = {
  render: () => (
    <InteractiveTerminalWrapper initialOutput={HTOP_STYLE} />
  ),
};

/**
 * Terminal showing git status with colors
 */
export const GitStatus: Story = {
  render: () => (
    <InteractiveTerminalWrapper initialOutput={GIT_STATUS} />
  ),
};

/**
 * Terminal with simulated typing effect
 */
export const TypingEffect: Story = {
  render: () => (
    <InteractiveTerminalWrapper
      initialOutput="Hello from Ghostty Terminal! 🚀\n\nThis text is being typed character by character..."
      simulateTyping={true}
    />
  ),
};

/**
 * Terminal in a smaller container
 */
export const SmallContainer: Story = {
  render: () => <InteractiveTerminalWrapper initialOutput={WELCOME_OUTPUT} />,
  decorators: [
    (Story) => (
      <div
        style={{
          width: '600px',
          height: '400px',
          backgroundColor: '#1e1e1e',
          margin: '20px',
          border: '1px solid #333',
        }}
      >
        <Story />
      </div>
    ),
  ],
};
