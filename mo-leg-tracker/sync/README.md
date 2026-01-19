# Missouri Legislative Data Sync

Automated data ingestion pipeline for the Missouri Legislative Tracker. Syncs legislative data from official state sources into a unified JSON graph database.

## Quick Start

```bash
# Install dependencies
npm install

# Run a full sync (fetches all data - takes 15-30 minutes)
npm run sync:full

# Run an incremental sync (only bill list changes - fast)
npm run sync:incremental

# Check sync status
npm run sync:status
```

## Data Sources

### House of Representatives (XML Feeds)

The Missouri House provides structured XML feeds that are updated regularly:

| Data Type | Records | Source |
|-----------|---------|--------|
| Bills | ~1,485 | `261-BillList.XML` + individual bill XMLs |
| Members | 158 | `261-MemberList.XML` + district XMLs |
| Committees | 62 | `261-CommitteeList.XML` |
| Hearings | varies | `261-UpcomingHearingList.XML` |

**Advantages:**
- Structured XML format
- Individual bill detail files with full action history
- Member data includes photos, contact info, committee assignments

### Senate (HTML Scraping)

The Missouri Senate does not provide XML feeds. Data is scraped from HTML pages:

| Data Type | Records | Source |
|-----------|---------|--------|
| Bills | ~795 | `/BillTracking/Bills/BillList` |
| Senators | 34 | `/Senators/` (`.panel-senator` cards) |
| Committees | 39 | `/Committees/CommitteeGroup/{1,2,5,8}` |

**Committee Groups:**
- Group 1: Standing Committees (19)
- Group 2: Statutory Committees
- Group 5: Select Committees
- Group 8: Task Forces

## Sync Results Summary

After a successful full sync:

| Entity | House | Senate | Total |
|--------|-------|--------|-------|
| Bills | 1,485 | 795 | **2,280** |
| Members | 158 | 34 | **192** |
| Committees | 62 | 39 | **101** |
| Actions | ~8,000+ | varies | **8,775+** |

## Architecture

```
sync/
├── index.ts                    # Main orchestrator & CLI
├── config.ts                   # Session codes, URLs, rate limits
├── sources/
│   ├── house-xml-parser.ts     # House XML feed parser (fast-xml-parser)
│   ├── senate-scraper.ts       # Senate HTML scraper (cheerio)
│   └── fiscal-note-parser.ts   # Fiscal note extraction
├── database/
│   ├── graph-writer.ts         # Write to graph.json
│   └── sync-state.ts           # Track last sync timestamps
└── utils/
    ├── rate-limiter.ts         # Request throttling & queue
    └── logger.ts               # Structured logging
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run sync:full` | Full sync of all data (committees, members, bills with details) |
| `npm run sync:incremental` | Fast sync of bill list changes only |
| `npm run sync:bill HB1607` | Sync specific bill(s) |
| `npm run sync:status` | Show last sync info and record counts |

## Output

The sync writes to `../webapp/db/graph.json` with this structure:

```json
{
  "nodes": {
    "bill:hb1607:261": {
      "id": "bill:hb1607:261",
      "type": "bill",
      "billNumber": "HB 1607",
      "chamber": "house",
      "title": "...",
      "currentStatus": "referred",
      "sponsor": "member:house:001",
      ...
    },
    "member:house:001": {
      "id": "member:house:001",
      "type": "member",
      "chamber": "house",
      "district": "001",
      "firstName": "John",
      "lastName": "Doe",
      ...
    },
    "committee:house:agriculture": {...},
    "action:hb1607:261:001": {...}
  },
  "edges": [
    { "source": "bill:hb1607:261", "target": "member:house:001", "type": "sponsored_by" },
    { "source": "bill:hb1607:261", "target": "committee:house:agriculture", "type": "referred_to" }
  ],
  "metadata": {
    "lastSync": "2026-01-19T15:09:13.815Z",
    "session": "261",
    "counts": { "bills": 2285, "members": 192, "committees": 101 }
  }
}
```

## ID Format

All entities use deterministic IDs:

| Type | Format | Example |
|------|--------|---------|
| Bill | `bill:{prefix}{suffix}:{session}` | `bill:hb1607:261` |
| Member (House) | `member:house:{district}` | `member:house:001` |
| Member (Senate) | `member:senate:{district}` | `member:senate:14` |
| Committee | `committee:{chamber}:{slug}` | `committee:house:agriculture` |
| Action | `action:{billId}:{sequence}` | `action:hb1607:261:001` |

## Rate Limiting

The sync respects official guidance and server limits:

| Source | Rate Limit | Implementation |
|--------|------------|----------------|
| House XML | 30 min between full feeds | Timestamp check |
| House Bill Details | 500ms between requests | Queue with delay |
| Senate HTML | 2s between requests | Queue with delay |

## Logging

The sync produces structured logs with operation timing:

```
2026-01-19T15:09:13.815Z INFO  [sync] Starting full sync
2026-01-19T15:09:14.341Z INFO  [sync:house] Completed fetch committee list {"duration":"394ms","total":62}
2026-01-19T15:09:20.474Z INFO  [sync:senate] Completed fetch Senate committee list {"duration":"6130ms","total":39}
2026-01-19T15:09:27.713Z INFO  [sync:house] Completed fetch member list {"duration":"7237ms","total":158}
2026-01-19T15:09:28.962Z INFO  [sync:senate] Completed fetch Senator list {"duration":"1247ms","total":34}
```

## House XML Feed Details

### Bill List (`261-BillList.XML`)
Returns basic info for all bills: number, title, sponsor, LR number, last action date.

### Individual Bill (`261-HB{NUM}.xml`)
Full bill details including:
- Complete action history with dates and descriptions
- Co-sponsors
- Committee assignments
- Current status

### Member List (`261-MemberList.XML`)
Links to individual member XMLs (`261-001.xml`, `261-002.xml`, etc.) containing:
- Name, party, district
- Photo URL
- Phone, email
- Committee assignments

### Committee List (`261-CommitteeList.XML`)
All committees with:
- Name, type (standing/special)
- Chair and Vice-Chair member IDs
- Committee members with roles

## Senate Scraping Details

### Senators (`/Senators/`)
Parses `.panel-senator` cards to extract:
- District number from link href (`/Senators/Member/{district}`)
- Name from image title attribute
- Photo URL from img src

### Committees (`/Committees/CommitteeGroup/{id}`)
Fetches 4 committee group pages and parses links to `/Committees/CommitteeDetails/{id}` to get:
- Committee name
- Type (standing, statutory, select, task force)

### Committee Detail (`/Committees/CommitteeDetails/{id}`)
Optional fetch to get:
- Chair member ID
- Vice-Chair member ID
- Full member list

## Error Handling

- **Network errors**: Retry with exponential backoff (3 attempts)
- **Parse errors**: Log warning, skip record, continue sync
- **Rate limit (429)**: Pause and retry after delay
- **Incomplete sync**: Resume from last processed record

## Development

```bash
# Build TypeScript
npm run build

# Run with ts-node (development)
npm run dev

# Type check
npx tsc --noEmit
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `fast-xml-parser` | Parse House XML feeds |
| `cheerio` | Parse Senate HTML pages |
| `ts-node` | Run TypeScript directly |

## Configuration

Edit `config.ts` to change:

```typescript
export const config = {
  session: {
    code: '261',        // General Assembly session code
    year: 2026,         // Session year
    type: 'R'           // R = Regular, E1/E2 = Extraordinary
  },
  house: {
    baseUrl: 'https://documents.house.mo.gov',
    // ... feed paths
  },
  senate: {
    baseUrl: 'https://www.senate.mo.gov',
    // ... scraping paths
  },
  rateLimit: {
    house: { minInterval: 500, maxConcurrent: 2 },
    senate: { minInterval: 2000, maxConcurrent: 2 }
  }
};
```

## Related Documentation

- [DATA_SYNC_ARCHITECTURE.md](./DATA_SYNC_ARCHITECTURE.md) - Detailed architecture and design decisions
- [Graph Schema](../webapp/db/schema.json) - Database schema definition

## License

MIT
