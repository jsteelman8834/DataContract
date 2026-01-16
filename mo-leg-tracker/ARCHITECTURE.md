# Missouri Legislative Tracker - Architecture Plan

## Project Vision

A civic accountability tool that makes Missouri legislation accessible to the public through:
- Visual bill status tracking (pipeline from introduction to law)
- Committee stack visualization (what's stuck where, with whom)
- Member accountability cards (who sponsors what, success rates)
- Plain-English bill summaries
- Change tracking over time

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐        │
│  │   DATA LAYER    │     │   API LAYER     │     │  FRONTEND       │        │
│  ├─────────────────┤     ├─────────────────┤     ├─────────────────┤        │
│  │                 │     │                 │     │                 │        │
│  │  SQLite         │────▶│  Python         │────▶│  React/Vue +    │        │
│  │                 │     │  FastAPI        │     │  D3.js          │        │
│  │                 │     │                 │     │                 │        │
│  └────────┬────────┘     └─────────────────┘     └─────────────────┘        │
│           │                                                                  │
│           │              ┌─────────────────┐     ┌─────────────────┐        │
│           │              │   SYNC SERVICE  │     │   PDF CACHE     │        │
│           └──────────────│   (Cron/hourly) │     │   (On-demand)   │        │
│                          └─────────────────┘     └─────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack (Local-First)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Database | SQLite | Zero config, single file, portable |
| Backend | Python + FastAPI | Fast, async, easy XML parsing |
| Frontend | Vue 3 + D3.js | Reactive, great for visualizations |
| Sync | Python script + cron | Simple, reliable |
| Cache | File system | PDFs cached in `./cache/` directory |

## Database Schema

### Core Tables

```sql
-- Sessions (legislative sessions)
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,        -- '261'
    name TEXT,                         -- '2026 Regular Session'
    year INTEGER,
    session_type TEXT,                 -- 'R', 'S1', 'S2'
    general_assembly TEXT,             -- '103rd General Assembly'
    is_current BOOLEAN DEFAULT FALSE
);

-- Bills
CREATE TABLE bills (
    id INTEGER PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id),
    bill_type TEXT NOT NULL,           -- 'HB', 'HJR', 'HCR'
    bill_number INTEGER NOT NULL,
    current_string TEXT,               -- 'CCS SS SCS HCS HB 2'
    short_title TEXT,
    long_title TEXT,
    lr_number TEXT,
    sponsor_id INTEGER REFERENCES members(id),
    current_status TEXT,
    current_committee_id INTEGER REFERENCES committees(id),
    proposed_effective_date DATE,
    last_action_date DATE,
    last_action_text TEXT,
    calendar TEXT,
    days_in_current_status INTEGER,
    days_since_introduction INTEGER,
    xml_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, bill_type, bill_number)
);

-- Bill Versions (track all amendments/substitutes)
CREATE TABLE bill_versions (
    id INTEGER PRIMARY KEY,
    bill_id INTEGER REFERENCES bills(id),
    version_code TEXT,                 -- '01I', '03C', '06T'
    version_type TEXT,                 -- 'Introduced', 'HCS', 'SCS', 'CCS', 'Final'
    lr_number TEXT,
    pdf_url TEXT,
    pdf_cached_path TEXT,
    page_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Members (Representatives)
CREATE TABLE members (
    id INTEGER PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id),
    district TEXT NOT NULL,            -- '001'
    first_name TEXT,
    last_name TEXT,
    party TEXT,                        -- 'Republican', 'Democrat'
    year_elected INTEGER,
    years_served INTEGER,
    hometown TEXT,
    capitol_phone TEXT,
    email TEXT,
    photo_url TEXT,
    bio TEXT,
    xml_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, district)
);

-- Committees
CREATE TABLE committees (
    id INTEGER PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id),
    external_id INTEGER,               -- ID from XML
    name TEXT NOT NULL,
    committee_type TEXT,               -- 'Standing', 'Admin', 'Special', 'Interim'
    chair_id INTEGER REFERENCES members(id),
    vice_chair_id INTEGER REFERENCES members(id),
    ranking_minority_id INTEGER REFERENCES members(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, external_id)
);

-- Committee Memberships
CREATE TABLE committee_members (
    id INTEGER PRIMARY KEY,
    committee_id INTEGER REFERENCES committees(id),
    member_id INTEGER REFERENCES members(id),
    position TEXT,                     -- 'Chair', 'Vice-Chair', 'Member'
    UNIQUE(committee_id, member_id)
);

-- Actions (bill history)
CREATE TABLE actions (
    id INTEGER PRIMARY KEY,
    bill_id INTEGER REFERENCES bills(id),
    external_id INTEGER,               -- Guid from XML
    sequence INTEGER,
    action_date DATE,
    description TEXT,
    chamber TEXT,                      -- 'H', 'S', 'G'
    comments TEXT,
    journal_page_start INTEGER,
    journal_page_end INTEGER,
    journal_link TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bill_id, external_id)
);

-- Roll Calls
CREATE TABLE roll_calls (
    id INTEGER PRIMARY KEY,
    action_id INTEGER REFERENCES actions(id),
    bill_id INTEGER REFERENCES bills(id),
    total_yes INTEGER,
    total_no INTEGER,
    total_present INTEGER,
    pdf_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual Votes
CREATE TABLE votes (
    id INTEGER PRIMARY KEY,
    roll_call_id INTEGER REFERENCES roll_calls(id),
    member_id INTEGER REFERENCES members(id),
    vote TEXT,                         -- 'Y', 'N', 'P', 'A'
    UNIQUE(roll_call_id, member_id)
);

-- Hearings
CREATE TABLE hearings (
    id INTEGER PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id),
    external_id INTEGER,
    committee_id INTEGER REFERENCES committees(id),
    hearing_date DATE,
    hearing_time TEXT,
    location TEXT,
    status TEXT,                       -- 'Created', 'Amended', 'Adjourned'
    progress TEXT,                     -- 'Upcoming', 'Adjourned'
    adjourned_time TEXT,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, external_id)
);

-- Bills scheduled for hearings
CREATE TABLE hearing_bills (
    id INTEGER PRIMARY KEY,
    hearing_id INTEGER REFERENCES hearings(id),
    bill_id INTEGER REFERENCES bills(id),
    UNIQUE(hearing_id, bill_id)
);

-- Amendments
CREATE TABLE amendments (
    id INTEGER PRIMARY KEY,
    bill_id INTEGER REFERENCES bills(id),
    lr_number TEXT,
    sponsor_name TEXT,
    status TEXT,                       -- 'Distributed', 'Adopted', 'Withdrawn'
    description TEXT,
    pdf_url TEXT,
    pdf_cached_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bill_id, lr_number)
);

-- AI-Generated Summaries
CREATE TABLE ai_summaries (
    id INTEGER PRIMARY KEY,
    bill_id INTEGER REFERENCES bills(id),
    version_id INTEGER REFERENCES bill_versions(id),
    summary_text TEXT,
    impact_text TEXT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    model_used TEXT,
    UNIQUE(bill_id, version_id)
);

-- Sync log
CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY,
    sync_type TEXT,                    -- 'bills', 'members', 'committees', etc.
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    records_processed INTEGER,
    records_added INTEGER,
    records_updated INTEGER,
    status TEXT,                       -- 'success', 'failed'
    error_message TEXT
);

-- Indexes for common queries
CREATE INDEX idx_bills_session ON bills(session_id);
CREATE INDEX idx_bills_status ON bills(current_status);
CREATE INDEX idx_bills_committee ON bills(current_committee_id);
CREATE INDEX idx_bills_sponsor ON bills(sponsor_id);
CREATE INDEX idx_actions_bill ON actions(bill_id);
CREATE INDEX idx_actions_date ON actions(action_date);
CREATE INDEX idx_members_session ON members(session_id);
CREATE INDEX idx_members_party ON members(party);
```

## Bill Status Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BILL STATUS FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  HOUSE CHAMBER                    SENATE CHAMBER              EXECUTIVE      │
│  ─────────────                    ──────────────              ─────────      │
│                                                                              │
│  ┌──────────┐                                                                │
│  │ PREFILED │ ─────┐                                                         │
│  └──────────┘      │                                                         │
│                    ▼                                                         │
│  ┌──────────┐    ┌──────────┐                                               │
│  │ 1ST READ │───▶│ REFERRED │                                               │
│  └──────────┘    └────┬─────┘                                               │
│                       ▼                                                      │
│               ┌──────────────┐                                               │
│               │  COMMITTEE   │◀─── Bills can die here                        │
│               │   (Stack)    │     Track: days waiting                       │
│               └──────┬───────┘     Show: chair responsible                   │
│                      │                                                       │
│            ┌─────────┴─────────┐                                            │
│            ▼                   ▼                                             │
│     ┌────────────┐      ┌────────────┐                                      │
│     │  REPORTED  │      │   KILLED   │                                      │
│     │  DO PASS   │      │            │                                      │
│     └─────┬──────┘      └────────────┘                                      │
│           ▼                                                                  │
│     ┌──────────┐                                                            │
│     │ 2ND READ │                                                            │
│     └────┬─────┘                                                            │
│          ▼                                                                   │
│     ┌──────────┐         ┌──────────────┐                                   │
│     │PERFECTED │────────▶│   3RD READ   │                                   │
│     └──────────┘         └──────┬───────┘                                   │
│                                 ▼                                            │
│                          ┌──────────┐                                        │
│                          │  PASSED  │──────────┐                            │
│                          │  (HOUSE) │          │                            │
│                          └──────────┘          │                            │
│                                                ▼                             │
│                                    ┌────────────────────┐                   │
│                                    │  SENATE RECEIVES   │                   │
│                                    └─────────┬──────────┘                   │
│                                              │                               │
│                            (Similar flow in Senate)                         │
│                                              │                               │
│                                              ▼                               │
│                                    ┌────────────────────┐                   │
│                                    │   PASSED (BOTH)    │                   │
│                                    └─────────┬──────────┘                   │
│                                              │                               │
│                      ┌───────────────────────┼───────────────────────┐      │
│                      ▼                       │                       ▼      │
│             ┌────────────────┐               │              ┌─────────────┐ │
│             │  CONFERENCE    │◀──────────────┘              │   TRULY     │ │
│             │  COMMITTEE     │      (if chambers            │   AGREED    │ │
│             │  (reconcile)   │       disagree)              └──────┬──────┘ │
│             └───────┬────────┘                                     │        │
│                     │                                              │        │
│                     └──────────────────────────────────────────────┘        │
│                                              │                               │
│                                              ▼                               │
│                                    ┌────────────────────┐                   │
│                                    │    DELIVERED TO    │                   │
│                                    │     GOVERNOR       │                   │
│                                    └─────────┬──────────┘                   │
│                                              │                               │
│                      ┌───────────────────────┼───────────────────────┐      │
│                      ▼                       ▼                       ▼      │
│             ┌──────────────┐       ┌──────────────┐        ┌─────────────┐  │
│             │    SIGNED    │       │    VETOED    │        │   NO ACTION │  │
│             │              │       │              │        │  (becomes   │  │
│             └──────┬───────┘       └──────┬───────┘        │    law)     │  │
│                    │                      │                └─────────────┘  │
│                    ▼                      ▼                                  │
│             ┌──────────────┐       ┌──────────────┐                         │
│             │     LAW      │       │ VETO OVERRIDE│                         │
│             │              │       │   ATTEMPT    │                         │
│             └──────────────┘       └──────────────┘                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Frontend Views

### 1. Pipeline View (Sankey Diagram)
Shows flow of bills through stages with counts at each step.

### 2. Committee Stack View
Cards stacked by committee showing:
- Committee name and chair
- Number of bills pending
- Average days waiting
- Individual bill cards (sortable by wait time)

### 3. Member Accountability Card
- Photo, name, party, district
- Bills sponsored (total, passed, pending)
- Committee roles
- Voting record summary
- Contact information

### 4. Bill Detail Page
- Plain-English summary
- Current status with visual timeline
- All versions with diff capability
- Sponsor information
- Full action history
- Related bills

### 5. Search & Filter
- Full-text search
- Filter by: status, committee, sponsor, party, topic
- Sort by: date, activity, days waiting

## Implementation Phases

### Phase 1: Data Foundation
- [ ] Set up SQLite database with schema
- [ ] Create XML parser for all feed types
- [ ] Build sync service (Python script)
- [ ] Initial data load for current session
- [ ] Basic CLI to query data

### Phase 2: API Layer
- [ ] FastAPI application
- [ ] REST endpoints for all entities
- [ ] Search and filter endpoints
- [ ] Pagination
- [ ] PDF proxy/cache endpoint

### Phase 3: Core Frontend
- [ ] Vue 3 application scaffold
- [ ] Bill list view with filters
- [ ] Bill detail page
- [ ] Member list and detail
- [ ] Committee list

### Phase 4: Visualizations
- [ ] Pipeline/Sankey diagram (D3)
- [ ] Committee stack view
- [ ] Member accountability cards
- [ ] Bill timeline visualization

### Phase 5: AI Summaries
- [ ] Integrate LLM for summaries
- [ ] Generate plain-English descriptions
- [ ] Impact analysis
- [ ] Store and cache summaries

### Phase 6: Polish & Launch
- [ ] Mobile responsive design
- [ ] Performance optimization
- [ ] Error handling
- [ ] User guide/help

## Accountability Metrics to Surface

- **Days in Committee** - How long bills are waiting
- **Committee Chair Bottlenecks** - Who's holding up the most bills
- **Sponsor Success Rate** - Whose bills actually move forward
- **Party Line Votes** - Voting pattern analysis
- **Amendment Activity** - Most amended bills
- **Session Deadline Tracking** - Bills at risk of dying
- **Hearing Attendance** - Bills that get hearings vs. don't
