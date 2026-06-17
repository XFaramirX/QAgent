#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const [
    ,
    ,
    ticketId,
    agentName,
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
    runIdArg,
    parentRunIdArg,
] = process.argv;

if (!ticketId || !agentName) {
    console.error('Usage: node scripts/write-token-log.js <ticketId> <agentName> <model> <family> <version> <inputTokens> <outputTokens> <durationMs> [systemPromptPath] [userContentPath] [responsePath]');
    process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const ticketRoot = path.join(repoRoot, 'tickets', ticketId);
const logsDir = path.join(ticketRoot, 'logs');
fs.mkdirSync(logsDir, { recursive: true });

const now = new Date();
const iso = now.toISOString();
const stamp = iso
    .replace(/:/g, '-')
    .replace(/\./g, '-')
    .replace('T', 'T')
    .replace('Z', 'Z');

function readMaybe(filePath) {
    if (!filePath) return '';
    const full = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
    if (!fs.existsSync(full)) return '';
    return fs.readFileSync(full, 'utf8');
}

function readJsonMaybe(filePath) {
    if (!filePath) return null;
    const full = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
    if (!fs.existsSync(full)) return null;
    try {
        return JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch {
        return null;
    }
}

function sha256(value) {
    return crypto.createHash('sha256').update(value || '', 'utf8').digest('hex');
}

function bytes(value) {
    return Buffer.byteLength(value || '', 'utf8');
}

function listFilesRecursive(rootDir) {
    if (!rootDir || !fs.existsSync(rootDir)) return [];
    const out = [];
    const stack = [rootDir];
    while (stack.length > 0) {
        const dir = stack.pop();
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                stack.push(full);
                continue;
            }
            out.push(full);
        }
    }
    return out.sort();
}

function hashDirectory(dirPath) {
    if (!dirPath || !fs.existsSync(dirPath)) return '';
    const hash = crypto.createHash('sha256');
    const files = listFilesRecursive(dirPath);
    for (const full of files) {
        const rel = path.relative(dirPath, full).replace(/\\/g, '/');
        hash.update(rel, 'utf8');
        hash.update('\n', 'utf8');
        hash.update(fs.readFileSync(full));
        hash.update('\n', 'utf8');
    }
    return hash.digest('hex');
}

function runGit(args) {
    const result = spawnSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8',
        shell: false,
    });
    if (result.status !== 0) return '';
    return (result.stdout || '').trim();
}

function resolveLatestRequirementRunId() {
    if (agentName !== 'playwright-generator') return '';
    if (!fs.existsSync(logsDir)) return '';
    const names = fs
        .readdirSync(logsDir)
        .filter((name) => name.endsWith('-requirement-analyst.json'))
        .sort();
    if (names.length === 0) return '';
    const latest = path.join(logsDir, names[names.length - 1]);
    try {
        const data = JSON.parse(fs.readFileSync(latest, 'utf8'));
        return data?.lineage?.runId || '';
    } catch {
        return '';
    }
}

function safeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

// Rough fallback for environments where exact model token usage is unavailable.
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

const systemPrompt = readMaybe(systemPromptPath);
const userContent = readMaybe(userContentPath);
const response = readMaybe(responsePath);
const toolTelemetry = readJsonMaybe(toolTelemetryPath) || {};

const rawInputTokens = safeNumber(inputTokens);
const rawOutputTokens = safeNumber(outputTokens);
const hasRuntimeTokenMetrics = rawInputTokens > 0 || rawOutputTokens > 0;

const promptTokensEstimate = {
    systemPrompt: estimateTokens(systemPrompt),
    userContent: estimateTokens(userContent),
    toolOutput: 0,
};

const completionTokensEstimate = {
    response: estimateTokens(response),
};

const computedInputTokens = hasRuntimeTokenMetrics
    ? rawInputTokens
    : promptTokensEstimate.systemPrompt + promptTokensEstimate.userContent + promptTokensEstimate.toolOutput;
const computedOutputTokens = hasRuntimeTokenMetrics
    ? rawOutputTokens
    : completionTokensEstimate.response;

const computedDurationMs = Math.max(0, Math.round(safeNumber(durationMs)));
const runId = runIdArg || crypto.randomUUID();
const parentRunId = parentRunIdArg || resolveLatestRequirementRunId();

const snapshotFullPath = snapshotRefPath
    ? (path.isAbsolute(snapshotRefPath) ? snapshotRefPath : path.join(repoRoot, snapshotRefPath))
    : '';

const providerRequestId =
    process.env.COPILOT_PROVIDER_REQUEST_ID ||
    process.env.GITHUB_REQUEST_ID ||
    process.env.COPILOT_REQUEST_ID ||
    '';

const commandItems = Array.isArray(toolTelemetry.commandsRun) ? toolTelemetry.commandsRun : [];
const commandExitCodes = {};
const commandDurationsMs = {};
for (let i = 0; i < commandItems.length; i += 1) {
    const key = `cmd${i + 1}`;
    commandExitCodes[key] = safeNumber(commandItems[i]?.exitCode);
    commandDurationsMs[key] = safeNumber(commandItems[i]?.durationMs);
}

const log = {
    schemaVersion: '2.0.0',
    timestamp: iso,
    agentName,
    model: model || '',
    family: family || model || '',
    version: version || model || '',
    inputTokens: computedInputTokens,
    outputTokens: computedOutputTokens,
    totalTokens: computedInputTokens + computedOutputTokens,
    durationMs: computedDurationMs,
    metricsSource: {
        tokens: hasRuntimeTokenMetrics ? 'runtime' : 'estimated-char-4',
        durationMs: computedDurationMs > 0 ? 'runtime' : 'unknown',
    },
    providerRequestId,
    lineage: {
        runId,
        parentRunId: parentRunId || null,
        ticketVersionHash: sha256(userContent),
        gitCommit: runGit(['rev-parse', 'HEAD']) || null,
        gitBranch: runGit(['rev-parse', '--abbrev-ref', 'HEAD']) || null,
    },
    fingerprints: {
        systemPromptHash: sha256(systemPrompt),
        userContentHash: sha256(userContent),
        responseHash: sha256(response),
        inputBytes: bytes(systemPrompt) + bytes(userContent),
        outputBytes: bytes(response),
        snapshotHash: hashDirectory(snapshotFullPath) || null,
    },
    tokenEstimation: {
        method: hasRuntimeTokenMetrics ? 'runtime' : 'chars-div-4-v1',
        promptTokensEstimate,
        completionTokensEstimate,
    },
    toolExecution: {
        commandsRun: commandItems,
        commandExitCodes,
        commandDurationsMs,
        retries: safeNumber(toolTelemetry.retries),
        retryReasons: Array.isArray(toolTelemetry.retryReasons) ? toolTelemetry.retryReasons : [],
    },
    systemPrompt,
    userContent,
    response,
};

const logName = `${stamp}-${agentName}.json`;
const logPath = path.join(logsDir, logName);
fs.writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`, 'utf8');

const statusPath = path.join(logsDir, 'status.json');
const status = {
    ticketId,
    updatedAt: iso,
    lastLog: path.relative(repoRoot, logPath).replace(/\\/g, '/'),
};
fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const resultPath = path.join(logsDir, 'result.json');
let result = {};
if (fs.existsSync(resultPath)) {
    try {
        result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    } catch {
        result = {};
    }
}
result.ticketId = ticketId;
result.updatedAt = iso;
result.logs = result.logs || [];
result.logs.push(path.relative(repoRoot, logPath).replace(/\\/g, '/'));
fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.log(path.relative(repoRoot, logPath).replace(/\\/g, '/'));
