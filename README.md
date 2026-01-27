# Snorting-Code

A modern React project with TypeScript, Tailwind CSS, and comprehensive CI/CD pipeline.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Fast build tool and dev server
- **Jest + Testing Library** - Testing framework
- **ESLint + Prettier** - Code quality and formatting

## CI/CD Pipeline

This project includes a robust CI/CD setup with the following features:

The CI pipeline runs on every push and pull request, performing:

1. **Linting & Formatting** (`lint` job)
   - ESLint checks for code quality
   - Prettier format validation
   - Catches common errors and enforces code style

2. **Type Checking** (`type-check` job)
   - TypeScript compilation checks
   - Catches type errors before runtime

3. **Testing** (`test` job)
   - Runs all unit and integration tests
   - Generates code coverage reports
   - Uploads coverage to Codecov (optional)
   - Comments PRs with coverage changes

4. **Build Verification** (`build` job)
   - Ensures the project builds successfully
   - Uploads build artifacts for inspection
   - Catches build-time errors

5. **Security Audit** (`security` job)
   - npm audit for known vulnerabilities
   - Snyk security scanning (optional)
   - Flags moderate+ severity issues

### Dependency Management

- **Dependabot** automatically creates PRs for dependency updates
- Weekly updates on Mondays
- Groups production and development dependencies
- Updates GitHub Actions workflows monthly

### Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

3. **Optional: Set up secrets for enhanced features:**
   - `CODECOV_TOKEN`: For code coverage tracking (add to GitHub Secrets)
   - `SNYK_TOKEN`: For advanced security scanning (add to GitHub Secrets)

4. **Run checks locally:**
   ```bash
   npm run dev           # Start dev server
   npm run build         # Build for production
   npm run preview       # Preview production build
   npm run test          # Run tests
   npm run test:watch    # Run tests in watch mode
   npm run test:coverage # Run tests with coverage
   npm run lint          # Check linting
   npm run lint:fix      # Fix linting issues
   npm run format        # Format code
   npm run format:check  # Check formatting
   npm run type-check    # Check TypeScript types
   npm run check-all     # Run all checks (lint, format, type, test, build)
   ```

### Coverage Thresholds

The project enforces minimum coverage thresholds:
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%


### Workflow Files

- `.github/workflows/ci.yml` - Main CI pipeline (runs on push/PR)
- `.github/workflows/pr-checks.yml` - PR-specific checks
- `.github/workflows/release.yml` - Release automation
- `.github/dependabot.yml` - Dependency update automation



### Local Development

Before committing, ensure:
- All tests pass: `npm test`
- Code is linted: `npm run lint`
- Code is formatted: `npm run format`
- Types are valid: `npm run type-check`
- Project builds: `npm run build`

**Quick check:** Run `npm run check-all` to verify everything at once!

### Additional Features

- **VS Code Integration**: Recommended extensions and settings in `.vscode/`
- **Node Version**: Use `.nvmrc` to ensure consistent Node.js version (20.x)
- **Environment Variables**: See `.env.example` for environment variable template