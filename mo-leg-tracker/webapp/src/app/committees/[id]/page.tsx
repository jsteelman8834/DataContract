'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import legislativeData from '@/data/legislative-data';
import { cn, formatDate, formatTime, getPartyColor } from '@/lib/utils';
import { STATUS_LABELS } from '@/types';
import { BillCard } from '@/components/bills/BillCard';
import { MemberCard } from '@/components/members/MemberCard';
import {
  Building2,
  Users,
  Calendar,
  MapPin,
  Clock,
  FileText,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';

interface CommitteePageProps {
  params: Promise<{ id: string }>;
}

export default function CommitteePage({ params }: CommitteePageProps) {
  const { id } = use(params);

  // Try to find the committee by looking for the ID that ends with the slug
  const committee = useMemo(() => {
    const committees = legislativeData.getAllCommittees();
    return committees.find((c) => c.id.endsWith(`:${id}`) || c.id === id);
  }, [id]);

  if (!committee) {
    notFound();
  }

  const committeeData = legislativeData.getCommitteeWithBills(committee);
  const { bills, members, upcomingHearings } = committeeData;

  // Group bills by status
  const billsByStatus = bills.reduce((acc, billCard) => {
    const status = billCard.bill.currentStatus;
    if (!acc[status]) acc[status] = [];
    acc[status].push(billCard);
    return acc;
  }, {} as Record<string, typeof bills>);

  const chamberColor = committee.chamber === 'senate' ? 'bg-mo-navy' : 'bg-mo-blue';
  const chair = members.find((m) => m.role === 'chair');
  const viceChair = members.find((m) => m.role === 'vice_chair');
  const rankingMember = members.find((m) => m.role === 'ranking_member');
  const regularMembers = members.filter((m) => m.role === 'member');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <Link
          href="/committees"
          className="inline-flex items-center text-mo-blue hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Committees
        </Link>
      </nav>

      {/* Committee Header */}
      <div className={cn('rounded-xl p-6 text-white mb-6', chamberColor)}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Building2 className="w-6 h-6" />
              <span className="text-sm opacity-80 uppercase">
                {committee.chamber} {committee.type} Committee
              </span>
            </div>
            <h1 className="text-3xl font-bold mb-2">{committee.name}</h1>
            <p className="text-white/80 max-w-2xl">{committee.jurisdiction}</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">{bills.length}</p>
            <p className="text-sm opacity-80">Bills</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-white/20 text-sm">
          <div className="flex items-center">
            <MapPin className="w-4 h-4 mr-2 opacity-80" />
            {committee.meetingRoom}
          </div>
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-2 opacity-80" />
            {committee.meetingSchedule}
          </div>
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-2 opacity-80" />
            {members.length} Members
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Hearings */}
          {upcomingHearings.length > 0 && (
            <section className="bg-mo-gold/10 rounded-xl border border-mo-gold/30 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-mo-gold-dark" />
                Upcoming Hearings
              </h2>
              <div className="space-y-3">
                {upcomingHearings.map((hearing) => {
                  const hearingBills = legislativeData.getBillsForHearing(hearing.id);
                  return (
                    <div
                      key={hearing.id}
                      className="bg-white rounded-lg p-4 border border-mo-gold/30"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-gray-900">
                            {formatDate(hearing.hearingDate)} at {formatTime(hearing.hearingTime)}
                          </p>
                          <p className="text-sm text-gray-600">
                            {hearing.room} - {hearing.type.charAt(0).toUpperCase() + hearing.type.slice(1)} Hearing
                          </p>
                        </div>
                        <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 capitalize">
                          {hearing.status}
                        </span>
                      </div>
                      {hearingBills.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-500 mb-2">Bills on Agenda:</p>
                          <div className="flex flex-wrap gap-2">
                            {hearingBills.map((bill) => (
                              <Link
                                key={bill.id}
                                href={`/bills/${bill.billNumber.replace(' ', '-').toLowerCase()}`}
                                className={cn(
                                  'px-2 py-1 rounded text-xs font-medium text-white hover:opacity-80',
                                  bill.chamber === 'senate' ? 'bg-mo-navy' : 'bg-mo-blue'
                                )}
                              >
                                {bill.billNumber}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Bills in Committee - Kanban Style */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Bills in Committee ({bills.length})
            </h2>

            {bills.length === 0 ? (
              <p className="text-center py-8 text-gray-500">
                No bills currently assigned to this committee
              </p>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <div className="flex gap-4 pb-4 min-w-max">
                  {Object.entries(billsByStatus).map(([status, statusBills]) => (
                    <div key={status} className="kanban-column flex-shrink-0 w-80">
                      <div className="kanban-column-header">
                        <h3 className="font-medium text-gray-700 flex items-center justify-between">
                          <span>{STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}</span>
                          <span className="bg-gray-200 px-2 py-0.5 rounded-full text-xs">
                            {statusBills.length}
                          </span>
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {statusBills.map((billCard) => (
                          <BillCard key={billCard.bill.id} billCard={billCard} compact />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Bills List */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-700 mb-4">All Bills</h3>
              <div className="space-y-3">
                {bills.map((billCard) => (
                  <BillCard key={billCard.bill.id} billCard={billCard} />
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar - Members */}
        <div className="space-y-6">
          {/* Leadership */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Committee Leadership
            </h3>

            <div className="space-y-3">
              {chair && (
                <div>
                  <p className="text-xs text-mo-gold-dark font-semibold mb-1">Chair</p>
                  <MemberCard member={chair} compact />
                </div>
              )}

              {viceChair && (
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Vice Chair</p>
                  <MemberCard member={viceChair} compact />
                </div>
              )}

              {rankingMember && (
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Ranking Member</p>
                  <MemberCard member={rankingMember} compact />
                </div>
              )}
            </div>
          </section>

          {/* All Members */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">
              Members ({members.length})
            </h3>

            <div className="space-y-2">
              {regularMembers.map((member) => (
                <MemberCard key={member.id} member={member} compact />
              ))}
            </div>
          </section>

          {/* Party Breakdown */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Party Breakdown</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-mo-red mr-2" />
                  <span>Republican</span>
                </div>
                <span className="font-bold">
                  {members.filter((m) => m.party === 'R').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-mo-blue mr-2" />
                  <span>Democrat</span>
                </div>
                <span className="font-bold">
                  {members.filter((m) => m.party === 'D').length}
                </span>
              </div>
              {members.some((m) => m.party === 'I') && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full bg-mo-gold mr-2" />
                    <span>Independent</span>
                  </div>
                  <span className="font-bold">
                    {members.filter((m) => m.party === 'I').length}
                  </span>
                </div>
              )}
            </div>

            {/* Visual breakdown bar */}
            <div className="mt-4 h-3 rounded-full overflow-hidden flex">
              <div
                className="bg-mo-red"
                style={{
                  width: `${(members.filter((m) => m.party === 'R').length / members.length) * 100}%`,
                }}
              />
              <div
                className="bg-mo-blue"
                style={{
                  width: `${(members.filter((m) => m.party === 'D').length / members.length) * 100}%`,
                }}
              />
              <div
                className="bg-mo-gold"
                style={{
                  width: `${(members.filter((m) => m.party === 'I').length / members.length) * 100}%`,
                }}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
