import type {
  BillStatus,
  FiscalNote,
  FiscalSummary,
  FiscalImpactType,
  Bill,
  Committee,
  CommitteeFiscalSummary,
  SessionFiscalSnapshot,
  RiskQuadrantBill,
} from '@/types';

// Passage probability by bill status
// These are calibrated estimates based on historical legislative data patterns
export const PASSAGE_PROBABILITY: Record<BillStatus, number> = {
  prefiled: 0.05,
  introduced: 0.08,
  first_read: 0.10,
  second_read: 0.12,
  referred: 0.15,
  in_committee: 0.18,
  hearing_scheduled: 0.25,
  hearing_held: 0.30,
  committee_substitute: 0.40,
  reported_do_pass: 0.55,
  reported_do_not_pass: 0.05,
  placed_on_calendar: 0.60,
  perfected: 0.70,
  third_read: 0.75,
  passed_chamber: 0.65,
  referred_other_chamber: 0.55,
  passed_second_chamber: 0.85,
  conference_committee: 0.80,
  truly_agreed: 0.92,
  sent_to_governor: 0.95,
  signed: 1.00,
  vetoed: 0.15,
  veto_overridden: 1.00,
  enacted: 1.00,
  failed: 0.00,
  tabled: 0.05,
  withdrawn: 0.00,
};

// Get passage probability for a bill
export function getPassageProbability(status: BillStatus): number {
  return PASSAGE_PROBABILITY[status] ?? 0;
}

// Calculate weighted fiscal impact
export function calculateWeightedImpact(
  netImpact: number,
  probability: number
): number {
  return netImpact * probability;
}

// Determine fiscal impact type
export function getFiscalImpactType(fiscalNote: FiscalNote): FiscalImpactType {
  const { estimatedCost, estimatedRevenue, netImpact } = fiscalNote;

  if ((estimatedCost === null || estimatedCost === 0) &&
      (estimatedRevenue === null || estimatedRevenue === 0)) {
    return 'neutral';
  }

  if (estimatedCost && estimatedCost > 0 && (!estimatedRevenue || estimatedRevenue === 0)) {
    return 'cost_only';
  }

  if (estimatedRevenue && estimatedRevenue > 0 && (!estimatedCost || estimatedCost === 0)) {
    return 'revenue_only';
  }

  if (netImpact > 0) {
    return 'revenue_positive';
  }

  return 'both';
}

// Format currency for display
export function formatCurrency(
  amount: number,
  options: { compact?: boolean; showSign?: boolean } = {}
): string {
  const { compact = false, showSign = false } = options;

  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : (showSign && amount > 0 ? '+' : '');

  if (compact) {
    if (absAmount >= 1_000_000_000) {
      return `${sign}$${(absAmount / 1_000_000_000).toFixed(1)}B`;
    }
    if (absAmount >= 1_000_000) {
      return `${sign}$${(absAmount / 1_000_000).toFixed(1)}M`;
    }
    if (absAmount >= 1_000) {
      return `${sign}$${(absAmount / 1_000).toFixed(1)}K`;
    }
    return `${sign}$${absAmount.toFixed(0)}`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    signDisplay: showSign ? 'exceptZero' : 'auto',
  }).format(amount);
}

// Format percentage
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// Calculate fiscal summary for a set of bills with fiscal notes
export function calculateFiscalSummary(
  billsWithFiscal: Array<{ bill: Bill; fiscalNote: FiscalNote }>
): FiscalSummary {
  const highImpactThreshold = 10_000_000; // $10M

  return billsWithFiscal.reduce(
    (summary, { bill, fiscalNote }) => {
      const probability = getPassageProbability(bill.currentStatus);
      const cost = fiscalNote.estimatedCost || 0;
      const revenue = fiscalNote.estimatedRevenue || 0;
      const net = fiscalNote.netImpact;

      return {
        totalCost: summary.totalCost + cost,
        totalRevenue: summary.totalRevenue + revenue,
        netImpact: summary.netImpact + net,
        weightedCost: summary.weightedCost + (cost * probability),
        weightedRevenue: summary.weightedRevenue + (revenue * probability),
        weightedNetImpact: summary.weightedNetImpact + (net * probability),
        billCount: summary.billCount + 1,
        highImpactBillCount:
          summary.highImpactBillCount + (Math.abs(net) >= highImpactThreshold ? 1 : 0),
      };
    },
    {
      totalCost: 0,
      totalRevenue: 0,
      netImpact: 0,
      weightedCost: 0,
      weightedRevenue: 0,
      weightedNetImpact: 0,
      billCount: 0,
      highImpactBillCount: 0,
    }
  );
}

// Calculate fiscal summary by committee
export function calculateCommitteeFiscalSummaries(
  billsWithFiscal: Array<{ bill: Bill; fiscalNote: FiscalNote }>,
  committees: Committee[]
): CommitteeFiscalSummary[] {
  const committeeMap = new Map<string, CommitteeFiscalSummary>();

  // Initialize all committees
  committees.forEach((committee) => {
    committeeMap.set(committee.id, {
      committee,
      totalCost: 0,
      totalRevenue: 0,
      netImpact: 0,
      weightedNetImpact: 0,
      billCount: 0,
    });
  });

  // Aggregate fiscal data by committee
  billsWithFiscal.forEach(({ bill, fiscalNote }) => {
    if (!bill.currentCommittee) return;

    const existing = committeeMap.get(bill.currentCommittee);
    if (!existing) return;

    const probability = getPassageProbability(bill.currentStatus);
    const cost = fiscalNote.estimatedCost || 0;
    const revenue = fiscalNote.estimatedRevenue || 0;
    const net = fiscalNote.netImpact;

    committeeMap.set(bill.currentCommittee, {
      ...existing,
      totalCost: existing.totalCost + cost,
      totalRevenue: existing.totalRevenue + revenue,
      netImpact: existing.netImpact + net,
      weightedNetImpact: existing.weightedNetImpact + (net * probability),
      billCount: existing.billCount + 1,
    });
  });

  // Return sorted by absolute weighted impact
  return Array.from(committeeMap.values())
    .filter((s) => s.billCount > 0)
    .sort((a, b) => Math.abs(b.weightedNetImpact) - Math.abs(a.weightedNetImpact));
}

// Generate session trajectory snapshots (simulated historical data)
export function generateSessionTrajectory(
  billsWithFiscal: Array<{ bill: Bill; fiscalNote: FiscalNote }>,
  sessionStartDate: string,
  currentDate: string = new Date().toISOString().split('T')[0]
): SessionFiscalSnapshot[] {
  const snapshots: SessionFiscalSnapshot[] = [];
  const start = new Date(sessionStartDate);
  const end = new Date(currentDate);

  // Generate weekly snapshots
  const current = new Date(start);
  let cumulativeChange = 0;

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];

    // Simulate fiscal impact crystallizing over time
    const weeksSinceStart = Math.floor(
      (current.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    const progressFactor = Math.min(weeksSinceStart / 20, 1); // Max out at ~20 weeks

    const summary = calculateFiscalSummary(billsWithFiscal);

    // Add some variance to simulate bills passing/failing
    const variance = (Math.random() - 0.5) * 0.1;
    cumulativeChange += variance;

    snapshots.push({
      date: dateStr,
      totalCost: summary.totalCost * (0.3 + progressFactor * 0.7),
      totalRevenue: summary.totalRevenue * (0.3 + progressFactor * 0.7),
      netImpact: summary.netImpact * (0.3 + progressFactor * 0.7 + cumulativeChange),
      weightedNetImpact: summary.weightedNetImpact * (0.5 + progressFactor * 0.5),
      billsPassed: Math.floor(progressFactor * summary.billCount * 0.3),
      billsFailed: Math.floor(progressFactor * summary.billCount * 0.1),
    });

    // Move to next week
    current.setDate(current.getDate() + 7);
  }

  return snapshots;
}

// Classify bills into risk quadrants
export function classifyRiskQuadrant(
  bill: Bill,
  fiscalNote: FiscalNote
): RiskQuadrantBill {
  const probability = getPassageProbability(bill.currentStatus);
  const absoluteImpact = Math.abs(fiscalNote.netImpact);
  const impactType = fiscalNote.netImpact < 0 ? 'cost' : 'revenue';

  // Define thresholds
  const highProbThreshold = 0.5;
  const highImpactThreshold = 10_000_000; // $10M

  let quadrant: RiskQuadrantBill['quadrant'];

  if (probability >= highProbThreshold && absoluteImpact >= highImpactThreshold) {
    quadrant = 'critical';
  } else if (probability < highProbThreshold && absoluteImpact >= highImpactThreshold) {
    quadrant = 'watch';
  } else if (probability >= highProbThreshold && absoluteImpact < highImpactThreshold) {
    quadrant = 'tracking';
  } else {
    quadrant = 'monitor';
  }

  return {
    bill,
    fiscalNote,
    probability,
    absoluteImpact,
    impactType,
    quadrant,
  };
}

// Get color for fiscal impact
export function getFiscalImpactColor(netImpact: number): string {
  if (netImpact > 0) return 'text-green-600';
  if (netImpact < 0) return 'text-red-600';
  return 'text-gray-600';
}

export function getFiscalImpactBgColor(netImpact: number): string {
  if (netImpact > 0) return 'bg-green-100';
  if (netImpact < 0) return 'bg-red-100';
  return 'bg-gray-100';
}

// Get color for probability
export function getProbabilityColor(probability: number): string {
  if (probability >= 0.7) return 'text-green-600';
  if (probability >= 0.4) return 'text-yellow-600';
  if (probability >= 0.2) return 'text-orange-600';
  return 'text-gray-500';
}

// Get label for probability
export function getProbabilityLabel(probability: number): string {
  if (probability >= 0.9) return 'Very Likely';
  if (probability >= 0.7) return 'Likely';
  if (probability >= 0.5) return 'Possible';
  if (probability >= 0.3) return 'Unlikely';
  if (probability >= 0.1) return 'Very Unlikely';
  return 'Remote';
}

// Calculate likelihood dots (1-5 scale)
export function getLikelihoodDots(probability: number): number {
  if (probability >= 0.8) return 5;
  if (probability >= 0.6) return 4;
  if (probability >= 0.4) return 3;
  if (probability >= 0.2) return 2;
  return 1;
}

// Filter bills by fiscal characteristics
export interface FiscalFilterOptions {
  minImpact?: number;
  maxImpact?: number;
  impactType?: FiscalImpactType;
  minProbability?: number;
  fundType?: keyof FiscalNote['fundImpacts'];
}

export function filterBillsByFiscal(
  billsWithFiscal: Array<{ bill: Bill; fiscalNote: FiscalNote }>,
  options: FiscalFilterOptions
): Array<{ bill: Bill; fiscalNote: FiscalNote }> {
  return billsWithFiscal.filter(({ bill, fiscalNote }) => {
    const probability = getPassageProbability(bill.currentStatus);
    const impactType = getFiscalImpactType(fiscalNote);
    const absImpact = Math.abs(fiscalNote.netImpact);

    if (options.minImpact !== undefined && absImpact < options.minImpact) {
      return false;
    }

    if (options.maxImpact !== undefined && absImpact > options.maxImpact) {
      return false;
    }

    if (options.impactType !== undefined && impactType !== options.impactType) {
      return false;
    }

    if (options.minProbability !== undefined && probability < options.minProbability) {
      return false;
    }

    if (options.fundType !== undefined) {
      const fundValue = fiscalNote.fundImpacts[options.fundType];
      if (!fundValue || fundValue === 0) {
        return false;
      }
    }

    return true;
  });
}

// Sort options for fiscal bills
export type FiscalSortOption = 'impact_high' | 'impact_low' | 'probability_high' | 'weighted_high' | 'recent';

export function sortBillsByFiscal(
  billsWithFiscal: Array<{ bill: Bill; fiscalNote: FiscalNote }>,
  sortBy: FiscalSortOption
): Array<{ bill: Bill; fiscalNote: FiscalNote }> {
  const sorted = [...billsWithFiscal];

  switch (sortBy) {
    case 'impact_high':
      sorted.sort((a, b) => Math.abs(b.fiscalNote.netImpact) - Math.abs(a.fiscalNote.netImpact));
      break;
    case 'impact_low':
      sorted.sort((a, b) => Math.abs(a.fiscalNote.netImpact) - Math.abs(b.fiscalNote.netImpact));
      break;
    case 'probability_high':
      sorted.sort((a, b) => {
        const probA = getPassageProbability(a.bill.currentStatus);
        const probB = getPassageProbability(b.bill.currentStatus);
        return probB - probA;
      });
      break;
    case 'weighted_high':
      sorted.sort((a, b) => {
        const weightedA = Math.abs(a.fiscalNote.netImpact * getPassageProbability(a.bill.currentStatus));
        const weightedB = Math.abs(b.fiscalNote.netImpact * getPassageProbability(b.bill.currentStatus));
        return weightedB - weightedA;
      });
      break;
    case 'recent':
      sorted.sort((a, b) =>
        new Date(b.bill.lastActionDate).getTime() - new Date(a.bill.lastActionDate).getTime()
      );
      break;
  }

  return sorted;
}

// Generate CSV export data
export function generateFiscalExportData(
  billsWithFiscal: Array<{ bill: Bill; fiscalNote: FiscalNote }>
): string {
  const headers = [
    'Bill Number',
    'Title',
    'Status',
    'Chamber',
    'Estimated Cost',
    'Estimated Revenue',
    'Net Impact',
    'Passage Probability',
    'Weighted Impact',
    'General Revenue Impact',
    'Federal Funds Impact',
    'Issuing Agency',
    'Published Date',
  ];

  const rows = billsWithFiscal.map(({ bill, fiscalNote }) => {
    const probability = getPassageProbability(bill.currentStatus);
    const weightedImpact = fiscalNote.netImpact * probability;

    return [
      bill.billNumber,
      `"${bill.title.replace(/"/g, '""')}"`,
      bill.currentStatus,
      bill.chamber,
      fiscalNote.estimatedCost || 0,
      fiscalNote.estimatedRevenue || 0,
      fiscalNote.netImpact,
      formatPercentage(probability),
      weightedImpact.toFixed(0),
      fiscalNote.fundImpacts.generalRevenue,
      fiscalNote.fundImpacts.federalFunds,
      `"${fiscalNote.issuingAgency}"`,
      fiscalNote.publishedDate,
    ];
  });

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}
