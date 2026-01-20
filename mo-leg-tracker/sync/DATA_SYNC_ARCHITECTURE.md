# Missouri Legislative Data Sync Architecture

## Overview

This document describes the automated data ingestion pipeline for keeping the Missouri Legislative Tracker database synchronized with official state data sources.

## Data Sources

### House of Representatives (XML Feeds)

The Missouri House provides machine-readable XML feeds updated hourly:

| Feed | URL | Purpose |
|------|-----|---------|
| Bill List | `documents.house.mo.gov/xml/261-BillList.XML` | All House bills with basic info |
| Member List | `documents.house.mo.gov/xml/261-MemberList.XML` | Representatives |
| Committee List | `documents.house.mo.gov/xml/261-CommitteeList.XML` | House committees |
| Hearings | `documents.house.mo.gov/xml/261-UpcomingHearingList.XML` | Scheduled hearings |
| Calendar | `documents.house.mo.gov/xml/261-CalendarList.XML` | Floor calendar |
| Bill Detail | `documents.house.mo.gov/xml/261-HB{NUM}.xml` | Individual bill actions |

**Fiscal Note PDFs**: `documents.house.mo.gov/billtracking/bills261/fiscal/fispdf/{LR}.ORG.pdf`

### Senate (HTML Scraping Required)

The Senate does not provide XML feeds. Data must be scraped:

| Resource | URL Pattern | Purpose |
|----------|-------------|---------|
| Bill List | `senate.mo.gov/BillTracking/Bills/BillList?year=2026&session=R` | All Senate bills |
| Bill Detail | `senate.mo.gov/26info/bts_web/Bill.aspx?SessionType=R&BillID={ID}` | Individual bill |
| Actions | `senate.mo.gov/26info/BTS_Web/Actions.aspx?SessionType=R&BillID={ID}` | Bill actions |
| Fiscal Notes | `senate.mo.gov/26info/BTS_Web/FiscalNotes.aspx?SessionType=R&BillID={ID}` | Fiscal notes |
| Senators | `senate.mo.gov/Senators/` | Senator roster |
| Committees | `senate.mo.gov/Committees/CommitteeGroup/{1,2,5,8}` | Committee groups |
| Committee Detail | `senate.mo.gov/Committees/CommitteeDetails/{ID}` | Chair/members |

**HTML Structure (as of 2026):**

Senators page uses `.panel-senator` cards:
```html
<div class="panel-senator">
  <a href="/Senators/Member/{district}">
    <img src="...{Name}{district}.jpg" title="Senator {Name}" />
  </a>
  <div class="senator-Text">
    <strong>Senator {Name}<br />District {number}</strong>
  </div>
</div>
```

Committees are organized by group type:
- Group 1: Standing Committees
- Group 2: Statutory Committees
- Group 5: Select Committees
- Group 8: Task Forces

**Text Files** (easier to parse):
- `senate.mo.gov/bstats/bybill26.txt` - Bills with affected statutes
- `senate.mo.gov/bstats/bystat26.txt` - Statutes with affecting bills

---

## Sync Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SCHEDULER (cron / pm2)                            │
│                    Runs at :05 past each hour                           │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       SYNC ORCHESTRATOR                                  │
│  - Manages sync state                                                   │
│  - Rate limiting (30 min House, 2s Senate)                              │
│  - Error handling & retries                                             │
│  - Logs & monitoring                                                    │
└──────┬─────────────────────────────────────────────────┬────────────────┘
       │                                                 │
       ▼                                                 ▼
┌──────────────────────┐                    ┌──────────────────────────────┐
│   HOUSE XML PARSER   │                    │     SENATE HTML SCRAPER      │
│                      │                    │                              │
│  • XML → JSON        │                    │  • HTML → JSON               │
│  • Schema validation │                    │  • Cheerio parsing           │
│  • Change detection  │                    │  • Text file parsing         │
└──────────┬───────────┘                    └─────────────┬────────────────┘
           │                                              │
           ▼                                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATA TRANSFORMER                                  │
│  - Normalize to graph schema                                            │
│  - Generate IDs (bill:hb1607:261)                                       │
│  - Map statuses to lifecycle stages                                     │
│  - Calculate derived fields                                             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         GRAPH DATABASE                                   │
│  - Merge nodes (upsert)                                                 │
│  - Update edges                                                         │
│  - Maintain indexes                                                     │
│  - Write to graph.json                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Module Structure

```
mo-leg-tracker/
├── sync/
│   ├── DATA_SYNC_ARCHITECTURE.md    # This document
│   ├── index.ts                     # Main orchestrator
│   ├── config.ts                    # Configuration & session codes
│   │
│   ├── sources/
│   │   ├── house-xml-parser.ts      # House XML feed parser
│   │   ├── senate-scraper.ts        # Senate HTML scraper
│   │   └── fiscal-note-parser.ts    # Fiscal note PDF extraction
│   │
│   ├── transformers/
│   │   ├── bill-transformer.ts      # Raw → Graph bill nodes
│   │   ├── member-transformer.ts    # Raw → Graph member nodes
│   │   ├── action-transformer.ts    # Raw → Graph action nodes
│   │   └── fiscal-transformer.ts    # Raw → Graph fiscal nodes
│   │
│   ├── database/
│   │   ├── graph-writer.ts          # Write to graph.json
│   │   ├── merge-strategy.ts        # Upsert logic
│   │   └── change-detector.ts       # Track modifications
│   │
│   └── utils/
│       ├── rate-limiter.ts          # Request throttling
│       ├── retry-handler.ts         # Exponential backoff
│       ├── logger.ts                # Structured logging
│       └── validators.ts            # Schema validation
│
├── db/
│   ├── schema.json                  # Graph schema
│   ├── graph.json                   # Live database
│   └── sync-state.json              # Last sync metadata
```

---

## Sync Process Flow

### 1. Initial Full Sync

Run once to populate the database from scratch:

```bash
npm run sync:full
```

Steps:
1. Fetch all House XML feeds
2. Scrape all Senate bill list pages
3. For each bill, fetch detailed actions
4. Parse available fiscal notes
5. Fetch member and committee data
6. Transform all data to graph format
7. Write complete graph.json

**Estimated time**: 30-60 minutes (rate-limited)

### 2. Incremental Sync

Run hourly to capture changes:

```bash
npm run sync:incremental
```

Steps:
1. Load sync-state.json (last sync timestamps)
2. Fetch House BillList.XML, compare with stored hash
3. For changed/new bills, fetch detailed XML
4. Scrape Senate daily actions page for changes
5. For modified bills, re-fetch details
6. Transform changed records only
7. Merge into existing graph.json
8. Update sync-state.json

**Estimated time**: 2-5 minutes

### 3. Targeted Sync

Sync specific bill(s) on demand:

```bash
npm run sync:bill HB1607 SB834
```

---

## Data Transformations

### Bill Status Mapping

House XML action codes → Graph lifecycle status:

| XML Code | Description | Graph Status |
|----------|-------------|--------------|
| PREF | Prefiled | `prefiled` |
| 1RD | First Read | `first_read` |
| 2RD-REF | Second Read & Referred | `referred` |
| SCHED | Hearing Scheduled | `hearing_scheduled` |
| DP | Do Pass | `reported_do_pass` |
| PERF | Perfected | `perfected` |
| 3RD-P | Third Read & Passed | `passed_origin` |
| S-REC | Received in Senate | `received_other` |
| TATFP | Truly Agreed | `truly_agreed` |
| GOV-S | Signed by Governor | `signed` |
| GOV-V | Vetoed | `vetoed` |

### ID Generation

```typescript
// Bills: bill:{prefix}{suffix}:{session}
"bill:hb1607:261"

// Members: member:{chamber}:{district}
"member:house:001"
"member:senate:14"

// Actions: action:{billId}:{sequence}
"action:hb1607:261:001"

// Fiscal Notes: fiscal:{lrNumber}:{type}
"fiscal:5106H.01I:ORG"
```

### Fiscal Note Extraction

1. **PDF Location**: Build URL from LR number
2. **PDF Parsing**: Use pdf-parse library
3. **Data Extraction**:
   - Extract dollar amounts (regex patterns)
   - Identify fund types (General Revenue, Highway, etc.)
   - Parse fiscal year breakdown tables
   - Extract assumptions section

---

## Rate Limiting Strategy

### House Feeds
- **Limit**: Once per 30 minutes (official guidance)
- **Implementation**: Store last fetch timestamp in sync-state.json
- **Retry**: 4 attempts with exponential backoff (2s, 4s, 8s, 16s)

### Senate Scraping
- **Limit**: 1 request per 2 seconds
- **Implementation**: Request queue with delay
- **Concurrent**: Max 2 parallel requests
- **Retry**: 3 attempts with backoff

```typescript
// Rate limiter configuration
const rateLimits = {
  house: {
    minInterval: 30 * 60 * 1000,  // 30 minutes
    maxRetries: 4,
    backoffBase: 2000
  },
  senate: {
    minInterval: 2000,  // 2 seconds between requests
    maxConcurrent: 2,
    maxRetries: 3,
    backoffBase: 1000
  }
};
```

---

## Change Detection

### Hash-Based Detection

```typescript
interface SyncState {
  lastSync: string;  // ISO timestamp
  feeds: {
    [feedName: string]: {
      lastFetched: string;
      contentHash: string;
      recordCount: number;
    }
  };
  bills: {
    [billId: string]: {
      lastModified: string;
      actionCount: number;
      contentHash: string;
    }
  };
}
```

### Change Log

Maintain `sync-log.jsonl` for audit:

```json
{"timestamp": "2026-01-16T05:05:00Z", "type": "bill_updated", "id": "bill:hb1607:261", "changes": ["status", "lastActionDate"]}
{"timestamp": "2026-01-16T05:05:00Z", "type": "action_added", "id": "action:hb1607:261:004", "billId": "bill:hb1607:261"}
```

---

## Error Handling

### Failure Categories

1. **Network Errors**: Retry with backoff
2. **Parse Errors**: Log and skip record, continue sync
3. **Validation Errors**: Log warning, store raw data for review
4. **Rate Limit Errors (429)**: Pause sync, retry after delay

### Recovery

```typescript
// Partial sync recovery
if (lastSync.incomplete) {
  // Resume from last successful bill
  startFrom = lastSync.lastProcessedBill;
}
```

---

## Monitoring & Alerts

### Metrics to Track

- Sync duration
- Records processed/failed
- Network errors
- New bills detected
- Fiscal notes updated

### Alert Conditions

- Sync fails 3 consecutive times
- No new actions for 24+ hours during session
- Unusual spike in new bills
- Fiscal note parse failures

---

## Scheduled Jobs

```bash
# Crontab configuration

# Incremental sync - Every hour at :05
5 * * * * cd /path/to/mo-leg-tracker && npm run sync:incremental >> logs/sync.log 2>&1

# Full validation - Daily at 3 AM
0 3 * * * cd /path/to/mo-leg-tracker && npm run sync:validate >> logs/validate.log 2>&1

# Fiscal note refresh - Twice daily
0 6,18 * * * cd /path/to/mo-leg-tracker && npm run sync:fiscal >> logs/fiscal.log 2>&1
```

---

## Configuration

### Environment Variables

```bash
# .env.sync
MO_SESSION_CODE=261
MO_SESSION_YEAR=2026

# Rate limits
HOUSE_SYNC_INTERVAL_MS=1800000
SENATE_REQUEST_DELAY_MS=2000

# Paths
GRAPH_DB_PATH=./db/graph.json
SYNC_STATE_PATH=./db/sync-state.json
SYNC_LOG_PATH=./logs/sync-log.jsonl

# Features
ENABLE_FISCAL_PARSE=true
ENABLE_PDF_DOWNLOAD=false
LOG_LEVEL=info
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
- [x] Architecture document
- [x] Configuration module (`config.ts`)
- [x] Rate limiter utility (`utils/rate-limiter.ts`)
- [x] Logger setup (`utils/logger.ts`)

### Phase 2: House XML Parsing
- [x] XML feed fetcher
- [x] Bill list parser
- [x] Bill detail parser (with actions)
- [x] Member/committee parser

### Phase 3: Senate Scraping
- [x] HTML scraper setup (Cheerio)
- [x] Bill list scraper
- [x] Bill detail scraper
- [x] Action parser
- [x] Senator list scraper (`.panel-senator` cards)
- [x] Committee group scraper (`/Committees/CommitteeGroup/{id}`)

### Phase 4: Database Integration
- [x] Graph writer (`database/graph-writer.ts`)
- [x] Merge strategy (upsert)
- [x] Change detection (hash-based)

### Phase 5: Fiscal Notes
- [x] PDF URL builder
- [x] Fiscal note parser (`sources/fiscal-note-parser.ts`)
- [ ] Amount parser (basic implementation)
- [ ] Fund type detection (partial)

### Phase 6: Orchestration
- [x] Full sync command
- [x] Incremental sync command
- [ ] Targeted sync command (partial)
- [x] Scheduler setup (node-cron)

### Phase 7: Event Detection & Notifications
- [x] Event type definitions (14 types)
- [x] Status change detection
- [x] Hearing change detection
- [x] Fiscal note change detection
- [x] Event persistence (JSON store)
- [x] Webhook dispatcher (HMAC signed)
- [x] Retry queue with exponential backoff
- [x] Multi-channel notifications (Email, Slack, Discord, SMS)

### Phase 8: AI Analysis & Semantic Features
- [x] AI provider abstraction (OpenAI/Anthropic)
- [x] PDF text extraction with caching
- [x] Token-aware text chunking
- [x] Bill section parsing
- [x] Semantic diff detection between versions
- [x] Chat API endpoint
- [x] React chat components

---

## Event System Architecture

The sync system now includes comprehensive event detection and notification:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SYNC COMPLETES                                   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      EVENT DETECTOR                                      │
│  Compare previousSnapshot vs currentState                               │
│  • Bill status changes → bill_status_change, passed_committee, etc.    │
│  • Hearing additions/removals → hearing_scheduled, hearing_cancelled   │
│  • Fiscal note changes → fiscal_note_released, fiscal_note_revised     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       EVENT STORE (db/events.json)                       │
│  • Stores last 10,000 events                                            │
│  • Tracks webhook delivery status per event                             │
│  • Supports filtering by type, chamber, severity                        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     WEBHOOK DISPATCHER                                   │
│  • HMAC-SHA256 signed payloads                                          │
│  • Configurable subscriptions with filters                              │
│  • Retry queue with exponential backoff                                 │
└──────┬────────────────┬────────────────┬────────────────┬───────────────┘
       │                │                │                │
       ▼                ▼                ▼                ▼
   ┌───────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
   │ Email │      │  Slack  │      │ Discord │      │   SMS   │
   │SendGrid│     │ Webhook │      │ Webhook │      │ Twilio  │
   └───────┘      └─────────┘      └─────────┘      └─────────┘
```

### Event Types

| Event Type | Severity | Trigger |
|------------|----------|---------|
| `bill_status_change` | medium | Any status transition |
| `hearing_scheduled` | medium | New hearing added |
| `hearing_cancelled` | medium | Hearing status → cancelled |
| `fiscal_note_released` | medium | New fiscal note for bill |
| `fiscal_note_revised` | low | Fiscal note updated |
| `passed_committee` | high | Status → reported_do_pass |
| `passed_chamber` | high | Status → passed_chamber |
| `floor_action` | medium | placed_on_calendar, perfected, third_read |
| `governor_action` | high | signed, vetoed, enacted |
| `deadline_approaching` | high | Bill stalled past threshold |
| `new_bill_introduced` | low | New bill detected |
| `amendment_filed` | low | Amendment added |
| `amendment_adopted` | medium | Amendment status → adopted |
| `vote_recorded` | medium | Vote recorded on bill |

---

## AI Chatbot Architecture

The webapp includes an AI-powered bill analysis chatbot:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                                    │
│  BillChatSidebar.tsx - Floating chat panel on bill detail pages        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     /api/chat ENDPOINT                                   │
│  • Session management (in-memory)                                       │
│  • Rate limiting (100 req/day/session)                                  │
│  • Actions: chat, summary, compare                                      │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CHAT HANDLER                                        │
│  • Token budget management (100k input, 4k output)                      │
│  • Context building (bill text + history)                               │
│  • Cost tracking per session                                            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI PROVIDER ABSTRACTION                               │
│  ┌─────────────────┐              ┌─────────────────┐                   │
│  │  OpenAI GPT-4   │     OR       │  Anthropic      │                   │
│  │  (128k context) │              │  Claude 3.5     │                   │
│  │  $0.01/1k in    │              │  (200k context) │                   │
│  └─────────────────┘              └─────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### PDF Extraction Pipeline

```
PDF URL → Download → pdf-parse → Clean Text → Chunk (4k tokens) → Store
                                     │
                                     ▼
                            Section Parser
                            • Title extraction
                            • Section numbering
                            • Definition detection
                            • RSMO references
                            • Effective date
```

### Semantic Diff Detection

Compares bill versions using AI to identify:

| Change Type | Description |
|-------------|-------------|
| `policy` | New requirements, modified rules |
| `scope` | Who/what is affected |
| `fiscal` | Dollar amounts, funding |
| `timeline` | Effective dates, deadlines |
| `enforcement` | Penalties, oversight |
| `technical` | Non-substantive corrections |

Severity levels: `major`, `moderate`, `minor`

---

## Updated Module Structure

```
mo-leg-tracker/
├── sync/
│   ├── DATA_SYNC_ARCHITECTURE.md
│   ├── index.ts
│   ├── config.ts
│   │
│   ├── sources/
│   │   ├── house-xml-parser.ts
│   │   ├── senate-scraper.ts
│   │   └── fiscal-note-parser.ts
│   │
│   ├── database/
│   │   ├── graph-writer.ts
│   │   └── sync-state.ts
│   │
│   ├── scheduler/                    # NEW
│   │   ├── index.ts                  # node-cron scheduler
│   │   ├── schedules.ts              # Cron expressions
│   │   └── job-runner.ts             # Execution wrapper
│   │
│   ├── events/                       # NEW
│   │   ├── types.ts                  # Event type definitions
│   │   ├── detector.ts               # Change detection
│   │   └── store.ts                  # JSON persistence
│   │
│   ├── webhooks/                     # NEW
│   │   ├── config.ts                 # Subscription management
│   │   ├── dispatcher.ts             # HMAC-signed delivery
│   │   └── retry-queue.ts            # Exponential backoff
│   │
│   ├── notifications/                # NEW
│   │   ├── index.ts                  # Unified dispatcher
│   │   ├── email.ts                  # SendGrid
│   │   ├── slack.ts                  # Slack webhooks
│   │   ├── discord.ts                # Discord webhooks
│   │   ├── sms.ts                    # Twilio
│   │   └── templates.ts              # Message formatting
│   │
│   ├── diff/                         # NEW
│   │   ├── etag-cache.ts             # HTTP caching
│   │   └── tracker.ts                # Content hash tracking
│   │
│   ├── pdf/                          # NEW
│   │   ├── extractor.ts              # PDF text extraction
│   │   ├── chunker.ts                # Token-aware chunking
│   │   └── section-parser.ts         # Bill structure parsing
│   │
│   └── utils/
│       ├── rate-limiter.ts
│       └── logger.ts
│
├── webapp/
│   └── src/
│       ├── app/api/chat/             # NEW
│       │   └── route.ts              # Chat API endpoint
│       │
│       ├── components/chat/          # NEW
│       │   ├── BillChatSidebar.tsx
│       │   ├── ChatMessage.tsx
│       │   ├── ChatInput.tsx
│       │   ├── SuggestedQuestions.tsx
│       │   └── VersionDiffModal.tsx
│       │
│       └── lib/ai/                   # NEW
│           ├── providers/index.ts    # OpenAI/Anthropic abstraction
│           ├── prompts.ts            # System prompts
│           ├── chat-handler.ts       # Context management
│           ├── token-counter.ts      # Usage tracking
│           └── semantic-diff.ts      # Version comparison
│
├── db/
│   ├── graph.json
│   ├── sync-state.json
│   ├── events.json                   # NEW - Event store
│   ├── webhooks.json                 # NEW - Webhook config
│   ├── etag-cache.json               # NEW - HTTP cache
│   └── diff-state.json               # NEW - Change tracking
```

---

## Usage Examples

```bash
# Full database rebuild
npm run sync:full

# Incremental hourly sync
npm run sync:incremental

# Sync specific bills
npm run sync:bill HB1607 SB834

# Sync only fiscal notes
npm run sync:fiscal

# Validate database integrity
npm run sync:validate

# View sync status
npm run sync:status
```
