# Storage Analysis - Missouri Legislative Tracker

*Analysis Date: January 2026*
*Sample Session: 261 (2026 Regular), 251 (2025 Regular)*

## PDF Size Measurements

### By Document Type

| Document Type | Min | Max | Average | Notes |
|--------------|-----|-----|---------|-------|
| Bill Text (Introduced) | 92 KB | 234 KB | ~150 KB | Simple bills smaller |
| Bill Text (Final/CCS) | 160 KB | 272 KB | ~200 KB | Appropriations larger |
| Summary | 31 KB | 38 KB | ~35 KB | Consistent size |
| Fiscal Note | - | 362 KB | ~360 KB | ~50% of bills have one |
| Amendment | - | 70 KB | ~70 KB | 0-20+ per bill |
| Roll Call | - | 45 KB | ~45 KB | Only floor votes |
| Testimony | - | 236 KB | ~240 KB | Varies widely |
| Veto Letter | - | 1.3 MB | ~1.3 MB | Rare |
| Journal (daily) | - | 199 KB | ~200 KB | ~75 per session, shared |

### Sample Measurements (Actual)

```
HB1607_text.pdf      92 KB   (Regular bill, introduced)
HB1607_summary.pdf   31 KB
HB1607_fiscal.pdf   362 KB
HB1700_text.pdf     101 KB
HB1800_text.pdf     160 KB
HB2_final.pdf       212 KB   (Appropriations, final)
HB10_final.pdf      272 KB   (Appropriations, final)
HB10_introduced.pdf 234 KB
HB10_amend1.pdf      70 KB
HB10_rollcall.pdf    45 KB
HB10_testimony.pdf  236 KB
HB10_veto.pdf       1.3 MB
journal_sample.pdf  199 KB
```

## Per-Bill Document Counts

### Simple Bill (dies in committee)
- 1 bill text version
- 1 summary
- 0-1 fiscal note
- 0 amendments
- **Total: 2-3 documents, ~200 KB**

### Moderate Bill (passes one chamber)
- 2-3 bill text versions (Intro, Committee, Perfected)
- 1 summary
- 1 fiscal note
- 2-5 amendments
- 1-2 roll calls
- **Total: 7-12 documents, ~800 KB**

### Complex Bill (becomes law)
- 5-7 bill text versions (Intro, HCS, SCS, SS, CCS, Final)
- 1 summary
- 1 fiscal note
- 10-20 amendments
- 3-4 roll calls
- 1 testimony file
- **Total: 20-35 documents, ~2-3 MB**

## Session-Level Estimates

### Session 261 (2026 Regular - Current)
- Bills filed: ~400
- Expected final: ~1,500-2,000 bills

### Typical Full Session Statistics
| Metric | Count |
|--------|-------|
| Total bills introduced | 1,500-2,000 |
| Bills that pass | 100-200 |
| Bills with hearings | 400-600 |
| Total amendments | 1,000-2,000 |
| Daily journals | ~75 |
| Roll calls | 200-400 |

## Storage Strategy Options

### Option A: XML Metadata Only
```
XML archive:        3 MB
SQLite database:   25 MB
─────────────────────────
TOTAL:            ~30 MB per session
```
- Links to PDFs on house.mo.gov
- Minimal storage
- Dependent on their servers

### Option B: Core PDFs (Recommended for Start)
```
Latest bill text:   60 MB  (400 × 150KB)
Summaries:          14 MB  (400 × 35KB)
Fiscal notes:       72 MB  (200 × 360KB)
XML/Database:       30 MB
─────────────────────────
TOTAL:           ~175 MB per session
```
- Key documents available offline
- Reasonable size

### Option C: Full Archive
```
All bill versions: 300 MB  (2000 × 150KB)
Summaries:          14 MB
Fiscal notes:       72 MB
Amendments:         70 MB  (1000 × 70KB)
Roll calls:          9 MB  (200 × 45KB)
Journals:           15 MB  (75 × 200KB)
Testimony:          20 MB
XML/Database:       30 MB
─────────────────────────
TOTAL:           ~530 MB per session
```
- Complete offline archive
- Track all changes over time

### Option D: Multi-Year Archive
```
5 years × 2 sessions × 530 MB = ~5.3 GB
```
- Historical analysis
- Legislator pattern tracking

## Database Schema Size Estimates

| Table | Est. Rows | Est. Size |
|-------|-----------|-----------|
| sessions | 50 | 10 KB |
| bills | 400-2000 | 2-10 MB |
| bill_versions | 2,000-10,000 | 5-25 MB |
| actions | 15,000-75,000 | 10-50 MB |
| members | 163 | 500 KB |
| committees | 30 | 100 KB |
| committee_members | 500 | 200 KB |
| hearings | 500 | 1 MB |
| hearing_bills | 2,000 | 500 KB |
| amendments | 1,000-2,000 | 3-6 MB |
| roll_calls | 200-400 | 1-2 MB |
| roll_call_votes | 30,000-60,000 | 5-10 MB |
| ai_summaries | 400-2000 | 4-20 MB |
| **TOTAL** | | **~25-125 MB** |

## Recommended Hybrid Approach

### Store Locally (Always)
- All XML metadata
- Parsed database
- Bill summaries (small, useful)
- Latest bill text per bill
- AI-generated plain-English summaries

### Fetch On-Demand (Cache 24h)
- Full bill text PDFs (all versions)
- Amendments
- Roll calls
- Journals
- Testimony

### Estimated Active Size
- Core data: ~150-200 MB
- With hot cache: ~400-500 MB
