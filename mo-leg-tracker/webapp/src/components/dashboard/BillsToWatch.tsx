'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn, formatDate, getPartyColor } from '@/lib/utils';
import { BillCard as BillCardComponent } from '@/components/bills/BillCard';
import { ExpandablePanel } from '@/components/dashboard/ExpandablePanel';
import { STATUS_LABELS } from '@/types';
import type { BillCard } from '@/types';
import {
  Eye,
  TrendingUp,
  Clock,
  ChevronRight,
  Activity,
  Calendar,
  DollarSign,
} from 'lucide-react';

interface BillsToWatchProps {
  watchBills: BillCard[];
  recentlyActiveBills: BillCard[];
  onAskAI?: (billId: string, billNumber: string) => void;
}

type ViewMode = 'watch' | 'recent';

export function BillsToWatch({ watchBills, recentlyActiveBills, onAskAI }: BillsToWatchProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('recent');
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const bills = viewMode === 'watch' ? watchBills : recentlyActiveBills;

  // Group watch bills by status for better analysis
  const billsByStatus: Record<string, BillCard[]> = {};
  watchBills.forEach((billCard) => {
    const status = billCard.bill.currentStatus;
    if (!billsByStatus[status]) billsByStatus[status] = [];
    billsByStatus[status].push(billCard);
  });

  // Status order for progression (most advanced first)
  const statusOrder = [
    'signed', 'enacted', 'truly_agreed', 'conference',
    'passed_other', 'passed_second_chamber', 'received_other', 'referred_other',
    'passed_origin', 'passed_chamber', 'third_read', 'perfected',
    'placed_on_calendar', 'reported_do_pass', 'committee_substitute',
    'hearing_held', 'hearing_scheduled',
  ];

  const sortedStatuses = Object.keys(billsByStatus).sort((a, b) => {
    const aIdx = statusOrder.indexOf(a);
    const bIdx = statusOrder.indexOf(b);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  // Count bills in advanced stages (past committee)
  const advancedStatuses = ['reported_do_pass', 'placed_on_calendar', 'perfected', 'third_read',
    'passed_origin', 'passed_chamber', 'passed_other', 'truly_agreed', 'conference',
    'signed', 'enacted'];
  const advancedBillsCount = watchBills.filter(b => advancedStatuses.includes(b.bill.currentStatus)).length;

  const renderHeader = (controls: React.ReactNode) => (
    <div className="p-4 bg-gradient-to-r from-mo-navy to-mo-blue">
      <div className="flex items-center justify-between">
        <div className="flex items-center text-white">
          <Eye className="w-5 h-5 mr-2" />
          <h2 className="text-lg font-bold">Bills to Watch</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg overflow-hidden bg-white/20">
            <button
              onClick={() => setViewMode('recent')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1',
                viewMode === 'recent'
                  ? 'bg-white text-mo-navy'
                  : 'text-white hover:bg-white/10'
              )}
            >
              <Clock className="w-3 h-3" />
              Recent Activity ({recentlyActiveBills.length})
            </button>
            <button
              onClick={() => setViewMode('watch')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1',
                viewMode === 'watch'
                  ? 'bg-white text-mo-navy'
                  : 'text-white hover:bg-white/10'
              )}
            >
              <TrendingUp className="w-3 h-3" />
              Progressing ({watchBills.length})
            </button>
          </div>
          {/* Panel expand/fullscreen controls */}
          {controls}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="flex items-center gap-4 mt-3 text-white/90 text-sm">
        <span className="flex items-center gap-1">
          <Activity className="w-4 h-4" />
          {advancedBillsCount} past committee
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {watchBills.filter(b => b.hasUpcomingHearing).length} with hearings
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="w-4 h-4" />
          {watchBills.filter(b => b.fiscalNote).length} with fiscal notes
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-3 py-1 rounded-full text-xs bg-white/20 hover:bg-white/30 transition-colors"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
    </div>
  );

  return (
    <ExpandablePanel
      renderHeader={renderHeader}
      collapsedHeight="150px"
      expandedHeight="400px"
      expanded={isExpanded}
      onExpandedChange={setIsExpanded}
      showFade={true}
    >

      {/* Content */}
      {viewMode === 'watch' ? (
        // Grouped view by status for analysis
        <div className="divide-y divide-gray-100">
          {sortedStatuses.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No bills showing significant movement yet</p>
              <p className="text-sm mt-1">Bills will appear here as they progress through committee</p>
            </div>
          ) : (
            sortedStatuses.map((status) => {
              const statusBills = billsByStatus[status];
              const isExpanded = expandedStatus === status;

              return (
                <div key={status} className="group">
                  <button
                    onClick={() => setExpandedStatus(isExpanded ? null : status)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'w-3 h-3 rounded-full',
                        advancedStatuses.includes(status) ? 'bg-green-500' : 'bg-yellow-500'
                      )} />
                      <span className="font-medium text-gray-900">
                        {STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-sm">
                        {statusBills.length} bill{statusBills.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <ChevronRight className={cn(
                      'w-5 h-5 text-gray-400 transition-transform',
                      isExpanded && 'rotate-90'
                    )} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-2 bg-gray-50/50">
                      {statusBills
                        .sort((a, b) => (b.bill.lastActionDate || '').localeCompare(a.bill.lastActionDate || ''))
                        .map((billCard) => (
                          <BillCardComponent
                            key={billCard.bill.id}
                            billCard={billCard}
                            compact
                            showAskAI
                            onAskAI={onAskAI}
                          />
                        ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        // Recent activity - flat list
        <div className="p-4">
          {recentlyActiveBills.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No recent activity</p>
              <p className="text-sm mt-1">Bills with activity in the last 7 days will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentlyActiveBills.map((billCard) => (
                <div key={billCard.bill.id} className="flex items-center gap-3">
                  <div className="flex-shrink-0 text-xs text-gray-500 w-20">
                    {billCard.bill.lastActionDate && formatDate(billCard.bill.lastActionDate)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <BillCardComponent billCard={billCard} compact showAskAI onAskAI={onAskAI} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {viewMode === 'watch'
            ? 'Bills with hearing scheduled, held, or past committee'
            : 'Bills with action in the last 7 days'}
        </p>
        <Link
          href="/bills?sort=lastAction"
          className="text-sm text-mo-blue hover:underline flex items-center"
        >
          View All Bills <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </ExpandablePanel>
  );
}
