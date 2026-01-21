'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { CommitteeWithBills } from '@/types';
import { CommitteeCard } from '@/components/committees/CommitteeCard';
import { ExpandablePanel } from '@/components/dashboard/ExpandablePanel';
import { Building2, Filter } from 'lucide-react';

interface ChamberViewProps {
  chamber: 'house' | 'senate';
  committees: CommitteeWithBills[];
}

export function ChamberView({ chamber, committees }: ChamberViewProps) {
  const [filter, setFilter] = useState<'all' | 'with-bills' | 'with-hearings'>('all');
  const [expandAll, setExpandAll] = useState(false);

  const chamberName = chamber === 'senate' ? 'Senate' : 'House';
  const chamberColor = chamber === 'senate' ? 'bg-mo-navy' : 'bg-mo-blue';
  const chamberBorder = chamber === 'senate' ? 'border-mo-navy' : 'border-mo-blue';

  // Filter and sort committees by bill count (descending)
  const filteredCommittees = committees
    .filter((c) => {
      if (filter === 'with-bills') return c.bills.length > 0;
      if (filter === 'with-hearings') return c.upcomingHearings.length > 0;
      return true;
    })
    .sort((a, b) => b.bills.length - a.bills.length);

  const totalBills = committees.reduce((sum, c) => sum + c.bills.length, 0);
  const totalHearings = committees.reduce((sum, c) => sum + c.upcomingHearings.length, 0);

  const renderHeader = (controls: React.ReactNode) => (
    <div className={cn('p-4 text-white', chamberColor)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Building2 className="w-6 h-6 mr-3" />
          <div>
            <h2 className="text-xl font-bold">{chamberName}</h2>
            <p className="text-sm opacity-80">
              {committees.length} Committees
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold">{totalBills}</p>
            <p className="text-xs opacity-80">Bills</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{totalHearings}</p>
            <p className="text-xs opacity-80">Hearings</p>
          </div>
          {/* Panel expand/fullscreen controls */}
          {controls}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mt-4">
        <Filter className="w-4 h-4" />
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-1 rounded-full text-xs transition-colors',
            filter === 'all'
              ? 'bg-white text-mo-navy'
              : 'bg-white/20 hover:bg-white/30'
          )}
        >
          All ({committees.length})
        </button>
        <button
          onClick={() => setFilter('with-bills')}
          className={cn(
            'px-3 py-1 rounded-full text-xs transition-colors',
            filter === 'with-bills'
              ? 'bg-white text-mo-navy'
              : 'bg-white/20 hover:bg-white/30'
          )}
        >
          With Bills ({committees.filter((c) => c.bills.length > 0).length})
        </button>
        <button
          onClick={() => setFilter('with-hearings')}
          className={cn(
            'px-3 py-1 rounded-full text-xs transition-colors',
            filter === 'with-hearings'
              ? 'bg-white text-mo-navy'
              : 'bg-white/20 hover:bg-white/30'
          )}
        >
          With Hearings ({committees.filter((c) => c.upcomingHearings.length > 0).length})
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setExpandAll(!expandAll)}
          className="px-3 py-1 rounded-full text-xs bg-white/20 hover:bg-white/30 transition-colors"
        >
          {expandAll ? 'Collapse' : 'Expand'}
        </button>
      </div>
    </div>
  );

  return (
    <ExpandablePanel
      renderHeader={renderHeader}
      collapsedHeight="200px"
      expandedHeight="500px"
      expanded={expandAll}
      onExpandedChange={setExpandAll}
      showFade={true}
      className={cn('border-2', chamberBorder)}
    >
      {/* Committee List */}
      <div className="p-4 bg-gray-50 space-y-4">
        {filteredCommittees.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No committees match the current filter</p>
          </div>
        ) : (
          filteredCommittees.map((committeeData) => (
            <CommitteeCard
              key={committeeData.committee.id}
              committeeData={committeeData}
              defaultExpanded={expandAll}
            />
          ))
        )}
      </div>
    </ExpandablePanel>
  );
}
