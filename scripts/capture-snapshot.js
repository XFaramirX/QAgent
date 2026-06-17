#!/usr/bin/env node
/**
 * Capture a Playwright Agent CLI snapshot for a ticket.
 *
 *   node scripts/capture-snapshot.js <url> <ticketId>
 *
 * Output (overwritten each run):
 *   tickets/<ticketId>/snapshot/
 *     snapshot.md     accessibility tree (YAML-ish) with element refs
 *     page.html       full document.documentElement.outerHTML
 *     page.png        full-page PNG screenshot
 *     console.log     console messages
 *     network.log     network request list
 *     meta.json       url, title, viewport, capturedAt
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const [, , url, ticketId] = process.argv;
if (!url || !ticketId) {
    console.error('Usage: node scripts/capture-snapshot.js <url> <ticketId>');
    process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const ticketRoot = path.join(repoRoot, 'tickets', ticketId);
const outDir = path.join(ticketRoot, 'snapshot');
const logsDir = path.join(ticketRoot, 'logs');
const session = `qasimple-${ticketId.toLowerCase()}`;
const writeTokenLogScript = path.join(repoRoot, 'scripts', 'write-token-log.js');
const startedAt = Date.now();
const runId = crypto.randomUUID();
const toolExecution = {
    commandsRun: [],
    retries: 0,
    retryReasons: [],
};

const cliJs = path.join(repoRoot, 'node_modules', '@playwright', 'cli', 'playwright-cli.js');
if (!fs.existsSync(cliJs)) {
    console.error(`@playwright/cli not found at ${cliJs}. Run "npm install" first.`);
    process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(logsDir, { recursive: true });

function runCli(args, { captureStdout = false, allowFail = false } = {}) {
    const cmdStartedAt = Date.now();
    const result = spawnSync(process.execPath, [cliJs, `-s=${session}`, ...args], {
        cwd: ticketRoot,
        encoding: 'utf8',
        stdio: captureStdout ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        shell: false,
    });
    toolExecution.commandsRun.push({
        command: `${process.execPath} ${path.relative(repoRoot, cliJs).replace(/\\/g, '/')} -s=${session} ${args.join(' ')}`,
        exitCode: result.status === null ? -1 : result.status,
        durationMs: Date.now() - cmdStartedAt,
    });
    if (result.error) {
        console.error(`Failed to invoke playwright-cli: ${result.error.message}`);
        if (!allowFail) {
            cleanup();
            process.exit(1);
        }
    }
    if (result.status !== 0 && !allowFail) {
        if (captureStdout) {
            process.stderr.write(result.stdout || '');
            process.stderr.write(result.stderr || '');
        }
        console.error(`playwright-cli ${args.join(' ')} exited with code ${result.status}`);
        cleanup();
        process.exit(result.status || 1);
    }
    return result;
}

function cleanup() {
    spawnSync(process.execPath, [cliJs, `-s=${session}`, 'close'], {
        cwd: ticketRoot,
        encoding: 'utf8',
        stdio: 'ignore',
        shell: false,
    });
}

function writeFromStdout(args, outFile) {
    const result = runCli([...args, '--raw'], { captureStdout: true });
    fs.writeFileSync(outFile, result.stdout || '', 'utf8');
}

function writeAgentLog() {
    const model = process.env.COPILOT_MODEL || 'GPT-5.3-Codex';
    const family = process.env.COPILOT_FAMILY || model;
    const version = process.env.COPILOT_VERSION || model;
    const inputTokens = process.env.COPILOT_INPUT_TOKENS || '0';
    const outputTokens = process.env.COPILOT_OUTPUT_TOKENS || '0';
    const durationMs = String(Date.now() - startedAt);
    const systemPromptPath = path.join('.github', 'agents', 'requirement-analyst.agent.md');
    const userContentPath = path.join('tickets', ticketId, 'ticket.md');
    const responsePath = path.join('tickets', ticketId, 'snapshot', 'meta.json');
    const toolTelemetryPath = path.join('tickets', ticketId, 'logs', '.requirement-analyst-tool-exec.json');
    const snapshotRefPath = path.join('tickets', ticketId, 'snapshot');

    fs.writeFileSync(path.join(repoRoot, toolTelemetryPath), `${JSON.stringify(toolExecution, null, 2)}\n`, 'utf8');

    if (!fs.existsSync(writeTokenLogScript)) {
        return;
    }

    spawnSync(
        process.execPath,
        [
            writeTokenLogScript,
            ticketId,
            'requirement-analyst',
            model,
            family,
            version,
            inputTokens,
            outputTokens,
            durationMs,
            systemPromptPath,
            userContentPath,
            responsePath,
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

console.log(`[snapshot] session=${session} url=${url}`);
console.log(`[snapshot] output=${outDir}`);

try {
    // 1. Open the page
    runCli(['open', url]);

    // 2. Accessibility tree snapshot (writes file directly)
    const snapFile = path.join(outDir, 'snapshot.md');
    runCli(['snapshot', '--filename', snapFile]);

    // 3. Full-page screenshot
    const pngFile = path.join(outDir, 'page.png');
    runCli(['screenshot', '--filename', pngFile, '--full-page']);

    // 4. Raw HTML via eval
    const htmlFile = path.join(outDir, 'page.html');
    runCli([
        'eval',
        '() => document.documentElement.outerHTML',
        '--filename',
        htmlFile,
    ]);

    // 5. Console messages
    writeFromStdout(['console'], path.join(outDir, 'console.log'));

    // 6. Network requests
    writeFromStdout(['requests'], path.join(outDir, 'network.log'));

    // 7. Meta (url, title, viewport, capturedAt) — write via --filename then parse
    const metaTmp = path.join(outDir, '.meta.tmp');
    runCli([
        'eval',
        '() => ({ url: location.href, title: document.title, viewport: { width: window.innerWidth, height: window.innerHeight } })',
        '--filename',
        metaTmp,
    ]);
    let meta = {};
    try {
        const raw = fs.readFileSync(metaTmp, 'utf8').trim();
        meta = JSON.parse(raw);
        fs.unlinkSync(metaTmp);
    } catch (e) {
        console.warn(`[snapshot] could not parse meta payload: ${e.message}`);
        if (fs.existsSync(metaTmp)) {
            const dump = fs.readFileSync(metaTmp, 'utf8').slice(0, 400);
            console.warn(`[snapshot] raw eval output (first 400 chars):\n${dump}`);
        }
    }
    meta.ticketId = ticketId;
    meta.requestedUrl = url;
    meta.capturedAt = new Date().toISOString();
    fs.writeFileSync(
        path.join(outDir, 'meta.json'),
        JSON.stringify(meta, null, 2) + '\n',
        'utf8'
    );

    writeAgentLog();

    console.log('[snapshot] done');
} finally {
    cleanup();
}
