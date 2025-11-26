# Ghostty Terminal Panel Integration

This guide outlines how to integrate the experimental Ghostty WebAssembly (Wasm) engine into the industry-themed-panel-starter framework. This allows you to render a high-performance terminal interface within a React panel while offloading the shell processing to node-pty in the Electron main process.

## 1. Architecture Overview

Since Ghostty is a native Zig application, we cannot import it directly into a standard JavaScript bundle. We rely on the Wasm build to run the rendering engine in the browser context (Electron Renderer).

- **View Layer (Panel)**: GhosttyWeb (Wasm) handles rendering pixels and capturing input.
- **Transport Layer**: The Panel uses actions and events props to communicate via Electron IPC.
- **Logic Layer (Host)**: node-pty runs the actual shell (bash/zsh/powershell).

## 2. Implementation Steps

### Step 1: Install Dependencies

Since the official library is not yet public, use the experimental community wrapper or your own local Wasm build.

```bash
# Option A: Experimental package
npm install @coder/ghostty-web

# Option B: Local build (copy .wasm files to public/assets/)
# Ensure ghostty-vt.wasm is accessible in your public path
```

### Step 2: Create the Panel Component

Create a new file: `src/panels/GhosttyTerminal.tsx`.

This component initializes the Wasm engine and bridges the gap between the Ghostty IO and the Panel Framework's event system.

```tsx
import React, { useEffect, useRef } from 'react';
import { GhosttyWeb } from '@coder/ghostty-web'; // or local import
import type { PanelComponentProps } from '../types';

export const GhosttyTerminal: React.FC<PanelComponentProps> = ({
  context,
  actions,
  events,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<any>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const init = async () => {
      // 1. Initialize Wasm Engine
      const ghostty = await GhosttyWeb.init({
        element: terminalRef.current,
        // Ensure this path points to where you deployed the .wasm file
        wasmUrl: '/assets/ghostty-vt.wasm',
        fontSize: 14,
        fontFamily: 'JetBrains Mono, monospace',
      });

      engineRef.current = ghostty;

      // 2. Outgoing: User types in Ghostty -> Send to Host
      ghostty.onData((input: string) => {
        // Use the generic action handler to send data to Electron
        if (actions.sendTerminalData) {
            actions.sendTerminalData(input);
        } else {
            // Fallback for custom implementations
            console.warn('Action "sendTerminalData" not available on host.');
        }
      });

      // 3. Handle Resize
      const resizeObserver = new ResizeObserver(() => {
        ghostty.fit();
      });
      resizeObserver.observe(terminalRef.current);
    };

    init();

    // Cleanup
    return () => {
      // engineRef.current?.dispose();
    };
  }, [actions]);

  // 4. Incoming: Host sends PTY data -> Write to Ghostty
  useEffect(() => {
    const handleOutput = (data: any) => {
        // Ensure data is string or Uint8Array
        if (engineRef.current && data.payload) {
            engineRef.current.write(data.payload);
        }
    };

    // Listen to specific event ID defined by your host
    events.on('terminal:output', handleOutput);

    return () => {
        events.off('terminal:output', handleOutput);
    };
  }, [events]);

  return (
    <div
      ref={terminalRef}
      className="w-full h-full bg-black overflow-hidden"
    />
  );
};
```

### Step 3: Register the Panel

Update `src/index.tsx` to export your new panel configuration.

```tsx
import { GhosttyTerminal } from './panels/GhosttyTerminal';

export const panels = [
  {
    id: 'com.your-org.ghostty-term',
    name: 'Ghostty Terminal',
    icon: 'Terminal',
    description: 'Experimental Wasm-based Ghostty renderer',
    component: GhosttyTerminal,
  },
  // ... other panels
];
```

## 3. Host Side Integration (Electron Main)

The panel is just a view. The Host application (Electron Main process) must handle the actual PTY creation and IPC routing.

**In your Electron Main Process:**

```typescript
import * as pty from 'node-pty';

// 1. Setup PTY
const ptyProcess = pty.spawn('bash', [], {
  name: 'xterm-256color',
  cols: 80,
  rows: 30,
  cwd: process.env.HOME,
  env: process.env
});

// 2. Incoming from Panel (via IPC/Actions)
ipcMain.on('panel-action', (event, { action, payload }) => {
  if (action === 'sendTerminalData') {
    ptyProcess.write(payload);
  }
});

// 3. Outgoing to Panel (via IPC/Events)
ptyProcess.onData((data) => {
  mainWindow.webContents.send('panel-event', {
    event: 'terminal:output',
    payload: data
  });
});
```

## 4. Known Constraints

- **Asset Loading**: The Wasm build requires access to font files. You may need to configure your build tool (Vite/Webpack) to copy the .wasm and font assets to the final build output directory.
- **Clipboard**: Native clipboard integration might be limited in the Wasm environment; you may need to implement a bridge using `navigator.clipboard`.
- **WebGL**: Ghostty Wasm uses WebGL. Ensure hardware acceleration is enabled in your Electron window configuration (`webPreferences: { webgl: true }`).
