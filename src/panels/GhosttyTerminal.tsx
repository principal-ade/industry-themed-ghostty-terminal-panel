import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal, FitAddon } from 'ghostty-web';
import type { PanelComponentProps, PanelEvent } from '../types';

// Extended actions interface for terminal-specific actions (matching industry-themed-terminal)
interface TerminalActions {
  createTerminalSession?: (options?: { cwd?: string }) => Promise<string>;
  writeToTerminal?: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal?: (sessionId: string, cols: number, rows: number) => Promise<void>;
  destroyTerminalSession?: (sessionId: string) => Promise<void>;
  // Ownership actions
  checkTerminalOwnership?: (sessionId: string) => Promise<OwnershipStatus>;
  claimTerminalOwnership?: (sessionId: string, force?: boolean) => Promise<OwnershipResult>;
  releaseTerminalOwnership?: (sessionId: string) => Promise<OwnershipResult>;
  refreshTerminal?: (sessionId: string) => Promise<boolean>;
}

interface OwnershipStatus {
  exists: boolean;
  ownedByWindowId: number | null;
  ownedByThisWindow?: boolean;
  canClaim: boolean;
  ownerWindowExists?: boolean;
}

interface OwnershipResult {
  success: boolean;
  reason?: string;
  ownedByWindowId?: number;
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
 *
 * Lifecycle:
 * - On mount: Creates a terminal session via actions.createTerminalSession()
 * - Checks ownership and claims if available, shows overlay if owned elsewhere
 * - During use: Receives terminal output via events.on('terminal:data')
 * - On ownership lost: Shows overlay with option to take control
 * - On unmount: Does NOT destroy session (maintains ownership for tab switching)
 */
export const GhosttyTerminal: React.FC<PanelComponentProps> = ({
  actions,
  events,
  context,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const hasInitializedRef = useRef(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ownership state
  const [ownershipStatus, setOwnershipStatus] = useState<{
    isOwned: boolean;
    ownedByWindowId: number | null;
    canTakeControl: boolean;
  }>({
    isOwned: false,
    ownedByWindowId: null,
    canTakeControl: true,
  });
  const [shouldRenderTerminal, setShouldRenderTerminal] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Cast actions to include terminal-specific actions
  const terminalActions = actions as typeof actions & TerminalActions;

  // Get terminal directory from context (handle extended context types)
  const terminalDirectory =
    (context as { repositoryPath?: string })?.repositoryPath ||
    context?.currentScope?.repository?.path;

  // Handle taking control of terminal
  const handleTakeControl = useCallback(async () => {
    if (!sessionId || !terminalActions.claimTerminalOwnership) return;

    try {
      console.log('[GhosttyTerminal] Taking control with force=true');
      setIsTransitioning(true);

      await terminalActions.claimTerminalOwnership(sessionId, true);
      setOwnershipStatus({
        isOwned: false,
        ownedByWindowId: null,
        canTakeControl: true,
      });
      setShouldRenderTerminal(true);

      // Note: Don't call refresh here - let the terminal UI init effect handle it
      // after the terminal is fully mounted and ready to receive data
    } catch (error) {
      console.error('[GhosttyTerminal] Failed to take control:', error);
      setIsTransitioning(false);
    }
  }, [sessionId, terminalActions]);

  // Initialize terminal session on mount (only once)
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    let mounted = true;

    const initTerminal = async () => {
      try {
        if (!terminalActions.createTerminalSession) {
          throw new Error(
            'Terminal actions not available. Host must provide createTerminalSession action.'
          );
        }

        const id = await terminalActions.createTerminalSession({
          cwd: terminalDirectory || undefined,
        });

        if (!mounted) return;
        setSessionId(id);

        // Check ownership
        if (terminalActions.checkTerminalOwnership) {
          try {
            const status = await terminalActions.checkTerminalOwnership(id);
            if (!mounted) return;

            if (status.ownedByWindowId && !status.ownedByThisWindow) {
              console.log(
                `[GhosttyTerminal] Terminal owned by window ${status.ownedByWindowId}, showing overlay`
              );
              setOwnershipStatus({
                isOwned: true,
                ownedByWindowId: status.ownedByWindowId,
                canTakeControl: status.canClaim,
              });
              setShouldRenderTerminal(false);
            } else {
              // Claim ownership
              console.log(`[GhosttyTerminal] Claiming ownership of session ${id}`);
              if (terminalActions.claimTerminalOwnership) {
                await terminalActions.claimTerminalOwnership(id);
              }
              setShouldRenderTerminal(true);
            }
          } catch (ownershipError) {
            console.error('[GhosttyTerminal] Ownership check failed:', ownershipError);
            // Proceed without ownership management
            setShouldRenderTerminal(true);
          }
        } else {
          // No ownership management available, just render
          setShouldRenderTerminal(true);
        }
      } catch (error) {
        console.error('[GhosttyTerminal] Failed to create terminal session:', error);
        if (mounted) {
          setError(error instanceof Error ? error.message : 'Failed to create terminal session');
        }
      }
    };

    initTerminal();

    return () => {
      mounted = false;
      // Note: We don't release ownership or destroy session on unmount
      // This allows the terminal to persist when switching tabs
    };
  }, [terminalDirectory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for ownership lost events
  useEffect(() => {
    if (!sessionId) return;

    const handleOwnershipLost = (event: PanelEvent<{ sessionId?: string; newOwnerWindowId?: number }>) => {
      if (event.payload?.sessionId === sessionId) {
        console.log(
          `[GhosttyTerminal] Ownership lost for session ${sessionId}, new owner: ${event.payload.newOwnerWindowId}`
        );
        setOwnershipStatus({
          isOwned: true,
          ownedByWindowId: event.payload.newOwnerWindowId || null,
          canTakeControl: true,
        });
        setShouldRenderTerminal(false);
      }
    };

    const unsubscribe = events.on('terminal:ownershipLost', handleOwnershipLost);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      } else {
        events.off('terminal:ownershipLost', handleOwnershipLost);
      }
    };
  }, [events, sessionId]);

  // Initialize Ghostty terminal UI (only when we own it)
  useEffect(() => {
    if (!terminalRef.current || !sessionId || !shouldRenderTerminal) return;

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

        // Outgoing: User types in terminal -> Send to Host via writeToTerminal
        term.onData((input: string) => {
          if (terminalActions.writeToTerminal && sessionId) {
            terminalActions.writeToTerminal(sessionId, input);
          } else {
            console.warn(
              '[GhosttyTerminal] writeToTerminal action not available. Terminal input will not be sent.'
            );
          }
        });

        // Handle terminal resize with ResizeObserver
        resizeObserverRef.current = new ResizeObserver(() => {
          if (fitAddonRef.current && terminalInstanceRef.current) {
            fitAddonRef.current.fit();
            // Notify host of new dimensions
            if (terminalActions.resizeTerminal && sessionId) {
              terminalActions.resizeTerminal(
                sessionId,
                terminalInstanceRef.current.cols,
                terminalInstanceRef.current.rows
              );
            }
          }
        });
        resizeObserverRef.current.observe(terminalRef.current!);

        // Refresh to get existing buffer contents (Ctrl+L to redraw)
        if (terminalActions.refreshTerminal) {
          setTimeout(async () => {
            try {
              await terminalActions.refreshTerminal!(sessionId);
            } catch (e) {
              console.warn('[GhosttyTerminal] Failed to refresh terminal:', e);
            }
            // Clear transitioning state after refresh completes
            setIsTransitioning(false);
          }, 300);
        } else {
          setIsTransitioning(false);
        }
      } catch (error) {
        console.error('[GhosttyTerminal] Failed to initialize Ghostty terminal:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize terminal');
        setIsTransitioning(false);
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
  }, [sessionId, shouldRenderTerminal, terminalActions]);

  // Incoming: Host sends PTY data -> Write to terminal (only when we own it)
  useEffect(() => {
    if (!sessionId || !shouldRenderTerminal) return;

    const handleData = (event: PanelEvent<{ sessionId?: string; data?: string }>) => {
      if (
        terminalInstanceRef.current &&
        event.payload?.sessionId === sessionId &&
        event.payload?.data
      ) {
        terminalInstanceRef.current.write(event.payload.data);
      }
    };

    // Handle terminal exit events
    const handleExit = (event: PanelEvent<{ sessionId?: string; exitCode?: number }>) => {
      if (event.payload?.sessionId === sessionId) {
        setError(`Terminal process exited with code ${event.payload.exitCode}`);
      }
    };

    const unsubscribeData = events.on('terminal:data', handleData);
    const unsubscribeExit = events.on('terminal:exit', handleExit);

    return () => {
      if (typeof unsubscribeData === 'function') {
        unsubscribeData();
      } else {
        events.off('terminal:data', handleData);
      }
      if (typeof unsubscribeExit === 'function') {
        unsubscribeExit();
      } else {
        events.off('terminal:exit', handleExit);
      }
    };
  }, [events, sessionId, shouldRenderTerminal]);

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

  // Determine if we should show the overlay
  const showOverlay = !shouldRenderTerminal || isTransitioning;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#1e1e1e',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Always keep terminal div in DOM so ref is available */}
      <div
        ref={terminalRef}
        className="ghostty-terminal-container"
        style={{
          width: '100%',
          height: '100%',
          visibility: showOverlay ? 'hidden' : 'visible',
        }}
      />

      {/* Overlay for ownership/transitioning states */}
      {showOverlay && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#d4d4d4',
            fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
            backgroundColor: '#1e1e1e',
          }}
        >
          {isTransitioning ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '14px', marginBottom: '8px' }}>Loading terminal...</p>
              <p style={{ fontSize: '12px', color: '#888' }}>Please wait</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '14px', marginBottom: '8px' }}>
                This terminal is active in another window
              </p>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
                {ownershipStatus.ownedByWindowId
                  ? `Window ID: ${ownershipStatus.ownedByWindowId}`
                  : 'Another window owns this terminal session'}
              </p>
              <button
                onClick={handleTakeControl}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  backgroundColor: '#0e639c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Take Control Here
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '8px 16px',
            backgroundColor: 'rgba(255, 107, 107, 0.9)',
            color: '#fff',
            fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
            fontSize: '12px',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default GhosttyTerminal;
