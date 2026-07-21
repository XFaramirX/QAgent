#!/usr/bin/env node
'use strict';

/**
 * ci-create-ticket.js
 *
 * Scaffolds tickets/<TICKET_ID>/ticket.md from the GitHub issue body.
 * Called by the 'setup' job in issue-to-qa.yml.
 *
 * Required env vars:
 *   TICKET_ID    — e.g. QA-007
 *   ISSUE_TITLE  — GitHub issue title
 *   ISSUE_BODY   — GitHub issue body (markdown)
 *   TARGET_URL   — extracted target URL (may be empty)
 *   ISSUE_NUMBER — GitHub issue number
 */

const fs = require('fs');
const path = require('path');

const { TICKET_ID, ISSUE_TITLE, ISSUE_BODY, TARGET_URL, ISSUE_NUMBER } = process.env;

if (!TICKET_ID) {
    console.error('TICKET_ID environment variable is required.');
    process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const ticketDir = path.join(repoRoot, 'tickets', TICKET_ID);

fs.mkdirSync(ticketDir, { recursive: true });

const url = (TARGET_URL || '').trim() || 'TBD';

// Build a clean ticket.md in the canonical format expected by the agents.
const content = [
    `# ${TICKET_ID}: ${(ISSUE_TITLE || '').trim()}`,
    '',
    `Target URL: ${url}`,
    '',
    '## Description',
    '',
    (ISSUE_BODY || '').trim(),
    '',
    '## Acceptance Criteria',
    '',
    '<!-- Extracted by Requirement Analyst from the Description above -->',
    '',
    '---',
    `_Auto-scaffolded from GitHub issue #${ISSUE_NUMBER || '?'}_`,
].join('\n');

const ticketFile = path.join(ticketDir, 'ticket.md');
fs.writeFileSync(ticketFile, content, 'utf8');
console.log(`Created: ${ticketFile}`);
