#!/usr/bin/env node
/**
 * Pull published Mintlify page content via the hosted MCP server and write
 * MDX files under mintlify/.
 *
 * Usage: node scripts/sync-mintlify-from-mcp.mjs
 * Optional: MCP_URL=https://creativenergy.mintlify.app/mcp node scripts/sync-mintlify-from-mcp.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MCP_URL = process.env.MCP_URL ?? 'https://creativenergy.mintlify.app/mcp';
const DOCS_FS_TOOL = 'query_docs_filesystem_knowledge_base';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'mintlify');

async function mcpCall(method, params) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const text = await res.text();
  const dataLine = text.split('\n').find((l) => l.startsWith('data: '));
  if (!dataLine) throw new Error(`No MCP data line in response for ${method}`);
  const payload = JSON.parse(dataLine.slice(6));
  if (payload.error) throw new Error(payload.error.message);
  return payload.result;
}

function parseChunks(raw) {
  const chunks = raw.split(/Title: /).filter(Boolean);
  const sections = [];
  let title = '';
  let description = '';

  for (const chunk of chunks) {
    const titleMatch = chunk.match(/^([^\n]+)/);
    const sectionMatch = chunk.match(/Section: ([^\n]+)/);
    const chunkTitle = titleMatch?.[1]?.trim() ?? '';
    if (!title) title = chunkTitle;

    let body = chunk
      .replace(/^[^\n]+\n/, '')
      .replace(/Breadcrumbs:[^\n]+\n/g, '')
      .replace(/Section: [^\n]+\n/g, '')
      .trim();

    if (sectionMatch) {
      sections.push({ heading: sectionMatch[1].trim(), body: body.replace(sectionMatch[0], '').trim() });
    } else if (body && !body.startsWith(chunkTitle)) {
      description = body.split('\n')[0]?.trim() ?? description;
      if (body.length > (description?.length ?? 0)) {
        sections.push({ heading: null, body });
      }
    }
  }

  return { title, description, sections };
}

function chunksToMdx({ title, description, sections }) {
  const lines = ['---', `title: ${JSON.stringify(title)}`];
  if (description) lines.push(`description: ${JSON.stringify(description.slice(0, 160))}`);
  lines.push('---', '');

  let introWritten = false;
  for (const { heading, body } of sections) {
    if (!body) continue;
    if (heading) {
      lines.push(`## ${heading}`, '', body, '');
    } else if (!introWritten) {
      lines.push(body, '');
      introWritten = true;
    } else {
      lines.push(body, '');
    }
  }

  return lines.join('\n').trim() + '\n';
}

function extractStdout(raw) {
  return raw.includes('--- stdout ---') ? raw.split('--- stdout ---')[1]?.trim() ?? raw : raw;
}

async function listMdxFiles() {
  const result = await mcpCall('tools/call', {
    name: DOCS_FS_TOOL,
    arguments: { command: 'find / -name "*.mdx" | sort' },
  });
  const raw = extractStdout(result.content?.[0]?.text ?? '');
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.endsWith('.mdx') && l.startsWith('/'))
    .map((p) => p.slice(1));
}

async function syncFile(relativePath) {
  const result = await mcpCall('tools/call', {
    name: DOCS_FS_TOOL,
    arguments: { command: `cat /${relativePath}` },
  });
  const raw = extractStdout(result.content?.[0]?.text ?? '');
  const parsed = parseChunks(raw);
  const mdx = chunksToMdx(parsed);
  const outPath = join(OUT_DIR, relativePath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, mdx, 'utf8');
  return outPath;
}

async function main() {
  console.log(`Syncing from ${MCP_URL} -> ${OUT_DIR}`);
  const files = await listMdxFiles();
  console.log(`Found ${files.length} pages on live Mintlify`);
  let ok = 0;
  for (const file of files) {
    try {
      const out = await syncFile(file);
      console.log(`  ok ${file} -> ${out.replace(ROOT + '/', '')}`);
      ok += 1;
    } catch (err) {
      console.error(`  fail ${file}: ${err.message}`);
    }
  }
  console.log(`Done: ${ok}/${files.length} pages written`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
