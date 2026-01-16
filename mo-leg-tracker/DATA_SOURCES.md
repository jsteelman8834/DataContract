# Missouri House Data Sources

## Base URLs

| Resource | URL Pattern |
|----------|-------------|
| Documents Portal | `https://documents.house.mo.gov` |
| Main House Site | `https://house.mo.gov` |

## XML Data Feeds

All XML feeds follow pattern: `https://documents.house.mo.gov/xml/{SESSION}-{FILE}.XML`

**Current Session (2026):** `261` (103rd General Assembly, 2nd Regular Session)

| Feed | URL | Update Frequency |
|------|-----|------------------|
| Session List | `261-SessionList.XML` | Static |
| Bill List | `261-BillList.XML` | Hourly |
| Member List | `261-MemberList.XML` | Hourly |
| Committee List | `261-CommitteeList.XML` | Hourly |
| Upcoming Hearings | `261-UpcomingHearingList.XML` | Hourly |
| Calendar | `261-CalendarList.XML` | Hourly |
| Senate Actions | `261-SenateActList.XML` | Hourly |

## Individual Record URLs

| Type | Pattern | Example |
|------|---------|---------|
| Bill Detail | `261-HB{NUMBER}.xml` | `261-HB1607.xml` |
| Member Detail | `261-{DISTRICT}.xml` | `261-001.xml` |

## PDF URL Patterns

Base: `https://documents.house.mo.gov/billtracking/bills{SESSION}/`

| Type | Path | Example |
|------|------|---------|
| Bill Text | `hlrbillspdf/{LR}.pdf` | `hlrbillspdf/5106H.01I.pdf` |
| Summary | `sumpdf/HB{NUM}{VERSION}.pdf` | `sumpdf/HB1607I.pdf` |
| Fiscal Note | `fiscal/fispdf/{LR}.ORG.pdf` | `fiscal/fispdf/5106H.01I.ORG.pdf` |
| Amendment | `amendpdf/{LR}.pdf` | `amendpdf/0010H03.01H.pdf` |
| Roll Call | `rollcalls/{JRN}.{SEQ}.pdf` | `rollcalls/048.010.pdf` |
| Testimony | `witnesses/HB{NUM}Testimony{DATE}.pdf` | `witnesses/HB10Testimony2-24.pdf` |
| Veto Letter | `rpt/HB{NUM}vl.pdf` | `rpt/HB10vl.pdf` |
| Journal | `jrnpdf/jrn{NUM}.pdf` | `jrnpdf/jrn025.pdf` |

## Past Session Archives

ZIP archives: `https://documents.house.mo.gov/xml/{SESSION}.zip`

| Session Code | Description |
|--------------|-------------|
| 261 | 2026 Regular Session (current) |
| 254 | 2025 2nd Extraordinary Session |
| 251 | 2025 Regular Session |
| 241 | 2024 Regular Session |
| 231 | 2023 Regular Session |
| ... | Pattern continues |

## Session Code Format

- First 2 digits: Year (25 = 2025)
- Last digit: Session type
  - `1` = Regular Session
  - `2`, `3`, `4` = Extraordinary Sessions (S1, S2, S3)

## Rate Limits

**Official guidance:** Do not poll more than once every 30 minutes.
Scripts causing excessive load may be temporarily blocked.

## Data Refresh Schedule

- XML feeds updated hourly on the hour
- PDFs updated as documents are filed
- Sync recommendation: Run at :05 past the hour
