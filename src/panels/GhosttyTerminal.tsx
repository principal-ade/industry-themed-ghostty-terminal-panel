import React, { useEffect, useRef } from 'react';
import { Terminal, FitAddon } from 'ghostty-web';
import type { PanelComponentProps, PanelEvent } from '../types';

// Extended actions interface for terminal-specific actions
interface TerminalActions {
  sendTerminalData?: (data: string) => void;
  terminalReady?: () => void;
}

/**
 * GhosttyTerminal Panel
 *
 * A high-performance terminal panel using the Ghostty WebAssembly engine.
 * This component renders the terminal UI and bridges Ghostty's I/O with
 * the panel framework's event system.
 *
 * Architecture:
 * - View Layer: ghostty-web (Wasm) handles rendering and input capture
 * - Transport Layer: Panel actions/events communicate via Electron IPC
 * - Logic Layer: node-pty in Electron main process runs the actual shell
 */
export const GhosttyTerminal: React.FC<PanelComponentProps> = ({
  actions,
  events,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Cast actions to include terminal-specific actions
  const terminalActions = actions as typeof actions & TerminalActions;

  // Initialize Ghostty terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const init = async () => {
      try {
        // Create terminal instance with xterm.js-compatible API
        const term = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#d4d4d4',
          },
        });

        // Create and load FitAddon for responsive sizing
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        // Open terminal in container
        await term.open(terminalRef.current!);
        fitAddon.fit();

        terminalInstanceRef.current = term;
        fitAddonRef.current = fitAddon;

        // Outgoing: User types in terminal -> Send to Host
        term.onData((input: string) => {
          if (terminalActions.sendTerminalData) {
            terminalActions.sendTerminalData(input);
          } else {
            console.warn(
              'Action "sendTerminalData" not available on host. Terminal input will not be sent.'
            );
          }
        });

        // Handle terminal resize with ResizeObserver
        resizeObserverRef.current = new ResizeObserver(() => {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit();
          }
        });
        resizeObserverRef.current.observe(terminalRef.current!);

        // Notify host that terminal is ready
        if (terminalActions.terminalReady) {
          terminalActions.terminalReady();
        }
      } catch (error) {
        console.error('Failed to initialize Ghostty terminal:', error);
        // Display error message in terminal container
        if (terminalRef.current) {
          terminalRef.current.innerHTML = `
            <div style="color: #ff6b6b; padding: 16px; font-family: monospace;">
              <p>Failed to initialize Ghostty terminal.</p>
              <p style="color: #888; font-size: 12px; margin-top: 8px;">
                ${error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          `;
        }
      }
    };

    init();

    // Cleanup
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.dispose();
        terminalInstanceRef.current = null;
      }
      fitAddonRef.current = null;
    };
  }, [terminalActions]);

  // Incoming: Host sends PTY data -> Write to terminal
  useEffect(() => {
    const handleOutput = (event: PanelEvent<{ payload?: string | Uint8Array }>) => {
      if (terminalInstanceRef.current && event.payload?.payload) {
        terminalInstanceRef.current.write(event.payload.payload);
      }
    };

    events.on('terminal:output', handleOutput);

    return () => {
      events.off('terminal:output', handleOutput);
    };
  }, [events]);

  // Handle terminal clear command
  useEffect(() => {
    const handleClear = () => {
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.clear();
      }
    };

    events.on('terminal:clear', handleClear);

    return () => {
      events.off('terminal:clear', handleClear);
    };
  }, [events]);

  // Handle terminal resize from host
  useEffect(() => {
    const handleResize = (event: PanelEvent<{ cols?: number; rows?: number }>) => {
      if (terminalInstanceRef.current && event.payload?.cols && event.payload?.rows) {
        terminalInstanceRef.current.resize(event.payload.cols, event.payload.rows);
      }
    };

    events.on('terminal:resize', handleResize);

    return () => {
      events.off('terminal:resize', handleResize);
    };
  }, [events]);

  return (
    <div
      ref={terminalRef}
      className="ghostty-terminal-container"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#1e1e1e',
        overflow: 'hidden',
      }}
    />
  );
};

export default GhosttyTerminal;
