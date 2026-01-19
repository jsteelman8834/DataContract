'use client';

import { useState, useMemo } from 'react';
import legislativeData from '@/data/legislative-data';
import { CommitteeCard } from '@/components/committees/CommitteeCard';
import { cn } from '@/lib/utils';
import { Building2, Filter, Calendar } from 'lucide-react';

export default function CommitteesPage() {
  const [chamberFilter, setChamberFilter] = useState<'all' | 'house' | 'senate'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'standing' | 'special' | 'joint'>('all');
  const [showOnlyWithHearings, setShowOnlyWithHearings] = useState(false);

  const allCommittees = useMemo(() => {
    return legislativeData
      .getAllCommittees()
      .map((c) => legislativeData.getCommitteeWithBills(c));
  }, []);

  const filteredCommittees = useMemo(() => {
    let committees = [...allCommittees];

    if (chamberFilter !== 'all') {
      committees = committees.filter((c) => c.committee.chamber === chamberFilter);
    }

    if (typeFilter !== 'all') {
      committees = committees.filter((c) => c.committee.type === typeFilter);
    }

    if (showOnlyWithHearings) {
      committees = committees.filter((c) => c.upcomingHearings.length > 0);
    }

    // Sort: committees with upcoming hearings first, then by number of bills
    committees.sort((a, b) => {
      // First, prioritize committees with upcoming hearings
      if (a.upcomingHearings.length > 0 && b.upcomingHearings.length === 0) return -1;
      if (b.upcomingHearings.length > 0 && a.upcomingHearings.length === 0) return 1;
      // Then sort by number of hearings if both have hearings
      if (a.upcomingHearings.length !== b.upcomingHearings.length) {
        return b.upcomingHearings.length - a.upcomingHearings.length;
      }
      // Finally sort by number of bills
      return b.bills.length - a.bills.length;
    });

    return committees;
  }, [allCommittees, chamberFilter, typeFilter, showOnlyWithHearings]);

  const senateCount = allCommittees.filter((c) => c.committee.chamber === 'senate').length;
  const houseCount = allCommittees.filter((c) => c.committee.chamber === 'house').length;
  const withHearingsCount = allCommittees.filter((c) => c.upcomingHearings.length > 0).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Building2 className="w-8 h-8 mr-3" />
          Committees
        </h1>
        <p className="text-gray-600 mt-2">
          Explore Missouri legislative committees and their pending bills
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Filter className="w-5 h-5 text-gray-500" />

          {/* Chamber Filter */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setChamberFilter('all')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                chamberFilter === 'all'
                  ? 'bg-mo-navy text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              All ({allCommittees.length})
            </button>
            <button
              onClick={() => setChamberFilter('senate')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-l border-gray-200 transition-colors',
                chamberFilter === 'senate'
                  ? 'bg-mo-navy text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              Senate ({senateCount})
            </button>
            <button
              onClick={() => setChamberFilter('house')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-l border-gray-200 transition-colors',
                chamberFilter === 'house'
                  ? 'bg-mo-blue text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              House ({houseCount})
            </button>
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | 'standing' | 'special' | 'joint')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mo-blue focus:border-mo-blue"
          >
            <option value="all">All Types</option>
            <option value="standing">Standing</option>
            <option value="special">Special</option>
            <option value="joint">Joint</option>
          </select>

          {/* Upcoming Hearings Filter */}
          <button
            onClick={() => setShowOnlyWithHearings(!showOnlyWithHearings)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors',
              showOnlyWithHearings
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            )}
          >
            <Calendar className="w-4 h-4" />
            Upcoming Hearings ({withHearingsCount})
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-mo-navy text-white rounded-xl p-4">
          <p className="text-sm opacity-80">Total Committees</p>
          <p className="text-3xl font-bold">{filteredCommittees.length}</p>
        </div>
        <div className="bg-mo-gold text-mo-navy rounded-xl p-4">
          <p className="text-sm opacity-80">Total Bills in Committee</p>
          <p className="text-3xl font-bold">
            {filteredCommittees.reduce((sum, c) => sum + c.bills.length, 0)}
          </p>
        </div>
        <div className="bg-green-600 text-white rounded-xl p-4">
          <p className="text-sm opacity-80">Upcoming Hearings</p>
          <p className="text-3xl font-bold">
            {filteredCommittees.reduce((sum, c) => sum + c.upcomingHearings.length, 0)}
          </p>
        </div>
      </div>

      {/* Committees List */}
      {filteredCommittees.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No committees match your filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCommittees.map((committeeData) => (
            <CommitteeCard
              key={committeeData.committee.id}
              committeeData={committeeData}
            />
          ))}
        </div>
      )}
    </div>
  );
}
