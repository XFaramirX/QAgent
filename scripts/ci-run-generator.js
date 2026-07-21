#!/usr/bin/env node
'use strict';

/**
 * ci-run-generator.js
 *
 * Runs the Playwright Generator in CI by calling the GitHub Models API
 * (or any OpenAI-compatible endpoint configured via env vars).
 *
 * Reads the system prompt from .github/agents/playwright-generator.agent.md,
 * builds a context prompt from analysis.json and the snapshot, calls the AI,
 * extracts TypeScript code blocks, and writes spec files to
 * tickets/<ticketId>/generated/.
 *
 * Also copies analysis.json → approved-analysis.json (CI auto-approval;
 * the PR review is the human gate).
 *
 * Usage:  node scripts/ci-run-generator.js <ticketId>
 *
 * Required env:
 *   GITHUB_TOKEN or AI_API_KEY
 *
 * Optional env:
 *   QA_AI_MODEL_ENDPOINT  — AI endpoint URL  (default: GitHub Models)
 *   QA_AI_MODEL           — model identifier (default: openai/gpt-4o)
 */

const fs   = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────────────────────────

const API_KEY       = process.env.AI_API_KEY || process.env.GITHUB_TOKEN;
const ENDPOINT      = process.env.QA_AI_MODEL_ENDPOINT
  || 'https://models.inference.ai.azure.com/chat/completions';
const MODEL         = process.env.QA_AI_MODEL || 'openai/gpt-4o';
const MAX_RETRIES   = 3;
const RETRY_BASE_MS = 5_000;
const MAX_TOKENS    = 8_192;
// Limit HTML to avoid exceeding context window
const MAX_HTML_CHARS = 6_000;

// ── Args & paths ─────────────────────────────────────────────────────────────

const [,, ticketId] = process.argv;
if (!ticketId) {
  console.error('Usage: node scripts/ci-run-generator.js <ticketId>');
  process.exit(1);
}
if (!API_KEY) {
  console.error('GITHUB_TOKEN or AI_API_KEY is required.');
  process.exit(1);
}

const repoRoot     = path.resolve(__dirname, '..');
const ticketDir    = path.join(repoRoot, 'tickets', ticketId);
const snapshotDir  = path.join(ticketDir, 'snapshot');
const generatedDir = path.join(ticketDir, 'generated');
const logsDir      = path.join(ticketDir, 'logs');
const agentFile    = path.join(repoRoot, '.github', 'agents', 'playwright-generator.agent.md');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function extractSystemPrompt(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.replace(/^---[\s\S]*?---\s*\n/, '').trim();
}

async function callAI(systemPrompt, userPrompt) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt   },
          ],
          temperature: 0.1,
          max_tokens:  MAX_TOKENS,
          // Do NOT request json_object format here — response contains TypeScript
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
      console.warn(`[ci-run-generator] Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        console.warn(`[ci-run-generator] Retrying in ${delay / 1000}s…`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

/** Extract the first ```typescript (or ```ts) block from the AI response. */
function extractTypeScriptBlock(raw) {
  const re = /```(?:typescript|ts)\s*\n([\s\S]*?)```/g;
  const blocks = [];
  let m;
  while ((m = re.exec(raw)) !== null) blocks.push(m[1].trim());
  if (blocks.length > 0) return blocks[0];

  // Fallback: try any code block
  const fb = raw.match(/```\s*\n([\s\S]*?)```/);
  if (fb) return fb[1].trim();

  throw new Error('No TypeScript code block found in generator response.');
}

/** Extract the JSON summary block if present (non-fatal). */
function extractJSONSummary(raw) {
  const m = raw.match(/```json\s*\n([\s\S]*?)```/);
  if (!m) return null;
  try { return JSON.parse(m[1].trim()); } catch { return null; }
}

/** Make a safe filename slug from a string. */
function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const analysisPath = path.join(ticketDir, 'analysis.json');
  if (!fs.existsSync(analysisPath)) {
    throw new Error(`analysis.json not found: ${analysisPath}`);
  }

  const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

  // Auto-approve for CI (PR review is the human gate)
  const approvedPath = path.join(ticketDir, 'approved-analysis.json');
  if (!fs.existsSync(approvedPath)) {
    fs.copyFileSync(analysisPath, approvedPath);
    console.log('[ci-run-generator] Copied analysis.json → approved-analysis.json (CI auto-approve)');
  }

  const snapshotMd  = readSafe(path.join(snapshotDir, 'snapshot.md'));
  const metaJson    = readSafe(path.join(snapshotDir, 'meta.json'));
  const pageHtml    = readSafe(path.join(snapshotDir, 'page.html')).slice(0, MAX_HTML_CHARS);
  const hasSnapshot = snapshotMd.trim().length > 0;

  const systemPrompt = extractSystemPrompt(agentFile);

  // Derive spec filename
  const featureSlug = slugify(analysis.feature || ticketId);
  const specFileName = `${ticketId.toLowerCase()}-${featureSlug}.spec.ts`;

  const userPrompt = [
    `You are running in CI. Generate Playwright TypeScript tests for ticket: ${ticketId}`,
    `Target spec file: tickets/${ticketId}/generated/${specFileName}`,
    '',
    '## Approved Analysis JSON',
    JSON.stringify(analysis, null, 2),
    '',
    hasSnapshot
      ? `## Page Snapshot — Accessibility Tree (SOURCE OF TRUTH for locators)\n${snapshotMd}`
      : '## Snapshot\nNot available — use best-effort locators and add // TODO comments.',
    metaJson  ? `\n## Page Metadata\n${metaJson}`                          : '',
    pageHtml  ? `\n## Page HTML (locator reference — truncated)\n${pageHtml}` : '',
    '',
    '---',
    'INSTRUCTIONS FOR CI MODE:',
    '1. Output the complete runnable spec file inside a ```typescript ... ``` block.',
    '2. After the code block, output a JSON summary inside a ```json ... ``` block:',
    '   { "specFile": "<path>", "testCount": <n>, "scenarios": ["..."] }',
    '3. Follow all grounding, locator, and code rules from your system instructions.',
  ].join('\n');

  console.log(`[ci-run-generator] Model: ${MODEL}`);
  console.log(`[ci-run-generator] Snapshot available: ${hasSnapshot}`);
  console.log(`[ci-run-generator] Calling AI for ${ticketId}…`);

  const raw         = await callAI(systemPrompt, userPrompt);
  const specCode    = extractTypeScriptBlock(raw);
  const jsonSummary = extractJSONSummary(raw);

  fs.mkdirSync(generatedDir, { recursive: true });
  const specPath = path.join(generatedDir, specFileName);
  fs.writeFileSync(specPath, specCode, 'utf8');

  console.log(`[ci-run-generator] Saved spec: ${specPath}`);
  if (jsonSummary) {
    console.log(`[ci-run-generator] Test count: ${jsonSummary.testCount ?? 'unknown'}`);
  }

  // ── Write log entries ──────────────────────────────────────────────────────
  fs.mkdirSync(logsDir, { recursive: true });

  const now    = new Date();
  const ts     = now.toISOString();
  const tsFile = ts.replace(/[:.]/g, '-');

  const logEntry = {
    timestamp: ts,
    agent:     'playwright-generator',
    mode:      'ci',
    ticketId,
    model:     MODEL,
    endpoint:  ENDPOINT,
    specFile:  `tickets/${ticketId}/generated/${specFileName}`,
    testCount: jsonSummary?.testCount ?? null,
    hasSnapshot,
    runId:  process.env.GITHUB_RUN_ID    || null,
    runUrl: process.env.GITHUB_SERVER_URL
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null,
  };

  fs.writeFileSync(
    path.join(logsDir, `${tsFile}-playwright-generator.json`),
    JSON.stringify(logEntry, null, 2),
    'utf8',
  );

  const statusPath = path.join(logsDir, 'status.json');
  const status = (() => {
    try { return JSON.parse(fs.readFileSync(statusPath, 'utf8')); } catch { return {}; }
  })();
  status['playwright-generator'] = {
    status:   'completed',
    timestamp: ts,
    mode:     'ci',
    specFile: specFileName,
  };
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2), 'utf8');
}

main().catch(err => {
  console.error('[ci-run-generator] FATAL:', err.message);
  process.exit(1);
});
