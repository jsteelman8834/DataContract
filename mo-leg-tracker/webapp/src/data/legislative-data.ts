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
} from '@/types';

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

  // Computed data for UI
  getBillCard(bill: Bill): BillCard {
    const sponsor = this.getSponsorForBill(bill.id);
    const summary = this.getSummaryForBill(bill.id);
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

    return {
      bill,
      sponsor,
      daysInCommittee,
      hasUpcomingHearing: upcomingHearings.length > 0,
      summary,
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
