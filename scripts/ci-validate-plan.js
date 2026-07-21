#!/usr/bin/env node
'use strict';

/**
 * ci-validate-plan.js
 *
 * Required status check — validates the structure and traceability of QA
 * artifacts in every PR that touches tickets/.
 *
 * Exit codes:
 *   0 — all checks passed (warnings are allowed)
 *   1 — one or more errors found (PR must not merge)
 *
 * Checks per changed ticket:
 *   ❌ ERROR   — ticket.md missing
 *   ❌ ERROR   — analysis.json missing
 *   ❌ ERROR   — analysis.json not valid JSON
 *   ❌ ERROR   — required fields missing (ticketId, feature, scenarios)
 *   ❌ ERROR   — scenarios array is empty
 *   ⚠️  WARNING — snapshotRef not set (traceability gap)
 *   ⚠️  WARNING — no .spec.ts files in generated/ (tests not yet produced)
 *   ⚠️  WARNING — approved-analysis.json not found (human sign-off pending)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const ticketsDir = path.join(repoRoot, 'tickets');

let errors = 0;
let warnings = 0;

function err(msg) { console.error(`❌  ${msg}`); errors++; }
function warn(msg) { console.warn(`⚠️   ${msg}`); warnings++; }
function ok(msg) { console.log(`✅  ${msg}`); }

// ── Find changed ticket directories ──────────────────────────────────────────

function getChangedTickets() {
    const baseRef = process.env.GITHUB_BASE_REF || 'main';
    try {
        const diff = execSync(
            `git diff --name-only origin/${baseRef}...HEAD`,
            { encoding: 'utf8', cwd: repoRoot, stdio: ['pipe', 'pipe', 'pipe'] },
        );
        const ids = new Set(
            diff.split('\n')
                .filter(f => f.startsWith('tickets/'))
                .map(f => f.split('/')[1])
                .filter(Boolean),
        );
        return [...ids];
    } catch {
        // Fallback: validate all ticket directories
        console.warn('⚠️   Could not determine changed files — validating all tickets.\n');
        if (!fs.existsSync(ticketsDir)) return [];
        return fs.readdirSync(ticketsDir)
            .filter(d => fs.statSync(path.join(ticketsDir, d)).isDirectory());
    }
}

// ── Validation logic ──────────────────────────────────────────────────────────

function validateTicket(ticketId) {
    console.log(`\n── Validating ${ticketId} ${'─'.repeat(Math.max(0, 50 - ticketId.length))}`);
    const dir = path.join(ticketsDir, ticketId);

    if (!fs.existsSync(dir)) {
        err(`${ticketId}: ticket directory not found`);
        return;
    }

    // 1. ticket.md
    if (!fs.existsSync(path.join(dir, 'ticket.md'))) {
        err(`${ticketId}: ticket.md is missing`);
    } else {
        ok(`${ticketId}: ticket.md exists`);
    }

    // 2. analysis.json exists
    const analysisPath = path.join(dir, 'analysis.json');
    if (!fs.existsSync(analysisPath)) {
        err(`${ticketId}: analysis.json is missing`);
        return; // Can't continue without it
    }
    ok(`${ticketId}: analysis.json exists`);

    // 3. Valid JSON
    let analysis;
    try {
        analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
    } catch (e) {
        err(`${ticketId}: analysis.json is not valid JSON — ${e.message}`);
        return;
    }
    ok(`${ticketId}: analysis.json is valid JSON`);

    // 4. Required fields
    const required = ['ticketId', 'feature', 'scenarios'];
    for (const field of required) {
        if (analysis[field] === undefined || analysis[field] === null) {
            err(`${ticketId}: analysis.json is missing required field "${field}"`);
        } else {
            ok(`${ticketId}: field "${field}" present`);
        }
    }

    // 5. Non-empty scenarios
    if (!Array.isArray(analysis.scenarios) || analysis.scenarios.length === 0) {
        err(`${ticketId}: analysis.json has no scenarios`);
    } else {
        ok(`${ticketId}: ${analysis.scenarios.length} scenario(s) defined`);
    }

    // 6. snapshotRef traceability
    if (!analysis.snapshotRef) {
        warn(`${ticketId}: snapshotRef is null or missing — no page evidence linked`);
    } else {
        ok(`${ticketId}: snapshotRef → ${analysis.snapshotRef}`);
    }

    // 7. Generated spec files
    const generatedDir = path.join(dir, 'generated');
    if (!fs.existsSync(generatedDir)) {
        warn(`${ticketId}: generated/ directory not found — Playwright Generator not yet run`);
    } else {
        const specs = fs.readdirSync(generatedDir).filter(f => f.endsWith('.spec.ts'));
        if (specs.length === 0) {
            warn(`${ticketId}: no .spec.ts files found in generated/`);
        } else {
            ok(`${ticketId}: ${specs.length} spec file(s) — ${specs.join(', ')}`);
        }
    }

    // 8. Human sign-off (approved-analysis.json)
    if (!fs.existsSync(path.join(dir, 'approved-analysis.json'))) {
        warn(`${ticketId}: approved-analysis.json not found — human review pending`);
    } else {
        ok(`${ticketId}: approved-analysis.json exists (human-approved)`);
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

const changed = getChangedTickets();

if (changed.length === 0) {
    console.log('No ticket directories changed — nothing to validate.');
    process.exit(0);
}

console.log(`Validating ${changed.length} ticket(s): ${changed.join(', ')}\n`);
for (const id of changed) validateTicket(id);

console.log(`\n${'═'.repeat(55)}`);
console.log(`Result: ${errors} error(s), ${warnings} warning(s)`);
if (errors > 0) {
    console.error('\nValidation FAILED — resolve errors before merging.');
    process.exit(1);
} else {
    console.log('\nValidation PASSED.');
}
