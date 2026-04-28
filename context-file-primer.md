# Tess Buddy — Context File (.md) Primer

## What this is for

Tess Buddy is a React app that helps performing arts organizations manage their Tessitura CRM. We're building an AI-powered "Build a Segment" feature where end users describe a segment in plain language, Claude generates the SQL, and the app creates the list in Tessitura.

The .md context files are what get sent to Claude as the **system prompt** with every API call. They tell Claude everything it needs to know to generate correct, usable SQL for Tessitura segments. Without these files, Claude is guessing blindly.

---

## How the system works

### Architecture

```
React App (BuildSegment.js)
  → sends user's plain-language request to /api/claude (Vercel serverless proxy)
    → proxy loads the .md context file as the system prompt
    → sends to Claude API (claude-sonnet-4-20250514)
    → Claude returns JSON: { summary, sql, refinement_question }
  → React app shows the human-readable summary to the user
  → user approves → app inserts into T_LIST via stored procedure
```

### The proxy (/api/claude.js)

The proxy accepts three things from the frontend:
- `systemPrompt` — the full .md context file contents (this is what you're building)
- `userMessage` — what the end user typed
- `conversationHistory` — previous messages for multi-turn conversations

### Claude's expected response format

Claude is instructed to return **only valid JSON** in this exact shape:

```json
{
  "summary": "Human-readable description of the segment for non-technical users. No SQL, no table names.",
  "sql": "The SQL query to be stored in T_LIST and executed by Tessitura.",
  "refinement_question": "If the request is ambiguous, ask a clarifying question here. null if clear enough."
}
```

If `refinement_question` is set, `sql` should be null — Claude asks before guessing.

---

## What the .md context file needs to contain

### 1. Role & behavior instructions

Tell Claude it's a Tessitura segment builder. Define the response format (JSON). Tell it when to ask clarifying questions vs. when to generate SQL.

### 2. T_LIST table structure

The SQL Claude generates gets stored in a column in T_LIST. Document:
- Which column holds the query
- What other columns need values (description, category, etc.)
- Any constraints or required fields
- The "Tess Buddy" list category (all segments built by this tool go into this category)

### 3. Available tables and views

Claude needs to know what it can SELECT from. For each table/view:
- Table/view name
- Key columns with data types
- What the table represents in business terms
- Join relationships (foreign keys)

Priority tables (likely needed for most segments):
- Customer/constituent tables
- Contribution/donation tables
- Ticket order / attendance tables
- Membership tables
- Contact information tables
- Any commonly-used views that simplify queries

### 4. SQL patterns and examples

Concrete examples are the most important part. Include:
- 3-5 example segments with the plain-language description AND the correct SQL
- Common WHERE clause patterns (date ranges, amount thresholds, counts)
- How to handle "in the last X months" type requests
- Any Tessitura-specific SQL quirks (custom functions, date handling, etc.)

Example format:
```
**Request:** "Everyone who donated over $500 in the last 12 months"
**SQL:**
SELECT DISTINCT customer_no
FROM T_CONTRIBUTION
WHERE gift_amt >= 500
  AND gift_date >= DATEADD(MONTH, -12, GETDATE())
```

### 5. Business rules and gotchas

- What does "active customer" mean in your Tessitura instance?
- Are there test/dummy records to exclude?
- Any standard filters that should always be applied?
- Terminology mapping (what does "subscriber" mean? "patron"? "member"?)
- Season definitions (date ranges for current/past seasons)

### 6. SQL dialect

Tessitura runs on SQL Server (T-SQL). Remind Claude to use:
- `GETDATE()` not `NOW()`
- `DATEADD()` / `DATEDIFF()` for date math
- `TOP` not `LIMIT`
- Square bracket escaping for reserved words: `[order]`

---

## Future: Multiple context files with caching

Right now there's one context file for the segment builder. Eventually we'll have multiple .md files for different AI features across the app. Each page will pass a `contextId` (like `"segments"`) and the proxy will load the matching .md file.

Claude's API supports **prompt caching** — the large system prompt gets cached after the first call, and subsequent calls reuse it at ~10% of the cost. This will be wired up once the .md files are ready.

The planned structure:
```
/contexts/
  segments.md     ← segment builder context (this is what you're building first)
  donations.md    ← future: donation analysis
  events.md       ← future: event/attendance queries
```

---

## What's already built and working

- **React page:** Two-tab layout (Build tab with chat UI + My Segments tab showing Tess Buddy lists)
- **Claude proxy:** `/api/claude.js` — Vercel serverless function, API key is server-side
- **Chat interface:** Full conversation with typing indicators, approve/refine workflow
- **Tessitura connection:** The app already talks to Tessitura's REST API and Web API for other features
- **API confirmed working:** Claude responds through the proxy (tested with a hello message)

## What's NOT built yet (waiting on context file)

- The stored procedure to INSERT into T_LIST
- The `handleApprove` function that calls the stored proc after user approves
- Prompt caching in the proxy
- Usage tracking (Supabase table for billing — Claude tokens, Melissa calls, merge count per org)

---

## Current placeholder system prompt

This is what Claude gets right now (it's a placeholder). Your .md file will replace this entirely:

```
You are a Tessitura CRM segment builder assistant for a performing arts organization.

When a user describes a segment they want to build, you must respond with EXACTLY this JSON format and nothing else:

{
  "summary": "A clear, human-readable description of who will be in this segment and what criteria are being used. Write this for a non-technical user — no SQL, no table names.",
  "sql": "The SQL query that defines this segment. This will be stored in T_LIST and executed by Tessitura.",
  "refinement_question": "Optional — if the user's request is ambiguous, ask a clarifying question here instead of guessing. Set to null if the request is clear enough to generate SQL."
}

IMPORTANT RULES:
- If the request is clear, generate the SQL and summary. Set refinement_question to null.
- If the request is ambiguous (e.g., "recent donors" — how recent?), set sql to null and use refinement_question to ask for clarification.
- Always respond with valid JSON only. No markdown, no explanation outside the JSON.
- The summary should be conversational and easy to understand.
```

---

## Deliverable

A single `.md` file (e.g., `segments.md`) that can be dropped into the project's `/contexts/` folder and loaded as Claude's system prompt. It should be self-contained — everything Claude needs to generate correct Tessitura segment SQL.

Keep in mind that this file gets sent with every API call, so be thorough but not wasteful. Focus on the information Claude actually needs to write correct SQL, not general Tessitura documentation.
