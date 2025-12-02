/**
 * Ghostty Terminal Panel Tools
 *
 * UTCP-compatible tools for the Ghostty Terminal panel extension.
 * These tools can be invoked by AI agents and emit events that panels listen for.
 *
 * IMPORTANT: This file should NOT import any React components to ensure
 * it can be imported server-side without pulling in React dependencies.
 * Use the './tools' subpath export for server-safe imports.
 */

import type { PanelTool, PanelToolsMetadata } from '@principal-ade/utcp-panel-event';

/**
 * Tool: Create Terminal Session
 */
export const createTerminalSessionTool: PanelTool = {
  name: 'create_terminal_session',
  description: 'Creates a new Ghostty terminal session in the specified directory',
  inputs: {
    type: 'object',
    properties: {
      cwd: {
        type: 'string',
        description: 'The working directory for the terminal session',
      },
      name: {
        type: 'string',
        description: 'Optional name for the terminal session',
      },
    },
    required: ['cwd'],
  },
  outputs: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      sessionId: { type: 'string' },
    },
  },
  tags: ['terminal', 'ghostty', 'session', 'create'],
  tool_call_template: {
    call_template_type: 'panel_event',
    event_type: 'industry-theme.ghostty-terminal-panel:create-session',
  },
};

/**
 * Tool: Write to Terminal
 */
export const writeToTerminalTool: PanelTool = {
  name: 'write_to_terminal',
  description: 'Writes data to an active Ghostty terminal session',
  inputs: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The ID of the terminal session to write to',
      },
      data: {
        type: 'string',
        description: 'The data to write to the terminal',
      },
    },
    required: ['sessionId', 'data'],
  },
  outputs: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
    },
  },
  tags: ['terminal', 'ghostty', 'write', 'input'],
  tool_call_template: {
    call_template_type: 'panel_event',
    event_type: 'industry-theme.ghostty-terminal-panel:write',
  },
};

/**
 * Tool: Close Terminal Session
 */
export const closeTerminalSessionTool: PanelTool = {
  name: 'close_terminal_session',
  description: 'Closes an active Ghostty terminal session',
  inputs: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The ID of the terminal session to close',
      },
    },
    required: ['sessionId'],
  },
  outputs: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
    },
  },
  tags: ['terminal', 'ghostty', 'session', 'close'],
  tool_call_template: {
    call_template_type: 'panel_event',
    event_type: 'industry-theme.ghostty-terminal-panel:close-session',
  },
};

/**
 * Tool: Clear Terminal
 */
export const clearTerminalTool: PanelTool = {
  name: 'clear_terminal',
  description: 'Clears the Ghostty terminal screen',
  inputs: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The ID of the terminal session to clear',
      },
    },
    required: ['sessionId'],
  },
  outputs: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
    },
  },
  tags: ['terminal', 'ghostty', 'clear'],
  tool_call_template: {
    call_template_type: 'panel_event',
    event_type: 'industry-theme.ghostty-terminal-panel:clear',
  },
};

/**
 * Tool: Focus Terminal
 */
export const focusTerminalTool: PanelTool = {
  name: 'focus_terminal',
  description: 'Focuses the Ghostty terminal panel and brings it to the foreground',
  inputs: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The ID of the terminal session to focus',
      },
    },
  },
  outputs: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
    },
  },
  tags: ['terminal', 'ghostty', 'focus', 'navigation'],
  tool_call_template: {
    call_template_type: 'panel_event',
    event_type: 'industry-theme.ghostty-terminal-panel:focus',
  },
};

/**
 * All tools exported as an array.
 */
export const ghosttyTerminalPanelTools: PanelTool[] = [
  createTerminalSessionTool,
  writeToTerminalTool,
  closeTerminalSessionTool,
  clearTerminalTool,
  focusTerminalTool,
];

/**
 * Panel tools metadata for registration with PanelToolRegistry.
 */
export const ghosttyTerminalPanelToolsMetadata: PanelToolsMetadata = {
  id: 'industry-theme.ghostty-terminal-panel',
  name: 'Ghostty Terminal Panel',
  description: 'Tools provided by the Ghostty WebAssembly terminal panel extension',
  tools: ghosttyTerminalPanelTools,
};
