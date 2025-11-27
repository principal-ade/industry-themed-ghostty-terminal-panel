import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal, FitAddon } from 'ghostty-web';
import { Plus, X, Terminal as TerminalIcon } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import type {
  TabbedGhosttyTerminalProps,
  TerminalTab,
  TerminalSessionInfo,
  TerminalActions,
} from '../types';

/**
 * Individual Terminal Tab Content
 * Renders a single Ghostty terminal instance for a tab
 * Uses onTerminalData for session-specific data subscription
 */
interface TerminalTabContentProps {
  tab: TerminalTab;
  sessionId: string | null;
  isActive: boolean;
  isVisible: boolean;
  actions: TerminalActions;
  terminalContext: string;
  onSessionCreated: (tabId: string, sessionId: string) => void;
}

const TerminalTabContent = React.memo<TerminalTabContentProps>(
  ({
    tab,
    sessionId,
    isActive,
    isVisible,
    actions,
    terminalContext,
    onSessionCreated,
  }) => {
    const { theme } = useTheme();
    const terminalRef = useRef<HTMLDivElement>(null);
    const terminalInstanceRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const hasInitializedRef = useRef(false);

    const [localSessionId, setLocalSessionId] = useState<string | null>(sessionId);
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize terminal session
    useEffect(() => {
      if (hasInitializedRef.current) return;
      hasInitializedRef.current = true;

      let mounted = true;

      const initSession = async () => {
        try {
          // If we already have a session ID (restored), use it
          if (sessionId) {
            setLocalSessionId(sessionId);
            setIsInitialized(true);

            // Claim ownership if available
            if (actions.claimTerminalOwnership) {
              await actions.claimTerminalOwnership(sessionId);
            }
            return;
          }

          // Create new session
          if (!actions.createTerminalSession) {
            setError('createTerminalSession action not available');
            return;
          }

          const newSessionId = await actions.createTerminalSession({
            cwd: tab.directory,
            command: tab.command,
            context: `${terminalContext}:${tab.id}`,
          });

          if (!mounted) return;

          setLocalSessionId(newSessionId);
          setIsInitialized(true);
          onSessionCreated(tab.id, newSessionId);

          // Claim ownership if available
          if (actions.claimTerminalOwnership) {
            await actions.claimTerminalOwnership(newSessionId);
          }
        } catch (err) {
          console.error('[TerminalTabContent] Failed to create session:', err);
          setError(err instanceof Error ? err.message : String(err));
        }
      };

      initSession();

      return () => {
        mounted = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Initialize Ghostty terminal UI when we have a session and are active
    useEffect(() => {
      if (!terminalRef.current || !localSessionId || !isActive) return;
      if (terminalInstanceRef.current) return; // Already initialized

      const init = async () => {
        try {
          const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: theme.fonts.monospace || 'JetBrains Mono, Menlo, Monaco, monospace',
            theme: {
              background: theme.colors.background,
              foreground: theme.colors.text,
              cursor: theme.colors.text,
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
            if (actions.writeToTerminal && localSessionId) {
              actions.writeToTerminal(localSessionId, input);
            }
          });

          // Handle resize
          resizeObserverRef.current = new ResizeObserver(() => {
            if (fitAddonRef.current && terminalInstanceRef.current) {
              fitAddonRef.current.fit();
              if (actions.resizeTerminal && localSessionId) {
                actions.resizeTerminal(
                  localSessionId,
                  terminalInstanceRef.current.cols,
                  terminalInstanceRef.current.rows
                );
              }
            }
          });
          resizeObserverRef.current.observe(terminalRef.current!);

          // Refresh to get existing buffer after terminal is ready
          if (actions.refreshTerminal) {
            setTimeout(async () => {
              try {
                await actions.refreshTerminal!(localSessionId);
              } catch (e) {
                console.warn('[TerminalTabContent] Failed to refresh:', e);
              }
            }, 200);
          }
        } catch (err) {
          console.error('[TerminalTabContent] Failed to initialize Ghostty:', err);
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
    }, [localSessionId, isActive, actions, theme]);

    // Subscribe to terminal data using onTerminalData
    useEffect(() => {
      if (!localSessionId || !isInitialized) return;
      if (!actions.onTerminalData) {
        console.error('[TerminalTabContent] onTerminalData not available');
        return;
      }

      const unsubscribe = actions.onTerminalData(localSessionId, (data: string) => {
        if (terminalInstanceRef.current) {
          terminalInstanceRef.current.write(data);
        }
      });

      // For restored sessions, request a refresh to get the buffer contents
      // Do this after subscription is set up so we receive the data
      let refreshTimeout: NodeJS.Timeout | undefined;
      if (sessionId && actions.refreshTerminal) {
        refreshTimeout = setTimeout(() => {
          actions.refreshTerminal!(localSessionId).catch((err) => {
            console.warn('[TerminalTabContent] Failed to refresh restored session:', err);
          });
        }, 100);
      }

      return () => {
        unsubscribe();
        if (refreshTimeout) {
          clearTimeout(refreshTimeout);
        }
      };
    }, [localSessionId, isInitialized, actions, sessionId]);

    // Focus terminal and refresh when tab becomes active
    useEffect(() => {
      if (isActive && terminalInstanceRef.current && localSessionId) {
        terminalInstanceRef.current.focus();
        // Refit on activation
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
        // Refresh to get buffer contents when switching to this tab
        if (actions.refreshTerminal) {
          setTimeout(async () => {
            try {
              await actions.refreshTerminal!(localSessionId);
            } catch (e) {
              console.warn('[TerminalTabContent] Failed to refresh on tab switch:', e);
            }
          }, 100);
        }
      }
    }, [isActive, localSessionId, actions]);

    if (error) {
      return (
        <div
          style={{
            padding: '20px',
            color: theme.colors.error || '#ef4444',
            backgroundColor: theme.colors.background,
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

    if (!isInitialized) {
      return (
        <div
          style={{
            display: isActive ? 'flex' : 'none',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.colors.textSecondary,
            backgroundColor: theme.colors.background,
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
          backgroundColor: theme.colors.background,
        }}
      />
    );
  }
);

TerminalTabContent.displayName = 'TerminalTabContent';

/**
 * TabbedGhosttyTerminal Component
 *
 * A tabbed terminal panel using the Ghostty WebAssembly engine.
 * Uses onTerminalData for session-specific data subscription, avoiding
 * the MessagePort timing issues.
 *
 * Features:
 * - Multiple terminal tabs
 * - Session restoration from existing terminals
 * - Keyboard shortcuts (Cmd+T, Cmd+W, Cmd+1-9)
 * - Session persistence across tab switches
 */
export const TabbedGhosttyTerminal: React.FC<TabbedGhosttyTerminalProps> = ({
  context: _context,
  actions,
  events: _events,
  terminalContext,
  directory,
  hideHeader = false,
  isVisible = true,
  onTabsChange,
  initialTabs = [],
  showAllTerminals = false,
  onShowAllTerminalsChange: _onShowAllTerminalsChange,
}) => {
  const { theme } = useTheme();
  const [tabs, setTabs] = useState<TerminalTab[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [sessionIds, setSessionIds] = useState<Map<string, string>>(new Map());
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);

  // Track initialization
  const hasInitializedRef = useRef(false);
  const isCreatingTabRef = useRef(false);

  // Restore sessions from existing terminals
  const restoreSessions = useCallback(async () => {
    try {
      let sessions: TerminalSessionInfo[] = [];

      // Try to list sessions via action
      if (actions.listTerminalSessions) {
        sessions = await actions.listTerminalSessions();
      }

      // Filter sessions by context (or show all if showAllTerminals is true)
      const ourSessions = sessions.filter(
        (session) =>
          showAllTerminals ||
          session.context?.startsWith(terminalContext)
      );

      if (ourSessions.length > 0 && initialTabs.length === 0) {
        const restoredTabs: TerminalTab[] = [];
        const restoredSessionIds = new Map<string, string>();

        ourSessions.forEach((session, index) => {
          const tabId = `tab-restored-${session.id}`;
          const sessionCwd = session.cwd || directory;
          const tab: TerminalTab = {
            id: tabId,
            label: sessionCwd.split('/').pop() || sessionCwd,
            directory: sessionCwd,
            isActive: index === 0,
          };

          restoredTabs.push(tab);
          restoredSessionIds.set(tabId, session.id);
        });

        setTabs(restoredTabs);
        setSessionIds(restoredSessionIds);
        setActiveTabId(restoredTabs[0]?.id || null);
        onTabsChange?.(restoredTabs);

        console.info(`[TabbedGhosttyTerminal] Restored ${restoredTabs.length} tabs`);
      } else if (initialTabs.length > 0) {
        setTabs(initialTabs);
        setActiveTabId(
          initialTabs.find((t) => t.isActive)?.id || initialTabs[0]?.id || null
        );
      }
    } catch (err) {
      console.error('[TabbedGhosttyTerminal] Failed to restore sessions:', err);
    }
  }, [terminalContext, showAllTerminals, initialTabs, onTabsChange, actions]);

  // Initialize on mount
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    console.info('[TabbedGhosttyTerminal] Initializing...');
    restoreSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch to a tab
  const switchTab = useCallback((tabId: string) => {
    setTabs((prevTabs) =>
      prevTabs.map((t) => ({
        ...t,
        isActive: t.id === tabId,
      }))
    );
    setActiveTabId(tabId);
  }, []);

  // Create a new tab
  const addNewTab = useCallback(
    (label?: string, command?: string, targetDirectory?: string) => {
      const targetDir = targetDirectory || directory;
      const directoryName = targetDir.split('/').pop() || targetDir;
      const newTab: TerminalTab = {
        id: `tab-${Date.now()}`,
        label: label || directoryName,
        directory: targetDir,
        command,
        isActive: true,
      };

      setTabs((prevTabs) => {
        const updatedTabs = prevTabs.map((t) => ({ ...t, isActive: false }));
        const newTabs = [...updatedTabs, newTab];
        onTabsChange?.(newTabs);
        return newTabs;
      });

      setActiveTabId(newTab.id);
    },
    [directory, onTabsChange]
  );

  // Close a tab
  const closeTab = useCallback(
    async (tabId: string) => {
      const sessionId = sessionIds.get(tabId);
      if (sessionId && actions.destroyTerminalSession) {
        try {
          await actions.destroyTerminalSession(sessionId);
        } catch (err) {
          console.error('[TabbedGhosttyTerminal] Failed to destroy session:', err);
        }
        setSessionIds((prev) => {
          const newMap = new Map(prev);
          newMap.delete(tabId);
          return newMap;
        });
      }

      setTabs((prevTabs) => {
        const newTabs = prevTabs.filter((t) => t.id !== tabId);

        if (activeTabId === tabId && newTabs.length > 0) {
          const newActiveTab = newTabs[newTabs.length - 1];
          newActiveTab.isActive = true;
          setActiveTabId(newActiveTab.id);
        } else if (newTabs.length === 0) {
          setActiveTabId(null);
        }

        onTabsChange?.(newTabs);
        return newTabs;
      });
    },
    [activeTabId, sessionIds, actions, onTabsChange]
  );

  // Handle session creation callback
  const handleSessionCreated = useCallback((tabId: string, sessionId: string) => {
    setSessionIds((prev) => new Map(prev).set(tabId, sessionId));
  }, []);

  // Store refs for keyboard handler
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const addNewTabRef = useRef(addNewTab);
  const closeTabRef = useRef(closeTab);
  const switchTabRef = useRef(switchTab);

  useEffect(() => {
    tabsRef.current = tabs;
    activeTabIdRef.current = activeTabId;
    addNewTabRef.current = addNewTab;
    closeTabRef.current = closeTab;
    switchTabRef.current = switchTab;
  }, [tabs, activeTabId, addNewTab, closeTab, switchTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + T to open new tab
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        e.stopPropagation();

        if (isCreatingTabRef.current) return;
        isCreatingTabRef.current = true;
        addNewTabRef.current?.();
        setTimeout(() => {
          isCreatingTabRef.current = false;
        }, 500);
        return;
      }

      // Cmd/Ctrl + W to close active tab
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        const currentActiveTabId = activeTabIdRef.current;
        const currentTabs = tabsRef.current;
        if (currentActiveTabId && currentTabs.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          closeTabRef.current?.(currentActiveTabId);
        }
        return;
      }

      // Cmd/Ctrl + number (1-9) to switch tabs
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const currentTabs = tabsRef.current;
        const keyNum = parseInt(e.key, 10);
        const tabIndex = keyNum === 9 ? currentTabs.length - 1 : keyNum - 1;

        if (tabIndex >= 0 && tabIndex < currentTabs.length) {
          const targetTab = currentTabs[tabIndex];
          if (targetTab) {
            switchTabRef.current?.(targetTab.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Tab bar */}
      {!hideHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            height: '41px',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* Tabs container */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              overflow: 'hidden',
              borderBottom: `1px solid ${theme.colors.border}`,
              boxSizing: 'border-box',
            }}
          >
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={(e) => {
                  e.stopPropagation();
                  switchTab(tab.id);
                }}
                onMouseEnter={() => setHoveredTabId(tab.id)}
                onMouseLeave={() => setHoveredTabId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  backgroundColor: tab.isActive
                    ? theme.colors.background
                    : theme.colors.backgroundSecondary,
                  borderBottom: `1px solid ${theme.colors.border}`,
                  cursor: 'pointer',
                  fontSize: theme.fontSizes[1],
                  fontWeight: tab.isActive
                    ? theme.fontWeights.semibold
                    : theme.fontWeights.body,
                  fontFamily: theme.fonts.body,
                  color: tab.isActive
                    ? theme.colors.text
                    : theme.colors.textSecondary,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  position: 'relative',
                  boxSizing: 'border-box',
                }}
              >
                {hoveredTabId === tab.id && (
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
                      borderRadius: '3px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      color: theme.colors.textSecondary,
                      padding: 0,
                      position: 'absolute',
                      left: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundTertiary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
                <span title={tab.directory}>{tab.label}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              borderLeft: `1px solid ${theme.colors.border}`,
              borderBottom: `1px solid ${theme.colors.border}`,
              boxSizing: 'border-box',
            }}
          >
            {/* Add new tab button */}
            <button
              onClick={() => addNewTab()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '100%',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                color: theme.colors.textSecondary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="New terminal (Cmd+T)"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Terminal content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          width: '100%',
          minHeight: 0,
        }}
      >
        {tabs.map((tab) => (
          <TerminalTabContent
            key={tab.id}
            tab={tab}
            sessionId={sessionIds.get(tab.id) || null}
            isActive={tab.id === activeTabId}
            isVisible={isVisible}
            actions={actions}
            terminalContext={terminalContext}
            onSessionCreated={handleSessionCreated}
          />
        ))}

        {/* Empty state */}
        {tabs.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
            }}
          >
            <TerminalIcon
              size={32}
              style={{ opacity: 0.5, marginBottom: '16px' }}
            />
            <p>No terminal sessions</p>
            <button
              onClick={() => addNewTab()}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
              }}
            >
              New Terminal
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

TabbedGhosttyTerminal.displayName = 'TabbedGhosttyTerminal';

export default TabbedGhosttyTerminal;
