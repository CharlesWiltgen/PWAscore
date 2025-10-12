# Claude Code Guidelines for PWAscore

This file contains project-specific coding guidelines and workflows for the PWAscore project. These guidelines work in conjunction with the general best practices.

## Pre-commit Workflow

### CRITICAL: Always Run Pre-commit Checks

**G-3 (MUST)** Before committing any code, run `pnpm run precommit` to verify:

- ESLint linting/formatting passes (`lint`)
- TypeScript type checking passes (`typecheck`)

The pre-commit hook will automatically run these checks on staged files, but running the full check manually first helps catch issues early.

### Automated Pre-commit Hook

A Git pre-commit hook using `husky` and `lint-staged` is configured to automatically:

- Fix ESLint issues (formatting and linting) on staged files
- Format JSON/Markdown files with Prettier
- Run on staged files only (fast)

This prevents commits with linting/formatting errors from reaching CI.

**Note**: This project uses ESLint's stylistic rules for code formatting (TypeScript, JavaScript, Vue). Prettier is only used for JSON, Markdown, and YAML files.

### Convenience Scripts

Use these scripts for common workflows:

```bash
# Before committing - runs all CI checks locally
pnpm run precommit

# Fix all linting/formatting issues automatically (recommended)
pnpm run fix

# Fix linting issues only (same as fix)
pnpm run lint:fix

# Format JSON/Markdown files with Prettier (rarely needed)
pnpm run format

# Check Prettier formatting for JSON/Markdown (rarely needed)
pnpm run format:check
```

## Code Style

### Linting and Formatting (ESLint)

This project uses ESLint for both linting **and** formatting (via `@nuxt/eslint` with stylistic rules):

**Code files** (`.ts`, `.js`, `.mjs`, `.vue`):

- No semicolons
- Single quotes
- No trailing commas
- Comma dangle: never
- Brace style: 1tbs (one true brace style)
- Operator linebreaks: before operator
- Auto-fix is enabled in pre-commit hook

**Data files** (`.json`, `.md`, `.yml`, `.yaml`):

- Formatted with Prettier
- Configuration in `package.json`:
  - `"semi": false`
  - `"singleQuote": true`
  - `"trailingComma": "none"`

**Important**: Always use `pnpm run fix` to auto-format code. This runs ESLint with `--fix` which handles all code formatting.

## Git Workflow

### Committing Code

1. Make your changes
2. Stage files: `git add .`
3. Pre-commit hook runs automatically and fixes issues
4. If hook fails, fix the issues and re-stage: `git add .`
5. Commit: `git commit -m "feat: your message"`
6. Push: `git push`

### If CI Fails

If CI still fails after committing:

1. Pull latest changes: `git pull`
2. Run `pnpm run fix` to auto-fix issues
3. Run `pnpm run precommit` to verify all checks pass
4. Commit and push the fixes

### Commit Message Format (QGIT)

When using the QGIT shortcut, follow Conventional Commits:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Common types:

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `test:` - Test changes
- `chore:` - Maintenance tasks
- `perf:` - Performance improvements

## Testing

### Test Scripts

```bash
# Run all tests once
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run tests with UI
pnpm run test:ui

# Run tests with coverage
pnpm run test:coverage
```

### Test Organization

- **Unit tests**: Colocate with source files (same directory)
- **Integration tests**: Place in appropriate test directories
- **Test naming**: Use `.test.ts` or `.spec.ts` extensions

## Project Structure

```
src/
├── app/
│   ├── components/     # Vue components
│   ├── composables/    # Vue composables (reusable logic)
│   ├── data/           # Static data files
│   ├── schemas/        # Data validation schemas (Valibot)
│   ├── utils/          # Utility functions
│   └── pages/          # Nuxt pages
├── scripts/            # Build and utility scripts
├── .husky/             # Git hooks (pre-commit)
├── eslint.config.mjs   # ESLint configuration
└── package.json        # Project dependencies and scripts
```

## Common Issues and Solutions

### Issue: "Extra semicolon" error in CI

**Cause**: Code was committed with semicolons despite the "no semicolons" style rule.

**Solution**: Run `pnpm run fix` to auto-fix all linting/formatting issues.

### Issue: Pre-commit hook fails

**Cause**: Linting or formatting errors in staged files.

**Solution**:

1. The hook will show the errors
2. Run `pnpm run fix` to auto-fix
3. Re-stage the fixed files: `git add .`
4. Try committing again

### Issue: CI passes locally but fails on GitHub

**Cause**: Different files are staged vs committed, or environment differences.

**Solution**:

1. Always run `pnpm run precommit` on the full codebase before pushing
2. Ensure all changes are staged and committed
3. Check that `.husky` directory is committed to the repository

## Deployment

```bash
# Build and deploy to Cloudflare
pnpm run deploy
```

This runs the build process (including OG image generation) and deploys to Cloudflare Workers.

## Data Updates

```bash
# Update Can I Use data
pnpm run update-caniuse

# Generate Open Graph image
pnpm run generate-og
```

## Remember

- **Always run pre-commit checks** - The hook does this automatically, but run `pnpm run precommit` manually for peace of mind
- **Fix issues before committing** - Don't rely on CI to catch formatting/linting issues
- **Use `pnpm run fix`** - Fastest way to fix all auto-fixable issues
- **Test your changes** - Run relevant tests before committing
- **Follow Conventional Commits** - Makes commit history readable and useful
