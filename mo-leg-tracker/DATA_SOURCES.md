# Missouri Legislative Data Sources

This document covers data access for both the **House of Representatives** and the **Senate**.

---

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

---

# Missouri Senate Data Sources

## Key Difference from House

The Senate **does not provide XML data feeds**. Data must be scraped from HTML pages or accessed via limited text files. This requires a different approach than the House.

## Base URLs

| Resource | URL Pattern |
|----------|-------------|
| Main Senate Site | `https://www.senate.mo.gov` |
| Bill Tracking App | `https://www.senate.mo.gov/BillTracking/` |
| BTS Web (Legacy) | `https://www.senate.mo.gov/26info/bts_web/` |

## Bill List Access

**Bill Listing Page:**
```
https://www.senate.mo.gov/BillTracking/Bills/BillList?year={YEAR}&session={SESSION}
```

Session types: `R` = Regular, `E1` = 1st Extraordinary

**Example:** `https://www.senate.mo.gov/BillTracking/Bills/BillList?year=2026&session=R`

## Individual Bill URLs

| Type | Pattern | Example |
|------|---------|---------|
| Bill Page (by ID) | `/{YY}info/bts_web/Bill.aspx?SessionType=R&BillID={ID}` | `BillID=416` (SB 834) |
| Bill Page (by number) | `/{YY}info/bts_web/Bill.aspx?SessionType=R&BillPrefix=SB&BillSuffix={NUM}` | `BillPrefix=SB&BillSuffix=834` |
| Actions History | `/{YY}info/BTS_Web/Actions.aspx?SessionType=R&BillID={ID}` | |
| Bill Text Versions | `/{YY}info/BTS_Web/BillText.aspx?SessionType=R&BillID={ID}` | |
| Amendments | `/{YY}info/BTS_Web/Amendments.aspx?SessionType=R&BillID={ID}` | |
| Fiscal Notes | `/{YY}info/BTS_Web/FiscalNotes.aspx?SessionType=R&BillID={ID}` | |
| Summaries | `/{YY}info/BTS_Web/Summaries.aspx?SessionType=R&BillID={ID}` | |
| Committee Minutes | `/{YY}info/BTS_BillMinutes/default.aspx?SessionType=R&BillID={ID}` | |

Note: `{YY}` = 2-digit year (e.g., `26` for 2026)

## PDF URL Patterns

| Type | Pattern | Example |
|------|---------|---------|
| Introduced Bill | `/{YY}info/pdf-bill/intro/SB{NUM}.pdf` | `SB834.pdf` |
| Committee Substitute | `/{YY}info/pdf-bill/tat/SB{NUM}.pdf` | |
| Perfected | `/{YY}info/pdf-bill/perf/SB{NUM}.pdf` | |

**Full URL Example:** `https://www.senate.mo.gov/26info/pdf-bill/intro/SB834.pdf`

## Senators and Committees

| Type | URL Pattern |
|------|-------------|
| Senator List | `https://www.senate.mo.gov/Senators/` |
| Individual Senator | `https://www.senate.mo.gov/Senators/Member/{DISTRICT}` |
| Committee List | `https://www.senate.mo.gov/Committees/` |
| Committee Detail | `https://www.senate.mo.gov/Committees/CommitteeDetails/{ID}` |

## Daily Actions and Hearings

| Type | URL Pattern |
|------|-------------|
| Action Dates Index | `/{YY}info/BTS_Web/ActionDates.aspx?SessionType=R` |
| Daily Actions | `/{YY}info/BTS_Web/Daily.aspx?SessionType=R&ActionDate={M/D/YYYY}` |
| Hearings Schedule | `https://www.senate.mo.gov/hearingsschedule/hrings.htm` |
| Hearings PDF | `https://www.senate.mo.gov/hearingsschedule/hrings.pdf` |

## Plain Text Data Files (Parseable)

These are simpler to parse than HTML:

| File | URL | Content |
|------|-----|---------|
| Statutes by Bill | `https://www.senate.mo.gov/bstats/bybill{YY}.txt` | Bills with affected statutes |
| Statutes by RSMo | `https://www.senate.mo.gov/bstats/bystat{YY}.txt` | Statutes with affecting bills |
| TATFP by Bill | `https://www.senate.mo.gov/bstats/bybillTATFP{YY}.txt` | Truly Agreed bills only |
| TATFP by Statute | `https://www.senate.mo.gov/bstats/bystatTATFP{YY}.txt` | Truly Agreed statutes only |

## Additional Resources

| Resource | URL |
|----------|-----|
| Bill Search | `https://www.senate.mo.gov/BillTracking/Bills/BillSearch/` |
| Topical Index | `/{YY}info/BTS_Web/Keywords.aspx?SessionType=R` |
| Truly Agreed Bills | `/{YY}info/BTS_Web/TrulyAgreed.aspx?SessionType=R` |
| Governor's Actions | `/{YY}info/BTS_Web/GovActionTAT.aspx?SessionType=R` |
| Senate Calendar | `/{YY}info/pdf-cal/cal.htm` |
| Legislator Lookup | `https://www.senate.mo.gov/LegisLookup/Default.aspx` |

## Session Statistics (2026)

| Type | Count |
|------|-------|
| Senate Bills (SB) | 734 |
| Senate Joint Resolutions (SJR) | 49 |
| Senate Concurrent Resolutions (SCR) | 7 |
| Senate Resolutions (SR) | 5 |
| Senators | 34 |

## Data Collection Strategy

Since the Senate lacks XML feeds, data collection requires:

1. **HTML Scraping**: Parse bill list and detail pages
2. **Text File Parsing**: Use bstats/*.txt files for statute mappings
3. **PDF Downloads**: Follow same pattern as House for bill texts
4. **Incremental Sync**: Track BillIDs and check for new bills daily

## Rate Limits

No official rate limit documented, but be respectful:
- Space requests by 1-2 seconds
- Cache responses locally
- Run full syncs during off-hours
