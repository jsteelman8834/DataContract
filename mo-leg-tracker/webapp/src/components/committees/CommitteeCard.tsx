'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn, formatDate, formatTime, getPartyColor } from '@/lib/utils';
import type { CommitteeWithBills, BillCard as BillCardType } from '@/types';
import { STATUS_LABELS } from '@/types';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Users,
  Calendar,
  MapPin,
  FileText,
} from 'lucide-react';
import { BillCard } from '@/components/bills/BillCard';

interface CommitteeCardProps {
  committeeData: CommitteeWithBills;
  defaultExpanded?: boolean;
}

export function CommitteeCard({ committeeData, defaultExpanded = false }: CommitteeCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { committee, bills, members, upcomingHearings } = committeeData;

  const chamberColor = committee.chamber === 'senate' ? 'bg-mo-navy' : 'bg-mo-blue';
  const chamberBgLight = committee.chamber === 'senate' ? 'bg-mo-navy/5' : 'bg-mo-blue/5';

  // Group bills by status
  const billsByStatus = bills.reduce((acc, billCard) => {
    const status = billCard.bill.currentStatus;
    if (!acc[status]) acc[status] = [];
    acc[status].push(billCard);
    return acc;
  }, {} as Record<string, BillCardType[]>);

  const chair = members.find((m) => m.role === 'chair');
  const viceChair = members.find((m) => m.role === 'vice_chair');

  // Sort statuses in logical order for display
  const statusOrder = [
    'prefiled', 'introduced', 'first_read', 'referred', 'in_committee',
    'hearing_scheduled', 'reported_do_pass', 'perfected', 'third_read',
    'passed_origin', 'passed_other', 'truly_agreed', 'signed', 'enacted', 'vetoed', 'withdrawn'
  ];
  const sortedStatuses = Object.entries(billsByStatus).sort(([a], [b]) => {
    const aIndex = statusOrder.indexOf(a);
    const bIndex = statusOrder.indexOf(b);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  return (
    <div className={cn(
      'committee-card bg-white rounded-lg border border-gray-200 overflow-hidden',
      isExpanded && 'expanded'
    )}>
      {/* Header - Always visible */}
      <div
        className={cn('p-4 cursor-pointer', chamberBgLight)}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                'px-2 py-1 rounded text-xs font-bold text-white uppercase',
                chamberColor
              )}>
                {committee.chamber}
              </span>
              <span className="text-xs text-gray-500 capitalize">
                {committee.type} Committee
              </span>
            </div>
            <h3 className="font-semibold text-lg text-gray-900">
              {committee.name}
            </h3>

            {/* Leadership and Members info */}
            <div className="mt-2 space-y-1">
              {(chair || viceChair) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                  {chair && (
                    <span className="flex items-center">
                      <span className="font-medium mr-1">Chair:</span>
                      <span className={cn('px-1 rounded mr-1 text-xs', getPartyColor(chair.party))}>
                        {chair.party}
                      </span>
                      {chair.fullName}
                    </span>
                  )}
                  {viceChair && (
                    <span className="flex items-center">
                      <span className="font-medium mr-1">Vice Chair:</span>
                      <span className={cn('px-1 rounded mr-1 text-xs', getPartyColor(viceChair.party))}>
                        {viceChair.party}
                      </span>
                      {viceChair.fullName}
                    </span>
                  )}
                </div>
              )}
              <p className="text-sm text-gray-500 flex items-center">
                <Users className="w-4 h-4 mr-1" />
                {members.length} member{members.length !== 1 ? 's' : ''} assigned
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold text-mo-blue">{bills.length}</p>
              <p className="text-xs text-gray-500">Bills</p>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4 mt-3 text-sm">
          {upcomingHearings.length > 0 && (
            <span className="flex items-center text-mo-gold-dark">
              <Calendar className="w-4 h-4 mr-1" />
              {upcomingHearings.length} upcoming hearing{upcomingHearings.length !== 1 ? 's' : ''}
            </span>
          )}
          {committee.meetingRoom && (
            <span className="flex items-center text-gray-500">
              <MapPin className="w-4 h-4 mr-1" />
              {committee.meetingRoom}
            </span>
          )}
          {/* Show status breakdown */}
          {bills.length > 0 && (
            <span className="flex items-center gap-1 text-gray-500">
              <FileText className="w-4 h-4" />
              {Object.keys(billsByStatus).length} stage{Object.keys(billsByStatus).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 animate-expand">
          {/* Upcoming Hearings */}
          {upcomingHearings.length > 0 && (
            <div className="p-4 bg-mo-gold/10 border-b border-gray-200">
              <h4 className="font-semibold text-sm text-mo-navy mb-2 flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Upcoming Hearings
              </h4>
              <div className="space-y-2">
                {upcomingHearings.map((hearing) => (
                  <div
                    key={hearing.id}
                    className="bg-white rounded p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {formatDate(hearing.hearingDate)} at {formatTime(hearing.hearingTime)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {hearing.room} - {hearing.type.charAt(0).toUpperCase() + hearing.type.slice(1)} Hearing
                      </p>
                    </div>
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs',
                      hearing.status === 'scheduled' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    )}>
                      {hearing.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bills organized by status - Nested Kanban */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm text-gray-700 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Bills in Committee
              </h4>
              <Link
                href={`/committees/${committee.id.split(':').pop()}`}
                className="text-sm text-mo-blue hover:underline flex items-center"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {bills.length === 0 ? (
              <p className="text-center py-4 text-gray-500 text-sm">
                No bills currently assigned to this committee
              </p>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
                <div className="flex gap-4 pb-2 min-w-max">
                  {sortedStatuses.map(([status, statusBills]) => (
                    <div key={status} className="kanban-column flex-shrink-0 w-72">
                      <div className="kanban-column-header">
                        <h5 className="font-medium text-sm text-gray-700 flex items-center justify-between">
                          <span>{STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status.replace(/_/g, ' ')}</span>
                          <span className="bg-gray-200 px-2 py-0.5 rounded-full text-xs">
                            {statusBills.length}
                          </span>
                        </h5>
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {statusBills.map((billCard) => (
                          <BillCard
                            key={billCard.bill.id}
                            billCard={billCard}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Committee Members */}
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <h4 className="font-semibold text-sm text-gray-700 mb-3 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Committee Members ({members.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <Link
                  key={member.id}
                  href={`/members/${member.chamber}-${member.district}`}
                  className={cn(
                    'inline-flex items-center px-3 py-1.5 rounded-full text-sm border',
                    member.role === 'chair' && 'border-mo-gold bg-mo-gold/10',
                    member.role === 'vice_chair' && 'border-gray-300 bg-gray-100',
                    member.role === 'ranking_member' && 'border-gray-300 bg-gray-100',
                    member.role === 'member' && 'border-gray-200 bg-white'
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full mr-2', getPartyColor(member.party))} />
                  {member.lastName}
                  {member.role && member.role !== 'member' && (
                    <span className="ml-1 text-xs text-gray-500">
                      ({member.role.replace(/_/g, ' ')})
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
