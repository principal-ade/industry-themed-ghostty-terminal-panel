# TODO: Align TerminalActions type with xterm-terminal-panel

The `TerminalActions` type in this package should match the `TerminalPanelActions` type defined in `@industry-theme/xterm-terminal-panel`.

## Current Issue

The ghostty terminal panel defines its own `TerminalActions` type that differs from the xterm terminal panel's `TerminalPanelActions`. This causes type mismatches when consumers try to use a shared terminal actions provider.

## Required Changes

1. Import and re-export `TerminalPanelActions` from `@industry-theme/xterm-terminal-panel`
2. Or align the local `TerminalActions` interface to match exactly

## Reference

See the type definition in:
- `/Users/griever/Developer/terminal-panels/industry-themed-xterm-terminal-panel/src/panel-types/index.ts`

Key interface:
```typescript
export interface TerminalPanelActions extends CorePanelActions {
  createTerminalSession?: (options?: CreateTerminalSessionOptions) => Promise<string>;
  destroyTerminalSession?: (sessionId: string) => Promise<void>;
  writeToTerminal?: (sessionId: string, data: string) => void;
  resizeTerminal?: (sessionId: string, cols: number, rows: number, force?: boolean) => void;
  clearTerminal?: (sessionId: string) => void;
  onTerminalPortReady?: (callback: (data: PortReadyData, port: MessagePort) => void) => () => void;
  checkTerminalOwnership?: (sessionId: string) => Promise<OwnershipStatus>;
  claimTerminalOwnership?: (sessionId: string, force?: boolean) => Promise<OwnershipResult>;
  releaseTerminalOwnership?: (sessionId: string) => Promise<OwnershipResult>;
  onOwnershipLost?: (callback: (data: { sessionId: string; newOwnerWindowId: number }) => void) => () => void;
  refreshTerminal?: (sessionId: string) => Promise<boolean>;
  requestTerminalDataPort?: (sessionId: string) => Promise<{ success: boolean; reason?: string }>;
  onTerminalData?: (sessionId: string, callback: (data: string) => void) => () => void;
  listTerminalSessions?: () => Promise<TerminalSessionInfo[]>;
}
```
