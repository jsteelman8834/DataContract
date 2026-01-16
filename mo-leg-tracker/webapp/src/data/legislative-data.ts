import type {
  LegislativeGraph,
  Bill,
  Member,
  Committee,
  Hearing,
  Action,
  Summary,
  BillCard,
  CommitteeWithBills,
  MemberWithRole,
  CalendarEvent,
  CommitteeAssignmentEdge,
  CommitteeMembershipEdge,
  SponsorshipEdge,
  Edge,
  FiscalNote,
  FiscalSummary,
  CommitteeFiscalSummary,
  RiskQuadrantBill,
} from '@/types';
import {
  getPassageProbability,
  calculateWeightedImpact,
  calculateFiscalSummary,
  calculateCommitteeFiscalSummaries,
  classifyRiskQuadrant,
} from '@/lib/fiscal-utils';

// Import sample data - in production this would be fetched from an API
import sampleData from '../../db/sample-graph.json';

// Enhanced sample data with more bills for demonstration
const enhancedData: LegislativeGraph = {
  ...sampleData as unknown as LegislativeGraph,
  nodes: {
    ...(sampleData as unknown as LegislativeGraph).nodes,
    bills: {
      ...(sampleData as unknown as LegislativeGraph).nodes.bills,
      // Add more sample bills for better UI demonstration
      'bill:hb1234:261': {
        id: 'bill:hb1234:261',
        billNumber: 'HB 1234',
        billPrefix: 'HB',
        billSuffix: 1234,
        session: '261',
        chamber: 'house',
        title: 'Establishes tax credits for small businesses',
        briefDescription: 'Creates new tax incentives for small businesses employing fewer than 50 workers',
        lrNumber: '5200H.01I',
        currentStatus: 'hearing_scheduled',
        currentCommittee: 'committee:house:ways_means',
        effectiveDate: '2026-08-28',
        introducedDate: '2026-01-10',
        lastActionDate: '2026-01-14',
        withdrawn: false,
        createdAt: '2026-01-10T00:00:00Z',
        updatedAt: '2026-01-14T00:00:00Z',
      },
      'bill:sb900:261': {
        id: 'bill:sb900:261',
        billNumber: 'SB 900',
        billPrefix: 'SB',
        billSuffix: 900,
        session: '261',
        chamber: 'senate',
        title: 'Modifies transportation funding formula',
        briefDescription: 'Updates how state transportation funds are distributed to local governments',
        lrNumber: '4800S.01I',
        currentStatus: 'in_committee',
        currentCommittee: 'committee:senate:transportation',
        effectiveDate: '2026-08-28',
        introducedDate: '2026-01-09',
        lastActionDate: '2026-01-12',
        withdrawn: false,
        createdAt: '2026-01-09T00:00:00Z',
        updatedAt: '2026-01-12T00:00:00Z',
      },
      'bill:hb1500:261': {
        id: 'bill:hb1500:261',
        billNumber: 'HB 1500',
        billPrefix: 'HB',
        billSuffix: 1500,
        session: '261',
        chamber: 'house',
        title: 'Healthcare transparency requirements',
        briefDescription: 'Requires hospitals to publish pricing information for common procedures',
        lrNumber: '5300H.01I',
        currentStatus: 'reported_do_pass',
        currentCommittee: 'committee:house:health',
        effectiveDate: '2026-08-28',
        introducedDate: '2026-01-08',
        lastActionDate: '2026-01-15',
        withdrawn: false,
        createdAt: '2026-01-08T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
      },
      'bill:sb850:261': {
        id: 'bill:sb850:261',
        billNumber: 'SB 850',
        billPrefix: 'SB',
        billSuffix: 850,
        session: '261',
        chamber: 'senate',
        title: 'Property tax relief for seniors',
        briefDescription: 'Provides property tax exemptions for homeowners over 65 with fixed income',
        lrNumber: '4600S.01I',
        currentStatus: 'perfected',
        currentCommittee: null,
        effectiveDate: '2026-08-28',
        introducedDate: '2026-01-07',
        lastActionDate: '2026-01-16',
        withdrawn: false,
        createdAt: '2026-01-07T00:00:00Z',
        updatedAt: '2026-01-16T00:00:00Z',
      },
    },
    committees: {
      ...(sampleData as unknown as LegislativeGraph).nodes.committees,
      'committee:house:ways_means': {
        id: 'committee:house:ways_means',
        chamber: 'house',
        name: 'Ways and Means',
        shortName: 'Ways & Means',
        type: 'standing',
        jurisdiction: 'Taxation, revenue, and fiscal policy',
        meetingRoom: 'HHR 3',
        meetingSchedule: 'Mondays and Thursdays',
        active: true,
        createdAt: '2026-01-08T00:00:00Z',
        updatedAt: '2026-01-08T00:00:00Z',
      },
      'committee:house:health': {
        id: 'committee:house:health',
        chamber: 'house',
        name: 'Health and Mental Health Policy',
        shortName: 'Health',
        type: 'standing',
        jurisdiction: 'Healthcare policy, mental health services, public health',
        meetingRoom: 'HHR 5',
        meetingSchedule: 'Tuesdays and Wednesdays',
        active: true,
        createdAt: '2026-01-08T00:00:00Z',
        updatedAt: '2026-01-08T00:00:00Z',
      },
      'committee:senate:transportation': {
        id: 'committee:senate:transportation',
        chamber: 'senate',
        name: 'Transportation, Infrastructure and Public Safety',
        shortName: 'Transportation',
        type: 'standing',
        jurisdiction: 'Transportation infrastructure, public safety, highways',
        meetingRoom: 'SCR 3',
        meetingSchedule: 'Wednesdays',
        active: true,
        createdAt: '2026-01-08T00:00:00Z',
        updatedAt: '2026-01-08T00:00:00Z',
      },
      'committee:senate:appropriations': {
        id: 'committee:senate:appropriations',
        chamber: 'senate',
        name: 'Appropriations',
        shortName: 'Appropriations',
        type: 'standing',
        jurisdiction: 'State budget, spending, appropriations',
        meetingRoom: 'SCR 4',
        meetingSchedule: 'Mondays and Fridays',
        active: true,
        createdAt: '2026-01-08T00:00:00Z',
        updatedAt: '2026-01-08T00:00:00Z',
      },
    },
    fiscal_notes: {
      // SB 834 - Medicaid expansion - Major cost
      'fiscal:sb834:261:001': {
        id: 'fiscal:sb834:261:001',
        billId: 'bill:sb834:261',
        versionId: null,
        noteType: 'original',
        fiscalYears: [2027, 2028, 2029, 2030, 2031],
        estimatedCost: 156000000,
        estimatedRevenue: 89000000,
        netImpact: -67000000,
        fundImpacts: {
          generalRevenue: -45000000,
          federalFunds: -15000000,
          otherStateFunds: -7000000,
          localGovernment: 0,
        },
        yearByYearImpact: [
          { fiscalYear: 2027, cost: 28000000, revenue: 15000000, netImpact: -13000000 },
          { fiscalYear: 2028, cost: 32000000, revenue: 18000000, netImpact: -14000000 },
          { fiscalYear: 2029, cost: 34000000, revenue: 19000000, netImpact: -15000000 },
          { fiscalYear: 2030, cost: 31000000, revenue: 18500000, netImpact: -12500000 },
          { fiscalYear: 2031, cost: 31000000, revenue: 18500000, netImpact: -12500000 },
        ],
        uncertaintyRange: { low: -85000000, high: -52000000 },
        assumptions: [
          'Federal matching rate remains at current levels',
          'Enrollment projections based on neighboring state data',
          'Administrative costs spread over 5-year implementation',
        ],
        issuingAgency: 'Office of Administration',
        analystName: 'Sarah Mitchell',
        summary: 'This bill would expand Medicaid eligibility, resulting in significant costs offset partially by federal matching funds. Net state cost projected at $67M annually.',
        pdfUrl: '/fiscal-notes/sb834-fiscal-note.pdf',
        publishedDate: '2026-01-10',
        createdAt: '2026-01-10T00:00:00Z',
        updatedAt: '2026-01-10T00:00:00Z',
      },
      // SB 874 - Education funding - Moderate cost
      'fiscal:sb874:261:001': {
        id: 'fiscal:sb874:261:001',
        billId: 'bill:sb874:261',
        versionId: null,
        noteType: 'original',
        fiscalYears: [2027, 2028, 2029],
        estimatedCost: 42000000,
        estimatedRevenue: 0,
        netImpact: -42000000,
        fundImpacts: {
          generalRevenue: -42000000,
          federalFunds: 0,
          otherStateFunds: 0,
          localGovernment: 0,
        },
        yearByYearImpact: [
          { fiscalYear: 2027, cost: 12000000, revenue: 0, netImpact: -12000000 },
          { fiscalYear: 2028, cost: 14000000, revenue: 0, netImpact: -14000000 },
          { fiscalYear: 2029, cost: 16000000, revenue: 0, netImpact: -16000000 },
        ],
        uncertaintyRange: { low: -50000000, high: -35000000 },
        assumptions: [
          'School district participation rate of 85%',
          'Per-pupil funding increase of $150 annually',
        ],
        issuingAgency: 'Department of Elementary and Secondary Education',
        analystName: 'Robert Chen',
        summary: 'Education funding formula modification would increase state expenditures by approximately $42M over three years.',
        pdfUrl: '/fiscal-notes/sb874-fiscal-note.pdf',
        publishedDate: '2026-01-08',
        createdAt: '2026-01-08T00:00:00Z',
        updatedAt: '2026-01-08T00:00:00Z',
      },
      // HB 1607 - Prison reform - Cost savings (revenue positive)
      'fiscal:hb1607:261:001': {
        id: 'fiscal:hb1607:261:001',
        billId: 'bill:hb1607:261',
        versionId: null,
        noteType: 'original',
        fiscalYears: [2027, 2028, 2029, 2030],
        estimatedCost: 8500000,
        estimatedRevenue: 0,
        netImpact: -8500000,
        fundImpacts: {
          generalRevenue: -8500000,
          federalFunds: 0,
          otherStateFunds: 0,
          localGovernment: 0,
        },
        yearByYearImpact: [
          { fiscalYear: 2027, cost: 3000000, revenue: 0, netImpact: -3000000 },
          { fiscalYear: 2028, cost: 2500000, revenue: 0, netImpact: -2500000 },
          { fiscalYear: 2029, cost: 1500000, revenue: 0, netImpact: -1500000 },
          { fiscalYear: 2030, cost: 1500000, revenue: 0, netImpact: -1500000 },
        ],
        uncertaintyRange: { low: -12000000, high: -5000000 },
        assumptions: [
          'Implementation begins FY2027',
          'Training costs front-loaded in year one',
          'Operational savings begin in year two',
        ],
        issuingAgency: 'Department of Corrections',
        analystName: 'Michael Torres',
        summary: 'Sentencing reform implementation costs partially offset by reduced incarceration expenses in later years.',
        pdfUrl: '/fiscal-notes/hb1607-fiscal-note.pdf',
        publishedDate: '2026-01-12',
        createdAt: '2026-01-12T00:00:00Z',
        updatedAt: '2026-01-12T00:00:00Z',
      },
      // HB 1234 - Small business tax credits - Revenue loss
      'fiscal:hb1234:261:001': {
        id: 'fiscal:hb1234:261:001',
        billId: 'bill:hb1234:261',
        versionId: null,
        noteType: 'original',
        fiscalYears: [2027, 2028, 2029, 2030, 2031],
        estimatedCost: 0,
        estimatedRevenue: -35000000,
        netImpact: -35000000,
        fundImpacts: {
          generalRevenue: -35000000,
          federalFunds: 0,
          otherStateFunds: 0,
          localGovernment: 0,
        },
        yearByYearImpact: [
          { fiscalYear: 2027, cost: 0, revenue: -5000000, netImpact: -5000000 },
          { fiscalYear: 2028, cost: 0, revenue: -7000000, netImpact: -7000000 },
          { fiscalYear: 2029, cost: 0, revenue: -8000000, netImpact: -8000000 },
          { fiscalYear: 2030, cost: 0, revenue: -7500000, netImpact: -7500000 },
          { fiscalYear: 2031, cost: 0, revenue: -7500000, netImpact: -7500000 },
        ],
        uncertaintyRange: { low: -45000000, high: -25000000 },
        assumptions: [
          'Tax credit utilization rate of 70%',
          'Average small business qualifies for $2,500 credit',
          'Economic growth offsets some revenue loss',
        ],
        issuingAgency: 'Department of Revenue',
        analystName: 'Lisa Wong',
        summary: 'Tax credit program for small businesses would reduce state revenue by approximately $35M annually at full implementation.',
        pdfUrl: '/fiscal-notes/hb1234-fiscal-note.pdf',
        publishedDate: '2026-01-14',
        createdAt: '2026-01-14T00:00:00Z',
        updatedAt: '2026-01-14T00:00:00Z',
      },
      // SB 900 - Transportation funding - Major appropriation
      'fiscal:sb900:261:001': {
        id: 'fiscal:sb900:261:001',
        billId: 'bill:sb900:261',
        versionId: null,
        noteType: 'original',
        fiscalYears: [2027, 2028, 2029, 2030],
        estimatedCost: 125000000,
        estimatedRevenue: 45000000,
        netImpact: -80000000,
        fundImpacts: {
          generalRevenue: -25000000,
          federalFunds: -35000000,
          otherStateFunds: -20000000,
          localGovernment: 0,
        },
        yearByYearImpact: [
          { fiscalYear: 2027, cost: 35000000, revenue: 10000000, netImpact: -25000000 },
          { fiscalYear: 2028, cost: 32000000, revenue: 12000000, netImpact: -20000000 },
          { fiscalYear: 2029, cost: 30000000, revenue: 12000000, netImpact: -18000000 },
          { fiscalYear: 2030, cost: 28000000, revenue: 11000000, netImpact: -17000000 },
        ],
        uncertaintyRange: { low: -100000000, high: -65000000 },
        assumptions: [
          'Federal infrastructure matching at 80%',
          'Bond issuance over 4-year period',
          'Local government cost-sharing of 15%',
        ],
        issuingAgency: 'Missouri Department of Transportation',
        analystName: 'James Patterson',
        summary: 'Transportation infrastructure investment with federal matching funds. Net state cost of $80M over four years.',
        pdfUrl: '/fiscal-notes/sb900-fiscal-note.pdf',
        publishedDate: '2026-01-11',
        createdAt: '2026-01-11T00:00:00Z',
        updatedAt: '2026-01-11T00:00:00Z',
      },
      // HB 1500 - Healthcare transparency - Minimal cost
      'fiscal:hb1500:261:001': {
        id: 'fiscal:hb1500:261:001',
        billId: 'bill:hb1500:261',
        versionId: null,
        noteType: 'original',
        fiscalYears: [2027, 2028],
        estimatedCost: 1200000,
        estimatedRevenue: 0,
        netImpact: -1200000,
        fundImpacts: {
          generalRevenue: -1200000,
          federalFunds: 0,
          otherStateFunds: 0,
          localGovernment: 0,
        },
        yearByYearImpact: [
          { fiscalYear: 2027, cost: 800000, revenue: 0, netImpact: -800000 },
          { fiscalYear: 2028, cost: 400000, revenue: 0, netImpact: -400000 },
        ],
        uncertaintyRange: { low: -1500000, high: -900000 },
        assumptions: [
          'Database development costs in year one',
          'Ongoing maintenance costs minimal',
          'No additional FTEs required',
        ],
        issuingAgency: 'Department of Health and Senior Services',
        analystName: 'Karen Martinez',
        summary: 'Healthcare price transparency requirements with modest implementation costs.',
        pdfUrl: '/fiscal-notes/hb1500-fiscal-note.pdf',
        publishedDate: '2026-01-15',
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
      },
      // SB 850 - Senior property tax relief - Revenue loss
      'fiscal:sb850:261:001': {
        id: 'fiscal:sb850:261:001',
        billId: 'bill:sb850:261',
        versionId: null,
        noteType: 'original',
        fiscalYears: [2027, 2028, 2029, 2030, 2031],
        estimatedCost: 0,
        estimatedRevenue: -28000000,
        netImpact: -28000000,
        fundImpacts: {
          generalRevenue: 0,
          federalFunds: 0,
          otherStateFunds: 0,
          localGovernment: -28000000,
        },
        yearByYearImpact: [
          { fiscalYear: 2027, cost: 0, revenue: -4500000, netImpact: -4500000 },
          { fiscalYear: 2028, cost: 0, revenue: -5500000, netImpact: -5500000 },
          { fiscalYear: 2029, cost: 0, revenue: -6000000, netImpact: -6000000 },
          { fiscalYear: 2030, cost: 0, revenue: -6000000, netImpact: -6000000 },
          { fiscalYear: 2031, cost: 0, revenue: -6000000, netImpact: -6000000 },
        ],
        uncertaintyRange: { low: -35000000, high: -22000000 },
        assumptions: [
          'Estimated 85,000 eligible seniors',
          'Average property tax relief of $330 per household',
          'Local government absorbs revenue impact',
        ],
        issuingAgency: 'State Tax Commission',
        analystName: 'David Anderson',
        summary: 'Property tax exemption for seniors would reduce local government revenues by $28M annually. State backfill not included.',
        pdfUrl: '/fiscal-notes/sb850-fiscal-note.pdf',
        publishedDate: '2026-01-13',
        createdAt: '2026-01-13T00:00:00Z',
        updatedAt: '2026-01-13T00:00:00Z',
      },
    },
    hearings: {
      ...(sampleData as unknown as LegislativeGraph).nodes.hearings,
      'hearing:2026-01-21:ways_means:001': {
        id: 'hearing:2026-01-21:ways_means:001',
        committeeId: 'committee:house:ways_means',
        hearingDate: '2026-01-21',
        hearingTime: '10:00',
        room: 'HHR 3 - 3rd Floor',
        type: 'public',
        status: 'scheduled',
        agendaUrl: null,
        minutesUrl: null,
        videoUrl: null,
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
      },
      'hearing:2026-01-22:education:001': {
        id: 'hearing:2026-01-22:education:001',
        committeeId: 'committee:senate:education',
        hearingDate: '2026-01-22',
        hearingTime: '09:00',
        room: 'SCR 2 - 2nd Floor',
        type: 'public',
        status: 'scheduled',
        agendaUrl: null,
        minutesUrl: null,
        videoUrl: null,
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
      },
    },
    members: {
      ...(sampleData as unknown as LegislativeGraph).nodes.members,
      'member:house:050': {
        id: 'member:house:050',
        chamber: 'house',
        district: '050',
        firstName: 'Maria',
        lastName: 'Garcia',
        fullName: 'Maria Garcia',
        party: 'D',
        title: 'Representative',
        email: 'maria.garcia@house.mo.gov',
        phone: '(573) 751-0050',
        photoUrl: null,
        termStart: '2025-01-01',
        termEnd: '2027-01-01',
        active: true,
        createdAt: '2026-01-08T00:00:00Z',
        updatedAt: '2026-01-08T00:00:00Z',
      },
      'member:senate:05': {
        id: 'member:senate:05',
        chamber: 'senate',
        district: '05',
        firstName: 'Robert',
        lastName: 'Johnson',
        fullName: 'Robert Johnson',
        party: 'R',
        title: 'Senator',
        email: 'robert.johnson@senate.mo.gov',
        phone: '(573) 751-0005',
        photoUrl: null,
        termStart: '2023-01-01',
        termEnd: '2027-01-01',
        active: true,
        createdAt: '2026-01-08T00:00:00Z',
        updatedAt: '2026-01-08T00:00:00Z',
      },
    },
  },
  edges: {
    ...(sampleData as unknown as LegislativeGraph).edges,
    HAS_FISCAL_NOTE: [
      { from: 'bill:sb834:261', to: 'fiscal:sb834:261:001', properties: {} },
      { from: 'bill:sb874:261', to: 'fiscal:sb874:261:001', properties: {} },
      { from: 'bill:hb1607:261', to: 'fiscal:hb1607:261:001', properties: {} },
      { from: 'bill:hb1234:261', to: 'fiscal:hb1234:261:001', properties: {} },
      { from: 'bill:sb900:261', to: 'fiscal:sb900:261:001', properties: {} },
      { from: 'bill:hb1500:261', to: 'fiscal:hb1500:261:001', properties: {} },
      { from: 'bill:sb850:261', to: 'fiscal:sb850:261:001', properties: {} },
    ],
    ASSIGNED_TO: [
      ...(sampleData as unknown as LegislativeGraph).edges.ASSIGNED_TO,
      {
        from: 'bill:hb1234:261',
        to: 'committee:house:ways_means',
        properties: { assignedDate: '2026-01-14', referralType: 'initial', status: 'pending' },
      },
      {
        from: 'bill:sb900:261',
        to: 'committee:senate:transportation',
        properties: { assignedDate: '2026-01-12', referralType: 'initial', status: 'pending' },
      },
      {
        from: 'bill:hb1500:261',
        to: 'committee:house:health',
        properties: { assignedDate: '2026-01-10', referralType: 'initial', status: 'reported' },
      },
    ],
    SCHEDULED_FOR: [
      ...(sampleData as unknown as LegislativeGraph).edges.SCHEDULED_FOR,
      {
        from: 'bill:hb1234:261',
        to: 'hearing:2026-01-21:ways_means:001',
        properties: { agendaPosition: 1 },
      },
      {
        from: 'bill:sb874:261',
        to: 'hearing:2026-01-22:education:001',
        properties: { agendaPosition: 1 },
      },
    ],
    SPONSORED_BY: [
      ...(sampleData as unknown as LegislativeGraph).edges.SPONSORED_BY,
      {
        from: 'bill:hb1234:261',
        to: 'member:house:050',
        properties: { sponsorType: 'primary' },
      },
      {
        from: 'bill:sb900:261',
        to: 'member:senate:05',
        properties: { sponsorType: 'primary' },
      },
      {
        from: 'bill:hb1500:261',
        to: 'member:house:001',
        properties: { sponsorType: 'primary' },
      },
      {
        from: 'bill:sb850:261',
        to: 'member:senate:28',
        properties: { sponsorType: 'primary' },
      },
    ],
    MEMBER_OF: [
      ...(sampleData as unknown as LegislativeGraph).edges.MEMBER_OF,
      {
        from: 'member:house:050',
        to: 'committee:house:ways_means',
        properties: { role: 'chair', startDate: '2025-01-01', endDate: null },
      },
      {
        from: 'member:senate:05',
        to: 'committee:senate:transportation',
        properties: { role: 'chair', startDate: '2025-01-01', endDate: null },
      },
      {
        from: 'member:house:001',
        to: 'committee:house:health',
        properties: { role: 'member', startDate: '2025-01-01', endDate: null },
      },
    ],
  },
};

// Data access functions
class LegislativeDataService {
  private data: LegislativeGraph;

  constructor(data: LegislativeGraph) {
    this.data = data;
  }

  // Bills
  getAllBills(): Bill[] {
    return Object.values(this.data.nodes.bills);
  }

  getBillById(id: string): Bill | null {
    return this.data.nodes.bills[id] || null;
  }

  getBillByNumber(billNumber: string): Bill | null {
    const normalizedNumber = billNumber.toUpperCase().replace(/\s+/g, ' ');
    return this.getAllBills().find(
      (bill) => bill.billNumber.toUpperCase() === normalizedNumber
    ) || null;
  }

  getBillsByChamber(chamber: 'house' | 'senate'): Bill[] {
    return this.getAllBills().filter((bill) => bill.chamber === chamber);
  }

  getBillsByStatus(status: string): Bill[] {
    return this.getAllBills().filter((bill) => bill.currentStatus === status);
  }

  getBillsByCommittee(committeeId: string): Bill[] {
    return this.getAllBills().filter((bill) => bill.currentCommittee === committeeId);
  }

  // Members
  getAllMembers(): Member[] {
    return Object.values(this.data.nodes.members);
  }

  getMemberById(id: string): Member | null {
    return this.data.nodes.members[id] || null;
  }

  getMembersByChamber(chamber: 'house' | 'senate'): Member[] {
    return this.getAllMembers().filter((member) => member.chamber === chamber);
  }

  getMembersByParty(party: 'R' | 'D' | 'I'): Member[] {
    return this.getAllMembers().filter((member) => member.party === party);
  }

  // Committees
  getAllCommittees(): Committee[] {
    return Object.values(this.data.nodes.committees);
  }

  getCommitteeById(id: string): Committee | null {
    return this.data.nodes.committees[id] || null;
  }

  getCommitteesByChamber(chamber: 'house' | 'senate'): Committee[] {
    return this.getAllCommittees().filter((committee) => committee.chamber === chamber);
  }

  // Hearings
  getAllHearings(): Hearing[] {
    return Object.values(this.data.nodes.hearings);
  }

  getHearingById(id: string): Hearing | null {
    return this.data.nodes.hearings[id] || null;
  }

  getHearingsByCommittee(committeeId: string): Hearing[] {
    return this.getAllHearings().filter((hearing) => hearing.committeeId === committeeId);
  }

  getUpcomingHearings(): Hearing[] {
    const today = new Date().toISOString().split('T')[0];
    return this.getAllHearings()
      .filter((hearing) => hearing.hearingDate >= today && hearing.status === 'scheduled')
      .sort((a, b) => a.hearingDate.localeCompare(b.hearingDate));
  }

  // Actions
  getActionsForBill(billId: string): Action[] {
    return Object.values(this.data.nodes.actions)
      .filter((action) => action.billId === billId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  // Summaries
  getSummaryForBill(billId: string): Summary | null {
    return Object.values(this.data.nodes.summaries).find(
      (summary) => summary.billId === billId
    ) || null;
  }

  // Relationships
  getSponsorForBill(billId: string): Member | null {
    const edge = this.data.edges.SPONSORED_BY.find(
      (e) => e.from === billId && (e.properties as SponsorshipEdge).sponsorType === 'primary'
    );
    return edge ? this.getMemberById(edge.to) : null;
  }

  getCoSponsorsForBill(billId: string): Member[] {
    const edges = this.data.edges.CO_SPONSORED_BY.filter((e) => e.from === billId);
    return edges.map((e) => this.getMemberById(e.to)).filter((m): m is Member => m !== null);
  }

  getBillsForSponsor(memberId: string): Bill[] {
    const edges = this.data.edges.SPONSORED_BY.filter((e) => e.to === memberId);
    return edges.map((e) => this.getBillById(e.from)).filter((b): b is Bill => b !== null);
  }

  getCommitteeMembers(committeeId: string): MemberWithRole[] {
    const edges = this.data.edges.MEMBER_OF.filter((e) => e.to === committeeId);
    return edges
      .map((e) => {
        const member = this.getMemberById(e.from);
        if (!member) return null;
        return {
          ...member,
          role: (e.properties as CommitteeMembershipEdge).role,
        };
      })
      .filter((m): m is MemberWithRole => m !== null)
      .sort((a, b) => {
        const roleOrder = { chair: 0, vice_chair: 1, ranking_member: 2, member: 3 };
        return roleOrder[a.role] - roleOrder[b.role];
      });
  }

  getCommitteesForMember(memberId: string): { committee: Committee; role: string }[] {
    const edges = this.data.edges.MEMBER_OF.filter((e) => e.from === memberId);
    const results: { committee: Committee; role: string }[] = [];
    for (const e of edges) {
      const committee = this.getCommitteeById(e.to);
      if (committee) {
        results.push({
          committee,
          role: (e.properties as CommitteeMembershipEdge).role,
        });
      }
    }
    return results;
  }

  getHearingsForBill(billId: string): Hearing[] {
    const edges = this.data.edges.SCHEDULED_FOR.filter((e) => e.from === billId);
    return edges
      .map((e) => this.getHearingById(e.to))
      .filter((h): h is Hearing => h !== null);
  }

  getBillsForHearing(hearingId: string): Bill[] {
    const edges = this.data.edges.SCHEDULED_FOR.filter((e) => e.to === hearingId);
    return edges
      .map((e) => this.getBillById(e.from))
      .filter((b): b is Bill => b !== null);
  }

  // Fiscal Notes
  getAllFiscalNotes(): FiscalNote[] {
    return Object.values(this.data.nodes.fiscal_notes);
  }

  getFiscalNoteById(id: string): FiscalNote | null {
    return this.data.nodes.fiscal_notes[id] || null;
  }

  getFiscalNoteForBill(billId: string): FiscalNote | null {
    const edge = this.data.edges.HAS_FISCAL_NOTE?.find((e) => e.from === billId);
    return edge ? this.getFiscalNoteById(edge.to) : null;
  }

  getBillsWithFiscalNotes(): Array<{ bill: Bill; fiscalNote: FiscalNote }> {
    const result: Array<{ bill: Bill; fiscalNote: FiscalNote }> = [];

    for (const edge of this.data.edges.HAS_FISCAL_NOTE || []) {
      const bill = this.getBillById(edge.from);
      const fiscalNote = this.getFiscalNoteById(edge.to);
      if (bill && fiscalNote) {
        result.push({ bill, fiscalNote });
      }
    }

    return result;
  }

  // Fiscal summaries
  getSessionFiscalSummary(): FiscalSummary {
    const billsWithFiscal = this.getBillsWithFiscalNotes();
    return calculateFiscalSummary(billsWithFiscal);
  }

  getCommitteeFiscalSummaries(): CommitteeFiscalSummary[] {
    const billsWithFiscal = this.getBillsWithFiscalNotes();
    const committees = this.getAllCommittees();
    return calculateCommitteeFiscalSummaries(billsWithFiscal, committees);
  }

  getRiskQuadrantBills(): RiskQuadrantBill[] {
    const billsWithFiscal = this.getBillsWithFiscalNotes();
    return billsWithFiscal.map(({ bill, fiscalNote }) =>
      classifyRiskQuadrant(bill, fiscalNote)
    );
  }

  getHighImpactBills(threshold: number = 10_000_000): Array<{ bill: Bill; fiscalNote: FiscalNote; weightedImpact: number }> {
    const billsWithFiscal = this.getBillsWithFiscalNotes();
    return billsWithFiscal
      .map(({ bill, fiscalNote }) => ({
        bill,
        fiscalNote,
        weightedImpact: calculateWeightedImpact(
          fiscalNote.netImpact,
          getPassageProbability(bill.currentStatus)
        ),
      }))
      .filter(({ fiscalNote }) => Math.abs(fiscalNote.netImpact) >= threshold)
      .sort((a, b) => Math.abs(b.weightedImpact) - Math.abs(a.weightedImpact));
  }

  // Computed data for UI
  getBillCard(bill: Bill): BillCard {
    const sponsor = this.getSponsorForBill(bill.id);
    const summary = this.getSummaryForBill(bill.id);
    const fiscalNote = this.getFiscalNoteForBill(bill.id);
    const assignment = this.data.edges.ASSIGNED_TO.find(
      (e) => e.from === bill.id && (e.properties as CommitteeAssignmentEdge).status === 'pending'
    );
    const daysInCommittee = assignment
      ? Math.ceil(
          (Date.now() - new Date((assignment.properties as CommitteeAssignmentEdge).assignedDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;
    const upcomingHearings = this.getHearingsForBill(bill.id).filter(
      (h) => h.hearingDate >= new Date().toISOString().split('T')[0]
    );

    const passageProbability = getPassageProbability(bill.currentStatus);
    const weightedFiscalImpact = fiscalNote
      ? calculateWeightedImpact(fiscalNote.netImpact, passageProbability)
      : 0;

    return {
      bill,
      sponsor,
      daysInCommittee,
      hasUpcomingHearing: upcomingHearings.length > 0,
      summary,
      fiscalNote,
      passageProbability,
      weightedFiscalImpact,
    };
  }

  getCommitteeWithBills(committee: Committee): CommitteeWithBills {
    const bills = this.getBillsByCommittee(committee.id).map((bill) =>
      this.getBillCard(bill)
    );
    const members = this.getCommitteeMembers(committee.id);
    const upcomingHearings = this.getHearingsByCommittee(committee.id).filter(
      (h) => h.hearingDate >= new Date().toISOString().split('T')[0]
    );

    return {
      committee,
      bills,
      members,
      upcomingHearings,
    };
  }

  // Calendar events
  getCalendarEvents(startDate: string, endDate: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    // Add hearing events
    this.getAllHearings()
      .filter((h) => h.hearingDate >= startDate && h.hearingDate <= endDate)
      .forEach((hearing) => {
        const committee = this.getCommitteeById(hearing.committeeId);
        const bills = this.getBillsForHearing(hearing.id);
        events.push({
          id: hearing.id,
          date: hearing.hearingDate,
          time: hearing.hearingTime,
          type: 'hearing',
          title: committee ? `${committee.shortName} Hearing` : 'Committee Hearing',
          description: `${hearing.type.charAt(0).toUpperCase() + hearing.type.slice(1)} hearing`,
          committee: committee || undefined,
          bills: bills.length > 0 ? bills : undefined,
          room: hearing.room,
        });
      });

    return events.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });
  }

  // Statistics
  getStatistics() {
    const bills = this.getAllBills();
    const members = this.getAllMembers();
    const committees = this.getAllCommittees();

    return {
      totalBills: bills.length,
      houseBills: bills.filter((b) => b.chamber === 'house').length,
      senateBills: bills.filter((b) => b.chamber === 'senate').length,
      totalMembers: members.length,
      houseMembers: members.filter((m) => m.chamber === 'house').length,
      senateMembers: members.filter((m) => m.chamber === 'senate').length,
      totalCommittees: committees.length,
      houseCommittees: committees.filter((c) => c.chamber === 'house').length,
      senateCommittees: committees.filter((c) => c.chamber === 'senate').length,
      upcomingHearings: this.getUpcomingHearings().length,
    };
  }
}

// Export singleton instance
export const legislativeData = new LegislativeDataService(enhancedData);

// Export for use in components
export default legislativeData;
