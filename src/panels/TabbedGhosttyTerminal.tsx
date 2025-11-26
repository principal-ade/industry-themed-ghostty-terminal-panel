import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal, FitAddon } from 'ghostty-web';
import { Plus, X } from 'lucide-react';
import type { PanelComponentProps, PanelEvent } from '../types';

// Extended actions interface for terminal-specific actions
interface TerminalActions {
  createTerminalSession?: (options?: { cwd?: string }) => Promise<string>;
  writeToTerminal?: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal?: (sessionId: string, cols: number, rows: number) => Promise<void>;
  destroyTerminalSession?: (sessionId: string) => Promise<void>;
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
 * Terminal tab representation
 */
export interface TerminalTab {
  id: string;
  label: string;
  directory?: string;
  isActive: boolean;
}

/**
 * Props for TabbedGhosttyTerminal
 */
export interface TabbedGhosttyTerminalProps extends PanelComponentProps {
  initialTabs?: TerminalTab[];
  onTabsChange?: (tabs: TerminalTab[]) => void;
}

/**
 * Individual Terminal Tab Content
 * Renders a single Ghostty terminal instance for a tab
 */
const TerminalTabContent = React.memo<{
  tabId: string;
  isActive: boolean;
  sessionId: string | null;
  terminalActions: TerminalActions;
  events: PanelComponentProps['events'];
  onSessionCreated: (tabId: string, sessionId: string) => void;
  directory?: string;
}>(({
  tabId,
  isActive,
  sessionId,
  terminalActions,
  events,
  onSessionCreated,
  directory,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const hasInitializedRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(!sessionId);

  // Create terminal session on mount if not already created
  useEffect(() => {
    if (sessionId || hasInitializedRef.current) {
      setIsInitializing(false);
      return;
    }
    hasInitializedRef.current = true;

    const initSession = async () => {
      try {
        if (!terminalActions.createTerminalSession) {
          throw new Error('Terminal actions not available');
        }

        const id = await terminalActions.createTerminalSession({
          cwd: directory || undefined,
        });

        // Claim ownership
        if (terminalActions.claimTerminalOwnership) {
          await terminalActions.claimTerminalOwnership(id);
        }

        onSessionCreated(tabId, id);
        setIsInitializing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setIsInitializing(false);
      }
    };

    initSession();
  }, [tabId, directory, sessionId, terminalActions, onSessionCreated]);

  // Initialize Ghostty terminal UI when we have a session and are active
  useEffect(() => {
    if (!terminalRef.current || !sessionId || !isActive) return;
    if (terminalInstanceRef.current) return; // Already initialized

    const init = async () => {
      try {
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

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        await term.open(terminalRef.current!);
        fitAddon.fit();

        terminalInstanceRef.current = term;
        fitAddonRef.current = fitAddon;

        // Handle user input
        term.onData((input: string) => {
          if (terminalActions.writeToTerminal && sessionId) {
            terminalActions.writeToTerminal(sessionId, input);
          }
        });

        // Handle resize
        resizeObserverRef.current = new ResizeObserver(() => {
          if (fitAddonRef.current && terminalInstanceRef.current) {
            fitAddonRef.current.fit();
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

        // Refresh to get existing buffer
        if (terminalActions.refreshTerminal) {
          setTimeout(async () => {
            try {
              await terminalActions.refreshTerminal!(sessionId);
            } catch (e) {
              console.warn('[TabbedGhosttyTerminal] Failed to refresh:', e);
            }
          }, 300);
        }
      } catch (err) {
        console.error('[TabbedGhosttyTerminal] Failed to initialize:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize terminal');
      }
    };

    init();

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
  }, [sessionId, isActive, terminalActions]);

  // Subscribe to terminal data events
  useEffect(() => {
    if (!sessionId) return;

    const handleData = (event: PanelEvent<{ sessionId?: string; data?: string }>) => {
      if (
        terminalInstanceRef.current &&
        event.payload?.sessionId === sessionId &&
        event.payload?.data
      ) {
        terminalInstanceRef.current.write(event.payload.data);
      }
    };

    const handleExit = (event: PanelEvent<{ sessionId?: string; exitCode?: number }>) => {
      if (event.payload?.sessionId === sessionId) {
        setError(`Terminal exited with code ${event.payload.exitCode}`);
      }
    };

    const unsubscribeData = events.on('terminal:data', handleData);
    const unsubscribeExit = events.on('terminal:exit', handleExit);

    return () => {
      if (typeof unsubscribeData === 'function') unsubscribeData();
      else events.off('terminal:data', handleData);
      if (typeof unsubscribeExit === 'function') unsubscribeExit();
      else events.off('terminal:exit', handleExit);
    };
  }, [events, sessionId]);

  // Focus terminal when tab becomes active
  useEffect(() => {
    if (isActive && terminalInstanceRef.current) {
      terminalInstanceRef.current.focus();
      // Refit on activation
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    }
  }, [isActive]);

  if (error) {
    return (
      <div
        style={{
          padding: '20px',
          color: '#ef4444',
          backgroundColor: '#1e1e1e',
          height: '100%',
          display: isActive ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Terminal Error</div>
        <div style={{ fontSize: '14px', opacity: 0.8 }}>{error}</div>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div
        style={{
          padding: '20px',
          color: '#a0a0a0',
          backgroundColor: '#1e1e1e',
          height: '100%',
          display: isActive ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Initializing terminal...
      </div>
    );
  }

  return (
    <div
      ref={terminalRef}
      style={{
        width: '100%',
        height: '100%',
        display: isActive ? 'block' : 'none',
        backgroundColor: '#1e1e1e',
      }}
    />
  );
});

TerminalTabContent.displayName = 'TerminalTabContent';

/**
 * TabbedGhosttyTerminal Panel
 *
 * A multi-tab terminal panel using the Ghostty WebAssembly engine.
 * Supports keyboard shortcuts for tab management:
 * - Cmd/Ctrl + T: New tab
 * - Cmd/Ctrl + W: Close current tab
 * - Cmd/Ctrl + 1-9: Switch to tab 1-9 (9 = last tab)
 */
export const TabbedGhosttyTerminal: React.FC<TabbedGhosttyTerminalProps> = ({
  actions,
  events,
  context,
  initialTabs,
  onTabsChange,
}) => {
  // Get terminal directory from context
  const terminalDirectory =
    (context as { repositoryPath?: string })?.repositoryPath ||
    context?.currentScope?.repository?.path;

  // Tab state
  const [tabs, setTabs] = useState<TerminalTab[]>(() => {
    if (initialTabs && initialTabs.length > 0) {
      return initialTabs;
    }
    return [{
      id: `tab-${Date.now()}`,
      label: terminalDirectory?.split('/').pop() || 'Terminal',
      directory: terminalDirectory || undefined,
      isActive: true,
    }];
  });

  const [activeTabId, setActiveTabId] = useState<string>(
    tabs.find(t => t.isActive)?.id || tabs[0]?.id
  );

  // Session tracking: Map<tabId, sessionId>
  const [sessionIds, setSessionIds] = useState<Map<string, string>>(new Map());

  // Refs for stable callbacks
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const isCreatingTabRef = useRef(false);

  const terminalActions = actions as typeof actions & TerminalActions;

  // Keep refs in sync
  useEffect(() => {
    tabsRef.current = tabs;
    activeTabIdRef.current = activeTabId;
  }, [tabs, activeTabId]);

  // Notify parent of tab changes
  useEffect(() => {
    onTabsChange?.(tabs);
  }, [tabs, onTabsChange]);

  // Add new tab
  const addNewTab = useCallback(() => {
    const newTab: TerminalTab = {
      id: `tab-${Date.now()}`,
      label: terminalDirectory?.split('/').pop() || 'Terminal',
      directory: terminalDirectory || undefined,
      isActive: true,
    };

    setTabs(prev => prev.map(t => ({ ...t, isActive: false })).concat(newTab));
    setActiveTabId(newTab.id);
  }, [terminalDirectory]);

  // Switch to tab
  const switchTab = useCallback((tabId: string) => {
    setTabs(prev => prev.map(t => ({
      ...t,
      isActive: t.id === tabId,
    })));
    setActiveTabId(tabId);
  }, []);

  // Close tab
  const closeTab = useCallback((tabId: string) => {
    const currentTabs = tabsRef.current;

    if (currentTabs.length <= 1) return;

    // Destroy session if exists
    const sessionId = sessionIds.get(tabId);
    if (sessionId && terminalActions.destroyTerminalSession) {
      terminalActions.destroyTerminalSession(sessionId);
    }

    setSessionIds(prev => {
      const next = new Map(prev);
      next.delete(tabId);
      return next;
    });

    const closingActive = activeTabIdRef.current === tabId;
    const tabIndex = currentTabs.findIndex(t => t.id === tabId);

    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (closingActive && filtered.length > 0) {
        const newActiveIndex = Math.max(0, tabIndex - 1);
        return filtered.map((t, i) => ({
          ...t,
          isActive: i === newActiveIndex,
        }));
      }
      return filtered;
    });

    if (closingActive) {
      const newTabs = currentTabs.filter(t => t.id !== tabId);
      const newActiveIndex = Math.max(0, tabIndex - 1);
      if (newTabs[newActiveIndex]) {
        setActiveTabId(newTabs[newActiveIndex].id);
      }
    }
  }, [sessionIds, terminalActions]);

  // Handle session created callback
  const handleSessionCreated = useCallback((tabId: string, sessionId: string) => {
    setSessionIds(prev => new Map(prev).set(tabId, sessionId));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + T: New tab
      if (isMod && e.key === 't') {
        e.preventDefault();
        e.stopPropagation();

        if (isCreatingTabRef.current) return;
        isCreatingTabRef.current = true;
        addNewTab();
        setTimeout(() => {
          isCreatingTabRef.current = false;
        }, 500);
        return;
      }

      // Cmd/Ctrl + W: Close tab
      if (isMod && e.key === 'w') {
        e.preventDefault();
        e.stopPropagation();
        closeTab(activeTabIdRef.current);
        return;
      }

      // Cmd/Ctrl + 1-9: Switch tabs
      if (isMod && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        e.stopPropagation();

        const currentTabs = tabsRef.current;
        const tabIndex = e.key === '9'
          ? currentTabs.length - 1
          : parseInt(e.key) - 1;

        if (currentTabs[tabIndex]) {
          switchTab(currentTabs[tabIndex].id);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [addNewTab, closeTab, switchTab]);

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e' }}>
      {/* Tab Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#252526',
          borderBottom: '1px solid #3c3c3c',
          minHeight: '36px',
          overflow: 'hidden',
        }}
      >
        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
            gap: '2px',
            padding: '4px 4px 0 4px',
          }}
        >
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: tab.isActive ? '#1e1e1e' : 'transparent',
                color: tab.isActive ? '#d4d4d4' : '#888',
                borderRadius: '6px 6px 0 0',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
                transition: 'background-color 0.15s',
                borderBottom: tab.isActive ? '2px solid #0e639c' : '2px solid transparent',
                flex: 1,
                minWidth: 0, // Allow shrinking below content size
              }}
              onMouseEnter={(e) => {
                if (!tab.isActive) {
                  e.currentTarget.style.backgroundColor = '#2a2d2e';
                }
              }}
              onMouseLeave={(e) => {
                if (!tab.isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {/* Tab label - centered */}
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  textAlign: 'center',
                }}
              >
                {tab.label}
              </span>

              {/* Close button */}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px',
                    padding: 0,
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#666',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#ff6b6b33';
                    e.currentTarget.style.color = '#ff6b6b';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#666';
                  }}
                  title="Close tab (⌘W)"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* New Tab Button */}
        <button
          onClick={addNewTab}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            margin: '0 8px',
            padding: 0,
            border: 'none',
            backgroundColor: 'transparent',
            color: '#888',
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#3c3c3c';
            e.currentTarget.style.color = '#d4d4d4';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#888';
          }}
          title="New tab (⌘T)"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Terminal Content Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {tabs.map((tab) => (
          <TerminalTabContent
            key={tab.id}
            tabId={tab.id}
            isActive={tab.id === activeTabId}
            sessionId={sessionIds.get(tab.id) || null}
            terminalActions={terminalActions}
            events={events}
            onSessionCreated={handleSessionCreated}
            directory={tab.directory}
          />
        ))}
      </div>
    </div>
  );
};

export default TabbedGhosttyTerminal;
