# Contributing to Panel Extension Starter

Thank you for your interest in contributing! This document provides guidelines for contributing to this panel extension starter template.

## Development Setup

### Prerequisites

- Node.js >= 18.0.0 or Bun >= 1.0.0
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/panel-starter.git
cd panel-starter

# Install dependencies
bun install
# or: npm install
```

## Development Workflow

### Making Changes

1. **Create a branch** for your changes:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guidelines below

3. **Test your changes**:

   ```bash
   # Type checking
   bun run typecheck

   # Linting
   bun run lint

   # Build
   bun run build
   ```

4. **Format your code**:

   ```bash
   bun run format
   ```

5. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, missing semi-colons, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:

```
feat: add new panel lifecycle hook
fix: correct type definition for PanelContext
docs: update README with new examples
```

## Code Style

### TypeScript

- Use TypeScript for all source files
- Provide proper type annotations
- Avoid `any` type when possible
- Export types from `src/types/index.ts`

### React

- Use functional components with hooks
- Prefer named exports over default exports
- Use proper TypeScript types for props
- Clean up effects with return functions

Example:

```tsx
import React, { useEffect } from 'react';
import type { PanelComponentProps } from '../types';

export const MyPanel: React.FC<PanelComponentProps> = ({
  context,
  actions,
  events,
}) => {
  useEffect(() => {
    const cleanup = events.on('event:type', handler);
    return cleanup;
  }, [events]);

  return <div>Panel Content</div>;
};
```

### Formatting

- Run `bun run format` before committing
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- 80 character line length (soft limit)

### Linting

- Run `bun run lint` to check for issues
- Run `bun run lint:fix` to auto-fix issues
- No ESLint warnings or errors should remain

## Project Structure

```
panel-starter/
├── src/
│   ├── panels/          # Panel components
│   ├── types/           # TypeScript definitions
│   └── index.tsx        # Main entry point
├── dist/                # Build output (generated)
├── package.json         # Package configuration
├── tsconfig.json        # TypeScript config
├── vite.config.ts       # Build config
└── README.md            # Documentation
```

### Adding New Files

- Panel components go in `src/panels/`
- Shared utilities go in `src/shared/` (create if needed)
- Types go in `src/types/index.ts`
- Update exports in `src/index.tsx`

## Testing

### Local Testing

Test your panel locally by linking:

```bash
# In panel directory
bun run build
bun link

# In host application
bun link @your-org/panel-starter
```

### Manual Testing Checklist

- [ ] Panel loads without errors
- [ ] Panel displays correctly
- [ ] Context data is accessible
- [ ] Actions work as expected
- [ ] Events are received and emitted correctly
- [ ] Lifecycle hooks execute properly
- [ ] No console errors or warnings

## Pull Request Process

1. **Update documentation** if you've changed APIs or added features
2. **Ensure all checks pass**:
   - TypeScript compiles without errors
   - Linting passes
   - Build succeeds
3. **Write clear PR description**:
   - What does this change?
   - Why is this change needed?
   - How has it been tested?
4. **Request review** from maintainers
5. **Address feedback** and make requested changes
6. **Squash commits** if requested before merging

## Release Process

Maintainers will handle releases:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create git tag
4. Build and publish to NPM

## Questions?

- Open an issue for bug reports or feature requests
- Start a discussion for questions or ideas
- Check existing issues before creating new ones

## Code of Conduct

Be respectful and constructive in all interactions. We aim to maintain a welcoming community for all contributors.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
