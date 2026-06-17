#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const [, , ticketId] = process.argv;
if (!ticketId) {
    console.error('Usage: node scripts/sync-ticket-result.js <ticketId>');
    process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const ticketRoot = path.join(repoRoot, 'tickets', ticketId);
const logsDir = path.join(ticketRoot, 'logs');
const resultsSummaryPath = path.join(ticketRoot, 'results', 'summary.json');

fs.mkdirSync(logsDir, { recursive: true });

const resultPath = path.join(logsDir, 'result.json');
let result = {
    ticketId,
    updatedAt: new Date().toISOString(),
    testSummary: null,
    logs: [],
};

if (fs.existsSync(resultPath)) {
    try {
        result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    } catch {
        result = {
            ticketId,
            updatedAt: new Date().toISOString(),
            testSummary: null,
            logs: [],
        };
    }
}

if (fs.existsSync(resultsSummaryPath)) {
    try {
        result.testSummary = JSON.parse(fs.readFileSync(resultsSummaryPath, 'utf8'));
    } catch {
        result.testSummary = null;
    }
}

const allLogs = fs
    .readdirSync(logsDir)
    .filter((name) => name.endsWith('.json') && name !== 'result.json' && name !== 'status.json')
    .sort()
    .map((name) => `tickets/${ticketId}/logs/${name}`);

result.ticketId = ticketId;
result.updatedAt = new Date().toISOString();
result.logs = allLogs;

fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(`tickets/${ticketId}/logs/result.json`);
