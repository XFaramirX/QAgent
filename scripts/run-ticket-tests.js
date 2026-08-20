#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const [, , ticketId] = process.argv;
if (!ticketId) {
    console.error('Usage: npm run test:ticket -- <ticketId>');
    process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const ticketRoot = path.join(repoRoot, 'tickets', ticketId);
const generatedDir = path.join(ticketRoot, 'generated');
const resultsDir = path.join(ticketRoot, 'results');
const reportDir = path.join(ticketRoot, 'playwright-report');
const runLog = path.join(resultsDir, 'test-run.txt');
const summaryPath = path.join(resultsDir, 'summary.json');
const playwrightCli = path.join(repoRoot, 'node_modules', 'playwright', 'cli.js');
const writeTokenLogScript = path.join(repoRoot, 'scripts', 'write-token-log.js');
const syncTicketResultScript = path.join(repoRoot, 'scripts', 'sync-ticket-result.js');
const startedAt = Date.now();
const runId = crypto.randomUUID();

if (!fs.existsSync(generatedDir)) {
    console.error(`Generated spec directory not found: ${generatedDir}`);
    process.exit(1);
}

fs.mkdirSync(resultsDir, { recursive: true });

if (!fs.existsSync(playwrightCli)) {
    console.error(`Playwright CLI not found: ${playwrightCli}`);
    process.exit(1);
}

const args = [
    'test',
    'generated',
    '--reporter=list,html',
    '--output',
    'results/test-results',
];

const cmdStartedAt = Date.now();
const run = spawnSync(process.execPath, [playwrightCli, ...args], {
    cwd: ticketRoot,
    encoding: 'utf8',
    shell: false,
    env: {
        ...process.env,
        PLAYWRIGHT_HTML_REPORT: reportDir,
        PLAYWRIGHT_HTML_OPEN: 'never',
    },
});

const toolExecution = {
    commandsRun: [
        {
            command: `${process.execPath} ${path.relative(repoRoot, playwrightCli).replace(/\\/g, '/')} ${args.join(' ')}`,
            exitCode: run.status === null ? -1 : run.status,
            durationMs: Date.now() - cmdStartedAt,
        },
    ],
    retries: 0,
    retryReasons: [],
};

const output = `${run.stdout || ''}${run.stderr || ''}${run.error ? `\n${run.error.message}\n` : ''}`;
fs.writeFileSync(runLog, output, 'utf8');

const passedMatch = output.match(/(\d+)\s+passed/);
const failedMatch = output.match(/(\d+)\s+failed/);
const skippedMatch = output.match(/(\d+)\s+skipped/);

const summary = {
    ticketId,
    command: `${process.execPath} ${playwrightCli} ${args.join(' ')}`,
    generatedAt: new Date().toISOString(),
    exitCode: run.status,
    passed: run.status === 0,
    counts: {
        passed: passedMatch ? Number(passedMatch[1]) : 0,
        failed: failedMatch ? Number(failedMatch[1]) : 0,
        skipped: skippedMatch ? Number(skippedMatch[1]) : 0,
    },
    artifacts: {
        runLog: path.relative(repoRoot, runLog).replace(/\\/g, '/'),
        summary: path.relative(repoRoot, summaryPath).replace(/\\/g, '/'),
        htmlReportDir: path.relative(repoRoot, reportDir).replace(/\\/g, '/'),
        testResultsDir: path.relative(repoRoot, path.join(resultsDir, 'test-results')).replace(/\\/g, '/'),
    },
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

if (fs.existsSync(writeTokenLogScript)) {
    const model = process.env.COPILOT_MODEL || 'GPT-5.3-Codex';
    const family = process.env.COPILOT_FAMILY || model;
    const version = process.env.COPILOT_VERSION || model;
    const inputTokens = process.env.COPILOT_INPUT_TOKENS || '0';
    const outputTokens = process.env.COPILOT_OUTPUT_TOKENS || '0';
    const durationMs = String(Date.now() - startedAt);
    const approvedAnalysisPath = path.join('tickets', ticketId, 'approved-analysis.json');
    const fallbackAnalysisPath = path.join('tickets', ticketId, 'analysis.json');
    const userContentPath = fs.existsSync(path.join(repoRoot, approvedAnalysisPath))
        ? approvedAnalysisPath
        : fallbackAnalysisPath;
    const toolTelemetryPath = path.join('tickets', ticketId, 'logs', '.playwright-generator-tool-exec.json');
    const snapshotRefPath = path.join('tickets', ticketId, 'snapshot');
    fs.mkdirSync(path.join(repoRoot, 'tickets', ticketId, 'logs'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, toolTelemetryPath), `${JSON.stringify(toolExecution, null, 2)}\n`, 'utf8');

    spawnSync(
        process.execPath,
        [
            writeTokenLogScript,
            ticketId,
            'playwright-generator',
            model,
            family,
            version,
            inputTokens,
            outputTokens,
            durationMs,
            path.join('.github', 'agents', 'playwright-generator.agent.md'),
            userContentPath,
            path.join('tickets', ticketId, 'results', 'summary.json'),
            toolTelemetryPath,
            snapshotRefPath,
            runId,
            '',
        ],
        {
            cwd: repoRoot,
            stdio: 'inherit',
            encoding: 'utf8',
            shell: false,
        }
    );
}

if (fs.existsSync(syncTicketResultScript)) {
    spawnSync(process.execPath, [syncTicketResultScript, ticketId], {
        cwd: repoRoot,
        stdio: 'inherit',
        encoding: 'utf8',
        shell: false,
    });
}

process.stdout.write(output);
process.exit(run.status === null ? 1 : run.status);
