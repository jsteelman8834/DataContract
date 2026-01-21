'use client';

import Link from 'next/link';
import { cn, formatDate, getPartyColor, truncate } from '@/lib/utils';
import { formatCurrency, formatPercentage, getFiscalImpactColor } from '@/lib/fiscal-utils';
import legislativeData from '@/data/legislative-data';
import type { BillCard as BillCardType, Topic } from '@/types';
import { STATUS_LABELS } from '@/types';
import { Calendar, User, Clock, ChevronRight, FileText, DollarSign, Building2, MapPin, MessageSquare, Brain } from 'lucide-react';

// Helper to get topic info for badges
function getTopicBadges(topicIds: string[] | undefined, maxBadges: number = 2): Topic[] {
  if (!topicIds || topicIds.length === 0) return [];
  return topicIds
    .slice(0, maxBadges)
    .map((id) => legislativeData.getTopicById(id))
    .filter((t): t is Topic => t !== null);
}

interface BillCardProps {
  billCard: BillCardType;
  compact?: boolean;
  showAskAI?: boolean;
  onAskAI?: (billId: string, billNumber: string) => void;
}

export function BillCard({ billCard, compact = false, showAskAI = false, onAskAI }: BillCardProps) {
  const { bill, sponsor, daysInCommittee, hasUpcomingHearing, upcomingHearing, summary, fiscalNote, passageProbability, weightedFiscalImpact, isBipartisan, committeeName } = billCard;

  const billUrl = `/bills/${bill.billNumber.replace(' ', '-').toLowerCase()}`;

  // Format hearing date/time for tooltip
  const formatHearingDateTime = () => {
    if (!upcomingHearing) return '';
    const date = new Date(upcomingHearing.date + 'T' + upcomingHearing.time);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
      ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const chamberColor = bill.chamber === 'senate' ? 'bg-mo-navy' : 'bg-mo-blue';
  const chamberBorder = bill.chamber === 'senate' ? 'border-l-mo-navy' : 'border-l-mo-blue';

  if (compact) {
    return (
      <div className={cn(
        'bill-card bg-white rounded-lg p-3 border border-gray-200 border-l-4',
        chamberBorder
      )}>
        <div className="flex items-start justify-between">
          <Link href={billUrl} className="flex-1 min-w-0 cursor-pointer">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                'px-2 py-0.5 rounded text-xs font-bold text-white',
                chamberColor
              )}>
                {bill.billNumber}
              </span>
              {committeeName && (
                <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {committeeName}
                </span>
              )}
              {hasUpcomingHearing && upcomingHearing && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs bg-mo-gold text-mo-navy font-medium cursor-help"
                  title={`${formatHearingDateTime()} • ${upcomingHearing.room}`}
                >
                  Hearing Soon
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 mt-1 line-clamp-2">
              {bill.title}
            </p>
            {/* Compact Topic Badges */}
            {bill.topics && bill.topics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {getTopicBadges(bill.topics, 1).map((topic) => (
                  <span
                    key={topic.id}
                    className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', topic.color)}
                    title={topic.description}
                  >
                    {topic.icon} {topic.name}
                  </span>
                ))}
              </div>
            )}
          </Link>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {showAskAI && (
              onAskAI ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAskAI(bill.id, bill.billNumber);
                  }}
                  className="p-1.5 rounded-md hover:bg-mo-blue/10 text-mo-blue transition-colors relative"
                  title="Ask AI about this bill"
                >
                  <MessageSquare className="w-4 h-4" />
                  <Brain className="w-2.5 h-2.5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-mo-blue" />
                </button>
              ) : (
                <Link
                  href={`${billUrl}?chat=true`}
                  className="p-1.5 rounded-md hover:bg-mo-blue/10 text-mo-blue transition-colors relative"
                  title="Ask AI about this bill"
                >
                  <MessageSquare className="w-4 h-4" />
                  <Brain className="w-2.5 h-2.5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-mo-blue" />
                </Link>
              )
            )}
            <Link href={billUrl}>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
          </div>
        </div>
        {sponsor && (
          <div className="flex items-center mt-2 text-xs text-gray-500">
            <User className="w-3 h-3 mr-1" />
            <span className={cn('px-1 rounded mr-1', getPartyColor(sponsor.party))}>
              {sponsor.party}
            </span>
            {sponsor.lastName}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      'bill-card bg-white rounded-lg p-4 border border-gray-200 border-l-4',
      chamberBorder
    )}>
      <div className="flex items-start justify-between mb-3">
        <Link href={billUrl} className="flex items-center gap-2 flex-wrap cursor-pointer">
          <span className={cn(
            'px-2 py-1 rounded text-sm font-bold text-white',
            chamberColor
          )}>
            {bill.billNumber}
          </span>
          <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
            {STATUS_LABELS[bill.currentStatus] || bill.currentStatus}
          </span>
          {committeeName && (
            <span className="px-2 py-1 rounded text-xs bg-indigo-50 text-indigo-700 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {committeeName}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showAskAI && (
            onAskAI ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAskAI(bill.id, bill.billNumber);
                }}
                className="px-2 py-1 rounded-md bg-mo-blue/10 hover:bg-mo-blue/20 text-mo-blue text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Ask AI about this bill"
              >
                <span className="relative">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <Brain className="w-2 h-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </span>
                Ask AI
              </button>
            ) : (
              <Link
                href={`${billUrl}?chat=true`}
                className="px-2 py-1 rounded-md bg-mo-blue/10 hover:bg-mo-blue/20 text-mo-blue text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Ask AI about this bill"
              >
                <span className="relative">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <Brain className="w-2 h-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </span>
                Ask AI
              </Link>
            )
          )}
          {hasUpcomingHearing && upcomingHearing && (
            <div className="relative group">
              <span className="px-2 py-1 rounded-full text-xs bg-mo-gold text-mo-navy font-medium flex items-center cursor-help">
                <Calendar className="w-3 h-3 mr-1" />
                Hearing Scheduled
              </span>
              {/* Tooltip */}
              <div className="absolute right-0 top-full mt-1 z-10 hidden group-hover:block">
                <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg whitespace-nowrap">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3 h-3" />
                    <span className="font-medium">{formatHearingDateTime()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <MapPin className="w-3 h-3" />
                    <span>{upcomingHearing.room}</span>
                  </div>
                  <div className="text-gray-400 mt-1 text-[10px]">
                    {upcomingHearing.committeeName}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Link href={billUrl} className="block cursor-pointer">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 hover:text-mo-blue transition-colors">
          {bill.title}
        </h3>

        {bill.briefDescription && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {bill.briefDescription}
          </p>
        )}

        {/* Topic Badges */}
        {bill.topics && bill.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {getTopicBadges(bill.topics).map((topic) => (
              <span
                key={topic.id}
                className={cn('px-2 py-0.5 rounded-full text-xs font-medium', topic.color)}
                title={topic.description}
              >
                {topic.icon} {topic.name}
              </span>
            ))}
            {bill.topics.length > 2 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                +{bill.topics.length - 2} more
              </span>
            )}
          </div>
        )}

        {summary?.plainLanguage && (
          <div className="bg-gray-50 rounded p-2 mb-3">
            <p className="text-xs text-gray-500 mb-1 flex items-center">
              <FileText className="w-3 h-3 mr-1" />
              Plain Language Summary
            </p>
            <p className="text-sm text-gray-700 line-clamp-2">
              {truncate(summary.plainLanguage, 150)}
            </p>
          </div>
        )}

        {/* Fiscal Impact Badge */}
        {fiscalNote && (
          <div className="flex items-center gap-3 mb-3 p-2 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-500">Fiscal Impact:</span>
            </div>
            <span className={cn('text-sm font-semibold', getFiscalImpactColor(fiscalNote.netImpact))}>
              {formatCurrency(fiscalNote.netImpact, { compact: true, showSign: true })}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-500">
              Weighted:
              <span className={cn('font-medium ml-1', getFiscalImpactColor(weightedFiscalImpact))}>
                {formatCurrency(weightedFiscalImpact, { compact: true, showSign: true })}
              </span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-500">
              {formatPercentage(passageProbability)} likely
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            {sponsor && (
              <div className="flex items-center text-gray-600">
                <User className="w-4 h-4 mr-1" />
                <span className={cn('px-1 rounded mr-1 text-xs', getPartyColor(sponsor.party))}>
                  {sponsor.party}
                </span>
                {sponsor.fullName}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-gray-500">
            {daysInCommittee > 0 && (
              <span className="flex items-center text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {daysInCommittee}d in committee
              </span>
            )}
            <span className="text-xs">
              {formatDate(bill.lastActionDate)}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

interface BillListProps {
  bills: BillCardType[];
  compact?: boolean;
  emptyMessage?: string;
}

export function BillList({ bills, compact = false, emptyMessage = 'No bills found' }: BillListProps) {
  if (bills.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', compact ? 'space-y-2' : '')}>
      {bills.map((billCard) => (
        <BillCard key={billCard.bill.id} billCard={billCard} compact={compact} />
      ))}
    </div>
  );
}
