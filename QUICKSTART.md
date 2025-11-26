# Quick Start Guide

Get your panel extension up and running in minutes!

## 1. Install Dependencies

```bash
bun install
# or: npm install
```

## 2. Customize Your Panel

### Update package.json

Change these fields to match your panel:

```json
{
  "name": "@your-org/awesome-panel",
  "description": "My awesome panel extension",
  "author": "Your Name",
  "repository": {
    "url": "git+https://github.com/your-org/awesome-panel.git"
  }
}
```

### Modify the Example Panel

Edit `src/panels/ExamplePanel.tsx` or create a new panel:

```tsx
import React from 'react';
import type { PanelComponentProps } from '../types';

export const AwesomePanel: React.FC<PanelComponentProps> = ({
  context,
  actions,
  events,
}) => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>🚀 My Awesome Panel</h1>
      <p>Repository: {context.repositoryPath || 'None'}</p>
    </div>
  );
};
```

### Register Your Panel

Update `src/index.tsx`:

```tsx
import { AwesomePanel } from './panels/AwesomePanel';

export const panels = [
  {
    id: 'your-org.awesome-panel',
    name: 'Awesome Panel',
    icon: '🚀',
    description: 'Does awesome things',
    component: AwesomePanel,
  },
];
```

## 3. Develop with Storybook

```bash
# Start Storybook for interactive development
bun run storybook
```

Storybook opens at `http://localhost:6006` with:

- Live panel preview
- Interactive prop controls
- Multiple example states
- Auto-generated documentation

## 4. Build Your Panel

```bash
# Development mode (watches for changes)
bun run dev

# Production build
bun run build
```

Your panel will be built to `dist/panels.bundle.js`.

## 5. Test Locally

Link your panel to test in a host application:

```bash
# In your panel directory
bun run build
bun link

# In your host application directory
bun link @your-org/awesome-panel
```

## 6. Publish to NPM

When ready to share your panel:

```bash
# Make sure everything is built
bun run build

# Check what will be published
npm pack --dry-run

# Publish to NPM
npm publish --access public
```

## What's Next?

- Read the [README.md](./README.md) for detailed API documentation
- Check [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines
- Explore the [Panel Extension Specification](https://github.com/principal-ade/panel-framework/blob/main/PANEL_EXTENSION_STORE_SPECIFICATION_V2.md)

## Common Commands

```bash
# Development
bun run storybook        # Interactive development
bun run dev              # Watch mode
bun run build            # Production build
bun run typecheck        # Check types
bun run lint             # Lint code
bun run format           # Format code

# Storybook
bun run storybook        # Start Storybook
bun run build-storybook  # Build static Storybook

# Cleanup
bun run clean            # Remove dist/
```

## Need Help?

- Check the [README.md](./README.md) for comprehensive documentation
- Open an issue on GitHub
- Review example panels in the specification

Happy panel building! 🎉
