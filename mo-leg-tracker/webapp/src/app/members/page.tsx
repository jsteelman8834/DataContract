'use client';

import { useState, useMemo } from 'react';
import legislativeData from '@/data/legislative-data';
import { MemberList } from '@/components/members/MemberCard';
import { cn } from '@/lib/utils';
import { Users, Search, Filter } from 'lucide-react';

export default function MembersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [chamberFilter, setChamberFilter] = useState<'all' | 'house' | 'senate'>('all');
  const [partyFilter, setPartyFilter] = useState<'all' | 'R' | 'D' | 'I'>('all');

  const allMembers = useMemo(() => {
    return legislativeData.getAllMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    let members = [...allMembers];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      members = members.filter(
        (m) =>
          m.fullName.toLowerCase().includes(query) ||
          m.district.includes(query) ||
          m.email.toLowerCase().includes(query)
      );
    }

    // Chamber filter
    if (chamberFilter !== 'all') {
      members = members.filter((m) => m.chamber === chamberFilter);
    }

    // Party filter
    if (partyFilter !== 'all') {
      members = members.filter((m) => m.party === partyFilter);
    }

    // Sort by chamber, then district
    members.sort((a, b) => {
      if (a.chamber !== b.chamber) {
        return a.chamber === 'senate' ? -1 : 1;
      }
      return parseInt(a.district) - parseInt(b.district);
    });

    return members;
  }, [allMembers, searchQuery, chamberFilter, partyFilter]);

  const senateMembers = allMembers.filter((m) => m.chamber === 'senate');
  const houseMembers = allMembers.filter((m) => m.chamber === 'house');
  const republicans = allMembers.filter((m) => m.party === 'R');
  const democrats = allMembers.filter((m) => m.party === 'D');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Users className="w-8 h-8 mr-3" />
          Legislators
        </h1>
        <p className="text-gray-600 mt-2">
          Find your representative in the Missouri General Assembly
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-mo-navy text-white rounded-xl p-4">
          <p className="text-sm opacity-80">Senators</p>
          <p className="text-3xl font-bold">{senateMembers.length}</p>
        </div>
        <div className="bg-mo-blue text-white rounded-xl p-4">
          <p className="text-sm opacity-80">Representatives</p>
          <p className="text-3xl font-bold">{houseMembers.length}</p>
        </div>
        <div className="bg-mo-red text-white rounded-xl p-4">
          <p className="text-sm opacity-80">Republicans</p>
          <p className="text-3xl font-bold">{republicans.length}</p>
        </div>
        <div className="bg-mo-blue-light text-white rounded-xl p-4">
          <p className="text-sm opacity-80">Democrats</p>
          <p className="text-3xl font-bold">{democrats.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, district, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mo-blue focus:border-mo-blue"
            />
          </div>

          {/* Chamber Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
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
                All
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
                Senate
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
                House
              </button>
            </div>
          </div>

          {/* Party Filter */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setPartyFilter('all')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                partyFilter === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              All Parties
            </button>
            <button
              onClick={() => setPartyFilter('R')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-l border-gray-200 transition-colors',
                partyFilter === 'R'
                  ? 'bg-mo-red text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              R
            </button>
            <button
              onClick={() => setPartyFilter('D')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-l border-gray-200 transition-colors',
                partyFilter === 'D'
                  ? 'bg-mo-blue text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              D
            </button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-gray-600">
          Showing <span className="font-semibold">{filteredMembers.length}</span> of{' '}
          <span className="font-semibold">{allMembers.length}</span> legislators
        </p>
      </div>

      {/* Members Grid */}
      {filteredMembers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No legislators match your search criteria</p>
        </div>
      ) : (
        <MemberList members={filteredMembers} />
      )}
    </div>
  );
}
