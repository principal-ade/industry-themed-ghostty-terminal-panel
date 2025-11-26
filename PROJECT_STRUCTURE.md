# Project Structure

This document explains the organization and purpose of files in this panel extension starter.

## Directory Tree

```
industry-themed-panel-starter/
├── src/                          # Source code
│   ├── panels/                   # Panel components
│   │   └── ExamplePanel.tsx      # Example panel implementation
│   ├── types/                    # TypeScript definitions
│   │   └── index.ts              # All type definitions
│   └── index.tsx                 # Main entry - exports panels array
│
├── dist/                         # Build output (generated, gitignored)
│   ├── panels.bundle.js          # Bundled panel code
│   ├── panels.bundle.js.map      # Source map for debugging
│   ├── index.d.ts                # TypeScript declarations
│   └── index.d.ts.map            # Declaration source map
│
├── .gitignore                    # Git ignore rules
├── .npmignore                    # NPM publish ignore rules
├── .prettierrc                   # Prettier configuration
├── .prettierignore               # Prettier ignore rules
├── eslint.config.js              # ESLint configuration
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.build.json           # TypeScript build configuration
├── vite.config.ts                # Vite build configuration
├── package.json                  # Package metadata and scripts
├── LICENSE                       # MIT License
├── README.md                     # Main documentation
├── QUICKSTART.md                 # Quick start guide
├── CONTRIBUTING.md               # Contribution guidelines
└── PROJECT_STRUCTURE.md          # This file
```

## File Descriptions

### Source Files (`src/`)

#### `src/index.tsx`

**Purpose**: Main entry point for the panel extension
**Exports**:

- `panels: PanelDefinition[]` - Array of panel definitions (required)
- `onPackageLoad?: () => void` - Package initialization hook (optional)
- `onPackageUnload?: () => void` - Package cleanup hook (optional)

**Key Points**:

- This is the file referenced by `"main"` in `package.json`
- Must export a `panels` array for discovery
- Each panel definition includes metadata and component

#### `src/types/index.ts`

**Purpose**: TypeScript type definitions
**Contains**:

- `PanelComponentProps` - Props passed to panel components
- `PanelContextValue` - Context data from host application
- `PanelActions` - Actions for host interaction
- `PanelEventEmitter` - Event system types
- `PanelDefinition` - Panel metadata structure
- Data types: `GitStatus`, `FileTree`, `MarkdownFile`, etc.

**Key Points**:

- Single source of truth for all types
- Ensures type safety across the project
- Documents the panel framework API

#### `src/panels/ExamplePanel.tsx`

**Purpose**: Example panel component implementation
**Demonstrates**:

- Using `PanelComponentProps`
- Accessing context data
- Calling host actions
- Subscribing to events
- Handling loading states
- Error handling

**Key Points**:

- Template for creating new panels
- Shows best practices
- Fully commented

### Configuration Files

#### `package.json`

**Purpose**: NPM package configuration
**Critical Fields**:

- `"keywords": ["panel-extension"]` - Required for discovery
- `"main": "dist/panels.bundle.js"` - Entry point
- `"peerDependencies"` - Dependencies from host
- `"dependencies"` - Bundled dependencies

#### `tsconfig.json`

**Purpose**: TypeScript compiler configuration
**Key Settings**:

- Target: ES2020
- Module: ESNext
- JSX: react-jsx (new JSX transform)
- Strict mode enabled
- Path aliases: `@/*` → `./src/*`

#### `tsconfig.build.json`

**Purpose**: TypeScript configuration for declaration generation
**Extends**: `tsconfig.json`
**Key Settings**:

- `emitDeclarationOnly: true`
- Excludes test files
- Outputs to `dist/`

#### `vite.config.ts`

**Purpose**: Vite bundler configuration
**Key Settings**:

- Library mode with ESM output
- Externalizes React and ReactDOM
- Generates source maps
- Path alias resolution

#### `eslint.config.js`

**Purpose**: ESLint linting configuration
**Key Settings**:

- TypeScript ESLint rules
- React plugin with hooks rules
- Import/export validation
- No unused variables (with `_` exception)

#### `.prettierrc`

**Purpose**: Prettier code formatting
**Key Settings**:

- 2 space indentation
- Single quotes
- Semicolons required
- 80 character line width

### Documentation Files

#### `README.md`

**Purpose**: Comprehensive documentation
**Sections**:

- Introduction and overview
- Getting started guide
- API reference
- Code examples
- Best practices
- Troubleshooting

#### `QUICKSTART.md`

**Purpose**: Fast onboarding guide
**Target**: Developers who want to start quickly
**Contents**: Step-by-step instructions from clone to publish

#### `CONTRIBUTING.md`

**Purpose**: Contribution guidelines
**Sections**:

- Development setup
- Code style guidelines
- Commit conventions
- PR process
- Testing guidelines

#### `LICENSE`

**Purpose**: MIT License
**Note**: Update copyright holder before publishing

### Ignore Files

#### `.gitignore`

**Purpose**: Files to ignore in Git
**Ignores**:

- `node_modules/`
- `dist/`
- Environment files
- IDE files
- Build artifacts

#### `.npmignore`

**Purpose**: Files to exclude from NPM package
**Ignores**:

- Source files (`src/`)
- Config files
- Tests
- Development files

**Note**: Only `dist/`, `README.md`, and `LICENSE` are published

## Build Output (`dist/`)

Generated by `bun run build`, contains:

### `panels.bundle.js`

- ESM module format
- React/ReactDOM externalized
- All other dependencies bundled
- Minified in production

### `panels.bundle.js.map`

- Source map for debugging
- Maps minified code to source

### `index.d.ts`

- TypeScript type declarations
- Generated from source files
- Enables IDE autocomplete

### `index.d.ts.map`

- Declaration source map
- Links types to source code

## Package Publishing

When you run `npm publish`, NPM includes:

```
Published Package:
├── dist/
│   ├── panels.bundle.js
│   ├── panels.bundle.js.map
│   ├── index.d.ts
│   └── index.d.ts.map
├── README.md
├── LICENSE
└── package.json
```

Everything else is excluded via `.npmignore`.

## Development Workflow

### Adding a New Panel

1. Create component in `src/panels/NewPanel.tsx`
2. Define types in `src/types/index.ts` (if needed)
3. Register in `src/index.tsx` panels array
4. Build and test

### Adding Dependencies

**Shared (Peer) Dependencies**:

```bash
# Add to peerDependencies in package.json
# Do NOT install - provided by host
```

**Unique (Bundled) Dependencies**:

```bash
bun add your-package
# Automatically added to dependencies
# Will be bundled into output
```

### Testing Changes

```bash
# Type check
bun run typecheck

# Lint
bun run lint

# Build
bun run build

# Link for local testing
bun link
```

## Key Concepts

### Panel Extension

- NPM package with `"panel-extension"` keyword
- Exports `panels` array
- Built to `dist/panels.bundle.js`
- Discovered and loaded by host application

### Dependency Management

- **Peer Dependencies**: Shared with host (React, ReactDOM)
- **Dependencies**: Bundled into output (lodash, etc.)
- **Dev Dependencies**: Build tools only

### Build Process

1. Vite bundles `src/index.tsx`
2. Externalizes peer dependencies
3. Bundles all other imports
4. TypeScript generates `.d.ts` files
5. Output to `dist/panels.bundle.js`

### Type Safety

- Full TypeScript support
- Types from `@principal-ade/panel-framework-core`
- Local types in `src/types/index.ts`
- Generated declarations for consumers

## Best Practices

1. **Type Everything**: Use TypeScript for all source files
2. **Export Types**: Make types available to consumers
3. **Document APIs**: Comment public interfaces
4. **Handle Errors**: Catch and display errors gracefully
5. **Clean Up**: Unsubscribe from events, clear timers
6. **Test Locally**: Link and test before publishing
7. **Version Properly**: Follow semantic versioning

## Resources

- [Panel Extension Specification V2](https://github.com/principal-ade/panel-framework/blob/main/PANEL_EXTENSION_STORE_SPECIFICATION_V2.md)
- [Panel Framework Core](https://github.com/principal-ade/panel-framework-core)
- [Vite Documentation](https://vitejs.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
