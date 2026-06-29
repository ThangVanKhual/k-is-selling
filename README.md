# Book order platform (skill)

## What this is

An **agent skill**: short instructions an AI assistant reads when building a **book order stack**—a small **API** (orders, admin, uploads) plus a **web storefront** (order form, receipt lookup, gated downloads via **signed URLs** from private storage, minimal admin). The reference design uses **human-checked** payment proof by default; you can still ask the agent to add **automated payments** (Stripe, webhooks, etc.) in your prompt.

The full spec is in **`SKILL.md`**. Skills here follow the shared **[Agent Skills](https://agentskills.io/specification)** shape (`SKILL.md` with YAML frontmatter); each product decides **where** it loads them from.

---

## How to use this skill (by product)

Copy the whole **`book-order-platform`** folder (keep `SKILL.md` inside it). The frontmatter **`name`** is `book-order-platform`; the **`description`** is what drives automatic matching—tune it if triggers feel too broad or too narrow.

### Cursor

| | |
| --- | --- |
| **Where to put it** | **Project:** `.cursor/skills/book-order-platform/` (recommended—commit with the repo). **User (all projects):** `~/.cursor/skills/book-order-platform/`. Cursor also documents `.agents/skills/` for some setups—see their page. |
| **How it runs** | The agent can apply the skill when your request matches its **description**. You can also steer explicitly, e.g. *“Implement the book-order-platform skill”* or attach **`SKILL.md`** in chat if your UI supports file/skill context. |
| **Docs** | [Agent Skills (Cursor)](https://cursor.com/docs/context/skills) |

### Claude Code

| | |
| --- | --- |
| **Where to put it** | **Project:** `.claude/skills/book-order-platform/`. **Personal (all projects):** `~/.claude/skills/book-order-platform/`. Nested `packages/.../.claude/skills/` is supported in monorepos. |
| **How it runs** | **Explicit:** slash command from the skill **`name`** → `/book-order-platform` (optional path or hint after it). **Implicit:** ask in natural language; Claude loads the skill when the **description** fits. Edits to `SKILL.md` are picked up without restart in normal cases; creating a *new* top-level skills directory may need a restart. |
| **Docs** | [Extend Claude with skills](https://code.claude.com/docs/en/skills) |

### Codex (CLI, IDE extension, app)

| | |
| --- | --- |
| **Where to put it** | Codex discovers skills under **`.agents/skills/`** (from your current working directory up to the **git repo root**, plus **`~/.agents/skills/`** for user-wide). Copy this folder to e.g. **`<repo>/.agents/skills/book-order-platform/`** (not only `.cursor/skills/`, unless your team symlink or duplicate). |
| **How it runs** | **Explicit:** use **`/skills`** or **`$`** (skill mention) in the UI/CLI and choose the skill. **Implicit:** Codex may activate it when the task matches the **description**. If a new skills folder does not show up, restart Codex. |
| **Docs** | [Agent Skills (Codex)](https://developers.openai.com/codex/skills/) |

---

## Sharing and customizing

- **Share** the `book-order-platform` directory (this README is optional).
- **Customize** by editing **`SKILL.md`** (routes, env vars, storage choice). Keep **`name`** and **`description`** accurate after edits.

No npm install is required—only these files.
