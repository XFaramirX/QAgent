# QAgent - QA Automation Agent

A minimal Quality Assurance workspace that leverages Copilot agents for requirement analysis and Playwright test generation. This project automates the end-to-end testing workflow by analyzing requirements, generating test cases, and executing tests with AI assistance.

## Features

- **Copilot Integration**: Uses AI agents to analyze requirements and generate comprehensive test cases
- **Playwright Testing**: Automated browser testing using Playwright for UI/End-to-End testing
- **Ticket-Based Testing**: Run tests organized by feature tickets or user stories
- **Snapshot Capture**: Visual regression testing with automatic screenshot capture
- **Token Logging**: Track AI agent token usage for cost monitoring and optimization
- **Result Syncing**: Synchronize test results back to ticket tracking systems

## Project Structure

```
QAgent/
├── .claude/          # Claude AI configuration
├── .deepeval/        # DeepEval evaluation settings
├── .git/             # Git repository data
├── .github/          # GitHub workflows and configurations
├── .vscode/          # VS Code extensions and settings
├── node_modules/     # npm dependencies
├── playwright-report/ # Playwright test reports
├── scripts/          # Custom automation scripts
│   ├── run-ticket-tests.js    # Execute tests by ticket ID
│   ├── capture-snapshot.js    # Capture visual snapshots
│   └── write-token-log.js      # Log AI token usage
│   └── sync-ticket-result.js  # Sync test results to tickets
├── test-results/     # Test execution results
├── tests/            # Playwright test files
├── tickets/          # Requirement/user story definitions
├── package.json      # Project dependencies and scripts
└── tsconfig.json    # TypeScript configuration
```

## Quick Start

### Installation

1. Install Node.js (v20+)
2. Clone or download this repository
3. Run `npm install` to install dependencies

### Running Tests

```bash
# Run all tests
npm test

# Run UI mode tests
npm run test:ui

# Run ticket-based tests
npm run test:ticket

# Capture visual snapshots
npm run snapshot
```

## Scripts Reference

| Script        | Description                                     |
| ------------- | ----------------------------------------------- |
| `test`        | Run Playwright tests in headless mode           |
| `test:ui`     | Run Playwright tests with interactive UI mode   |
| `test:ticket` | Execute tests organized by feature tickets      |
| `snapshot`    | Capture visual snapshots for regression testing |
| `log:agent`   | Write AI agent token usage logs                 |
| `sync:ticket` | Sync test results back to ticket tracking       |

## Configuration

### TypeScript Config (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "lib": ["ES2021"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist"
  }
}
```

### Playwright Config (`playwright.config.ts`)

Configure browser types, test workers, and reporting options.

## AI Agent Integration

The project integrates with Copilot agents to:

- Parse requirement documents from `tickets/` folder
- Generate test cases based on requirements
- Create Playwright test scripts automatically
- Validate generated tests before execution

## Documentation

For detailed documentation on each component, refer to the respective folders and configuration files.

---

**Version**: 1.0.0  
**License**: MIT (or specify your license)  
**Last Updated**: 2026-07-15
