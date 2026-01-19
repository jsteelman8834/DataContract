import type {
  LegislativeGraph,
  Bill,
  BillVersion,
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

// Import data from JSON database - this is the single source of truth
// The sync module writes to this same file
import graphData from '../../db/graph.json';

// Cast to proper type
const data = graphData as unknown as LegislativeGraph;

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

  // Bill Versions
  getBillVersionsForBill(billId: string): BillVersion[] {
    return Object.values(this.data.nodes.bill_versions)
      .filter((version) => version.billId === billId)
      .sort((a, b) => a.versionNumber - b.versionNumber);
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

// Export singleton instance using data from JSON database
export const legislativeData = new LegislativeDataService(data);

// Export for use in components
export default legislativeData;
