# Sales rep documentation

User-facing guides for field sales reps live in the **Creativ Energy knowledge base**, hosted on Mintlify.

| Resource | URL |
|----------|-----|
| Knowledge base (web) | https://creativenergy.mintlify.app |
| Sales rep guides | https://creativenergy.mintlify.app/sales |
| MCP endpoint (AI search) | https://creativenergy.mintlify.app/mcp |

## Source files in this repo

Markdown/MDX sources are kept under `mintlify/` so they stay versioned with the app:

```
mintlify/
  docs.json          # Mintlify navigation (Sales reps + MCP groups)
  mcp.mdx            # How to connect AI assistants to the knowledge base
  sales/
    index.mdx
    getting-started.mdx
    appointment-workflow.mdx
    calculator-and-pricing.mdx
    survey-signing-contracts.mdx
    opportunities-and-dashboard.mdx
    troubleshooting.mdx
```

Deploy these files through your Mintlify project dashboard (or Git sync) so they appear on the live site and in MCP search results.

## Sync from live Mintlify

After publishing on Mintlify, pull the latest content into the repo:

```bash
npm run sync:mintlify
```

This calls `query_docs_filesystem_creativ_energy` on the hosted MCP server and writes MDX under `mintlify/`. Override the endpoint with:

```bash
MCP_URL=https://creativenergy.mintlify.app/mcp npm run sync:mintlify
```

## MCP for AI assistants

Cursor users: `.cursor/mcp.json` in this repo points at the knowledge base MCP server. See [mintlify/mcp.mdx](../mintlify/mcp.mdx) for tool names, example prompts, and workflow.

### Tools exposed by Mintlify

| Tool | Purpose |
|------|---------|
| `search_creativ_energy` | Semantic search — titles, links, excerpts |
| `query_docs_filesystem_creativ_energy` | Read pages (`cat`, `head`), grep (`rg`), explore structure (`tree`, `ls`) |

## In-app link

**Profile → Support & Help** opens the knowledge base in the browser (`https://creativenergy.mintlify.app/sales`).

## Adding or updating guides

1. Edit or add `.mdx` files under `mintlify/sales/`
2. Register new pages in `mintlify/docs.json` navigation
3. Publish to Mintlify
4. Optionally run `npm run sync:mintlify` to confirm the live site matches

Keep language practical and step-oriented — sales reps use these during appointments on tablets and laptops.
