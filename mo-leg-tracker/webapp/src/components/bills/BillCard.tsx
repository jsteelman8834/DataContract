'use client';

import Link from 'next/link';
import { cn, formatDate, getPartyColor, truncate } from '@/lib/utils';
import { formatCurrency, formatPercentage, getFiscalImpactColor } from '@/lib/fiscal-utils';
import type { BillCard as BillCardType } from '@/types';
import { STATUS_LABELS } from '@/types';
import { Calendar, User, Clock, ChevronRight, FileText, DollarSign } from 'lucide-react';

interface BillCardProps {
  billCard: BillCardType;
  compact?: boolean;
}

export function BillCard({ billCard, compact = false }: BillCardProps) {
  const { bill, sponsor, daysInCommittee, hasUpcomingHearing, summary, fiscalNote, passageProbability, weightedFiscalImpact } = billCard;

  const chamberColor = bill.chamber === 'senate' ? 'bg-mo-navy' : 'bg-mo-blue';
  const chamberBorder = bill.chamber === 'senate' ? 'border-l-mo-navy' : 'border-l-mo-blue';

  if (compact) {
    return (
      <Link href={`/bills/${bill.billNumber.replace(' ', '-').toLowerCase()}`}>
        <div className={cn(
          'bill-card bg-white rounded-lg p-3 border border-gray-200 border-l-4 cursor-pointer',
          chamberBorder
        )}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'px-2 py-0.5 rounded text-xs font-bold text-white',
                  chamberColor
                )}>
                  {bill.billNumber}
                </span>
                {hasUpcomingHearing && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-mo-gold text-mo-navy font-medium">
                    Hearing Soon
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                {bill.title}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
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
      </Link>
    );
  }

  return (
    <Link href={`/bills/${bill.billNumber.replace(' ', '-').toLowerCase()}`}>
      <div className={cn(
        'bill-card bg-white rounded-lg p-4 border border-gray-200 border-l-4 cursor-pointer',
        chamberBorder
      )}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={cn(
              'px-2 py-1 rounded text-sm font-bold text-white',
              chamberColor
            )}>
              {bill.billNumber}
            </span>
            <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
              {STATUS_LABELS[bill.currentStatus] || bill.currentStatus}
            </span>
          </div>
          {hasUpcomingHearing && (
            <span className="px-2 py-1 rounded-full text-xs bg-mo-gold text-mo-navy font-medium flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              Hearing Scheduled
            </span>
          )}
        </div>

        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
          {bill.title}
        </h3>

        {bill.briefDescription && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {bill.briefDescription}
          </p>
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
      </div>
    </Link>
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
