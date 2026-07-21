#!/usr/bin/env node
'use strict';

/**
 * ci-run-analyst.js
 *
 * Runs the Requirement Analyst in CI by calling the GitHub Models API
 * (or any OpenAI-compatible endpoint configured via env vars).
 *
 * Reads the system prompt from .github/agents/requirement-analyst.agent.md,
 * constructs a context prompt from the ticket file and snapshot, calls the AI,
 * and writes tickets/<ticketId>/analysis.json + log entries.
 *
 * Usage:  node scripts/ci-run-analyst.js <ticketId>
 *
 * Required env:
 *   GITHUB_TOKEN or AI_API_KEY  — authentication for the AI endpoint
 *
 * Optional env (override defaults):
 *   QA_AI_MODEL_ENDPOINT  — AI endpoint URL  (default: GitHub Models)
 *   QA_AI_MODEL           — model identifier (default: openai/gpt-4o)
 */

const fs   = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────────

const API_KEY      = process.env.AI_API_KEY || process.env.GITHUB_TOKEN;
const ENDPOINT     = process.env.QA_AI_MODEL_ENDPOINT
  || 'https://models.inference.ai.azure.com/chat/completions';
const MODEL        = process.env.QA_AI_MODEL || 'openai/gpt-4o';
const MAX_RETRIES  = 3;
const RETRY_BASE_MS = 5_000;
const MAX_TOKENS   = 8_192;

// ── Args & paths ─────────────────────────────────────────────────────────────

const [,, ticketId] = process.argv;
if (!ticketId) {
  console.error('Usage: node scripts/ci-run-analyst.js <ticketId>');
  process.exit(1);
}
if (!API_KEY) {
  console.error('GITHUB_TOKEN or AI_API_KEY is required.');
  process.exit(1);
}

const repoRoot    = path.resolve(__dirname, '..');
const ticketDir   = path.join(repoRoot, 'tickets', ticketId);
const snapshotDir = path.join(ticketDir, 'snapshot');
const logsDir     = path.join(ticketDir, 'logs');
const agentFile   = path.join(repoRoot, '.github', 'agents', 'requirement-analyst.agent.md');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

/** Strip YAML frontmatter (--- ... ---) from an agent .md file. */
function extractSystemPrompt(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.replace(/^---[\s\S]*?---\s*\n/, '').trim();
}

/** Call the AI endpoint with exponential-backoff retry. */
async function callAI(systemPrompt, userPrompt) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt   },
          ],
          temperature: 0.1,
          max_tokens:  MAX_TOKENS,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 400)}`);
      }

      const data = await res.json();
      return data.choices[0].message.content;
    } catch (err) {
      lastErr = err;
      const delay = RETRY_BASE_MS * attempt;
      console.warn(`[ci-run-analyst] Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        console.warn(`[ci-run-analyst] Retrying in ${delay / 1000}s…`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

/** Extract a JSON object from raw text (handles markdown fences). */
function parseJSON(raw) {
  try { return JSON.parse(raw); } catch { /* fall through */ }
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) {
    try { return JSON.parse(m[1].trim()); } catch { /* fall through */ }
  }
  const obj = raw.match(/\{[\s\S]*\}/);
  if (obj) return JSON.parse(obj[0]);
  throw new Error(`Cannot extract JSON. First 500 chars:\n${raw.slice(0, 500)}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const ticketContent = readSafe(path.join(ticketDir, 'ticket.md'));
  if (!ticketContent.trim()) {
    throw new Error(`ticket.md not found or empty: ${ticketDir}/ticket.md`);
  }

  const snapshotMd  = readSafe(path.join(snapshotDir, 'snapshot.md'));
  const metaJson    = readSafe(path.join(snapshotDir, 'meta.json'));
  const consoleLog  = readSafe(path.join(snapshotDir, 'console.log'));
  const hasSnapshot = snapshotMd.trim().length > 0;

  const systemPrompt = extractSystemPrompt(agentFile);

  const userPrompt = [
    `You are running in CI. Analyze this ticket: ${ticketId}`,
    '',
    '## Ticket Content',
    ticketContent,
    '',
    hasSnapshot
      ? `## Page Snapshot (Accessibility Tree)\n${snapshotMd}`
      : '## Snapshot\nNot available — set snapshotRef to null.',
    metaJson   ? `\n## Page Metadata\n${metaJson}`   : '',
    consoleLog ? `\n## Console Log\n${consoleLog}`   : '',
    '',
    '---',
    'IMPORTANT INSTRUCTIONS FOR CI MODE:',
    '- Output ONLY valid JSON that matches the analysis schema. No prose.',
    `- Set "ticketId" to "${ticketId}".`,
    `- Set "snapshotRef" to ${hasSnapshot ? `"tickets/${ticketId}/snapshot"` : 'null'}.`,
    '- Do NOT invent business rules, error messages, or field constraints not in the ticket.',
  ].join('\n');

  console.log(`[ci-run-analyst] Model: ${MODEL}`);
  console.log(`[ci-run-analyst] Snapshot available: ${hasSnapshot}`);
  console.log(`[ci-run-analyst] Calling AI for ${ticketId}…`);

  const raw      = await callAI(systemPrompt, userPrompt);
  const analysis = parseJSON(raw);

  // Ensure ticketId is set
  if (!analysis.ticketId) analysis.ticketId = ticketId;

  fs.mkdirSync(ticketDir, { recursive: true });
  const analysisPath = path.join(ticketDir, 'analysis.json');
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2), 'utf8');

  console.log(`[ci-run-analyst] Saved: ${analysisPath}`);
  console.log(`[ci-run-analyst] Scenarios: ${analysis.scenarios?.length ?? 0}`);

  // ── Write log entries ──────────────────────────────────────────────────────
  fs.mkdirSync(logsDir, { recursive: true });

  const now    = new Date();
  const ts     = now.toISOString();
  const tsFile = ts.replace(/[:.]/g, '-');

  const logEntry = {
    timestamp: ts,
    agent:     'requirement-analyst',
    mode:      'ci',
    ticketId,
    model:     MODEL,
    endpoint:  ENDPOINT,
    scenarioCount: analysis.scenarios?.length ?? 0,
    hasSnapshot,
    runId:  process.env.GITHUB_RUN_ID    || null,
    runUrl: process.env.GITHUB_SERVER_URL
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null,
  };

  fs.writeFileSync(
    path.join(logsDir, `${tsFile}-requirement-analyst.json`),
    JSON.stringify(logEntry, null, 2),
    'utf8',
  );

  // status.json — update requirement-analyst entry
  const statusPath = path.join(logsDir, 'status.json');
  const status = (() => {
    try { return JSON.parse(fs.readFileSync(statusPath, 'utf8')); } catch { return {}; }
  })();
  status['requirement-analyst'] = { status: 'completed', timestamp: ts, mode: 'ci' };
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2), 'utf8');
}

main().catch(err => {
  console.error('[ci-run-analyst] FATAL:', err.message);
  process.exit(1);
});
