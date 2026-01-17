/**
 * Missouri Legislative Data Sync Configuration
 */

export const config = {
  // Current session
  session: {
    code: '261',
    year: 2026,
    type: 'regular' as const,
    label: '2026 Second Regular Session',
    assemblyNumber: 103,
  },

  // House data source URLs
  house: {
    baseUrl: 'https://documents.house.mo.gov',
    xmlPath: '/xml',

    feeds: {
      sessionList: '{SESSION}-SessionList.XML',
      billList: '{SESSION}-BillList.XML',
      memberList: '{SESSION}-MemberList.XML',
      committeeList: '{SESSION}-CommitteeList.XML',
      hearings: '{SESSION}-UpcomingHearingList.XML',
      calendar: '{SESSION}-CalendarList.XML',
      senateActions: '{SESSION}-SenateActList.XML',
    },

    // Individual bill detail: 261-HB1607.xml
    billDetail: '{SESSION}-{PREFIX}{NUMBER}.xml',

    // PDF paths
    pdf: {
      basePath: '/billtracking/bills{SESSION}',
      billText: '/hlrbillspdf/{LR}.pdf',
      summary: '/sumpdf/{PREFIX}{NUMBER}{VERSION}.pdf',
      fiscalNote: '/fiscal/fispdf/{LR}.ORG.pdf',
      amendment: '/amendpdf/{LR}.pdf',
      rollCall: '/rollcalls/{JOURNAL}.{SEQUENCE}.pdf',
    },

    // Rate limiting
    minSyncInterval: 30 * 60 * 1000, // 30 minutes (official guidance)
    maxRetries: 4,
    retryBackoffBase: 2000, // 2 seconds
  },

  // Senate data source URLs
  senate: {
    baseUrl: 'https://www.senate.mo.gov',

    // Bill tracking app
    billTracking: {
      billList: '/BillTracking/Bills/BillList?year={YEAR}&session={SESSION_TYPE}',
      billSearch: '/BillTracking/Bills/BillSearch/',
    },

    // Legacy BTS Web (more detailed)
    btsWeb: {
      basePath: '/{YY}info/bts_web',
      bill: '/Bill.aspx?SessionType={SESSION_TYPE}&BillID={ID}',
      billByNumber: '/Bill.aspx?SessionType={SESSION_TYPE}&BillPrefix={PREFIX}&BillSuffix={NUMBER}',
      actions: '/Actions.aspx?SessionType={SESSION_TYPE}&BillID={ID}',
      billText: '/BillText.aspx?SessionType={SESSION_TYPE}&BillID={ID}',
      amendments: '/Amendments.aspx?SessionType={SESSION_TYPE}&BillID={ID}',
      fiscalNotes: '/FiscalNotes.aspx?SessionType={SESSION_TYPE}&BillID={ID}',
      summaries: '/Summaries.aspx?SessionType={SESSION_TYPE}&BillID={ID}',
      actionDates: '/ActionDates.aspx?SessionType={SESSION_TYPE}',
      daily: '/Daily.aspx?SessionType={SESSION_TYPE}&ActionDate={DATE}',
    },

    // PDF paths
    pdf: {
      intro: '/{YY}info/pdf-bill/intro/{PREFIX}{NUMBER}.pdf',
      committeeSubstitute: '/{YY}info/pdf-bill/tat/{PREFIX}{NUMBER}.pdf',
      perfected: '/{YY}info/pdf-bill/perf/{PREFIX}{NUMBER}.pdf',
    },

    // Senator and committee pages
    members: {
      list: '/Senators/',
      detail: '/Senators/Member/{DISTRICT}',
    },
    committees: {
      list: '/Committees/',
      detail: '/Committees/CommitteeDetails/{ID}',
    },

    // Plain text files (easier to parse)
    textFiles: {
      byBill: '/bstats/bybill{YY}.txt',
      byStat: '/bstats/bystat{YY}.txt',
      byBillTATFP: '/bstats/bybillTATFP{YY}.txt',
      byStatTATFP: '/bstats/bystatTATFP{YY}.txt',
    },

    hearings: {
      schedule: '/hearingsschedule/hrings.htm',
      pdf: '/hearingsschedule/hrings.pdf',
    },

    // Rate limiting
    requestDelay: 2000, // 2 seconds between requests
    maxConcurrent: 2,
    maxRetries: 3,
    retryBackoffBase: 1000,
  },

  // Database paths - webapp/db is the single source of truth
  database: {
    graphPath: '../webapp/db/graph.json',
    schemaPath: './db/schema.json',
    syncStatePath: './db/sync-state.json',
    syncLogPath: './logs/sync-log.jsonl',
  },

  // Sync behavior
  sync: {
    batchSize: 50, // Bills to process per batch
    logLevel: 'info' as const,
    enableFiscalParse: true,
    enablePdfDownload: false,
    validateSchema: true,
  },
};

// Session type mapping
export const SESSION_TYPES = {
  regular: 'R',
  extraordinary1: 'E1',
  extraordinary2: 'E2',
  extraordinary3: 'E3',
} as const;

// Bill prefix types
export const BILL_PREFIXES = {
  HB: { chamber: 'house', type: 'bill' },
  SB: { chamber: 'senate', type: 'bill' },
  HJR: { chamber: 'house', type: 'joint_resolution' },
  SJR: { chamber: 'senate', type: 'joint_resolution' },
  HCR: { chamber: 'house', type: 'concurrent_resolution' },
  SCR: { chamber: 'senate', type: 'concurrent_resolution' },
  HR: { chamber: 'house', type: 'resolution' },
  SR: { chamber: 'senate', type: 'resolution' },
} as const;

// Action code to status mapping
export const ACTION_STATUS_MAP: Record<string, string> = {
  'PREF': 'prefiled',
  'INTR': 'introduced',
  '1RD': 'first_read',
  '2RD': 'referred',
  '2RD-REF': 'referred',
  'REF': 'referred',
  'SCHED': 'hearing_scheduled',
  'HEAR': 'heard',
  'DP': 'reported_do_pass',
  'DPW': 'reported_do_pass', // Do Pass with amendments
  'DP-DNP': 'in_committee', // Split vote
  'DNP': 'in_committee', // Do Not Pass
  'PERF': 'perfected',
  '3RD': 'third_read',
  '3RD-P': 'passed_origin',
  'PASS': 'passed_origin',
  'S-REC': 'received_other',
  'H-REC': 'received_other',
  'S-REF': 'referred_other',
  'H-REF': 'referred_other',
  'S-DP': 'reported_other',
  'H-DP': 'reported_other',
  'S-3RD-P': 'passed_other',
  'H-3RD-P': 'passed_other',
  'CONF': 'conference',
  'CCR': 'conference',
  'TATFP': 'truly_agreed',
  'TAT': 'truly_agreed',
  'GOV': 'sent_to_governor',
  'GOV-S': 'signed',
  'GOV-V': 'vetoed',
  'VETO-O': 'veto_overridden',
  'ENACT': 'enacted',
  'WDRN': 'withdrawn',
  'FAIL': 'failed',
  'TAB': 'tabled',
};

// URL template helpers
export function buildHouseUrl(
  template: string,
  params: Record<string, string | number>
): string {
  let url = template;
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`{${key}}`, String(value));
  }
  return `${config.house.baseUrl}${config.house.xmlPath}/${url}`;
}

export function buildHousePdfUrl(
  type: keyof typeof config.house.pdf,
  params: Record<string, string | number>
): string {
  let path = config.house.pdf[type];
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`{${key}}`, String(value));
  }
  const basePath = config.house.pdf.basePath.replace('{SESSION}', config.session.code);
  return `${config.house.baseUrl}${basePath}${path}`;
}

export function buildSenateUrl(
  template: string,
  params: Record<string, string | number>
): string {
  let url = template;
  const yearShort = String(config.session.year).slice(-2);
  url = url.replace('{YY}', yearShort);
  url = url.replace('{YEAR}', String(config.session.year));
  url = url.replace('{SESSION_TYPE}', SESSION_TYPES.regular);
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`{${key}}`, String(value));
  }
  return `${config.senate.baseUrl}${url}`;
}

// ID generation helpers
export function generateBillId(prefix: string, number: number, session: string): string {
  return `bill:${prefix.toLowerCase()}${number}:${session}`;
}

export function generateMemberId(chamber: 'house' | 'senate', district: string): string {
  return `member:${chamber}:${district.padStart(chamber === 'house' ? 3 : 2, '0')}`;
}

export function generateCommitteeId(chamber: string, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `committee:${chamber}:${slug}`;
}

export function generateActionId(billId: string, sequence: number): string {
  return `action:${billId.replace('bill:', '')}:${String(sequence).padStart(3, '0')}`;
}

export function generateFiscalId(lrNumber: string, type: string = 'ORG'): string {
  return `fiscal:${lrNumber}:${type}`;
}

export function generateVersionId(lrNumber: string): string {
  return `version:${lrNumber}`;
}

export default config;
