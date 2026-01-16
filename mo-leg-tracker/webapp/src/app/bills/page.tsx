'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import legislativeData from '@/data/legislative-data';
import { BillCard } from '@/components/bills/BillCard';
import { cn } from '@/lib/utils';
import { STATUS_LABELS } from '@/types';
import type { BillStatus } from '@/types';
import { FileText, Filter, Search, X, Loader2 } from 'lucide-react';

const ALL_STATUSES = Object.keys(STATUS_LABELS) as BillStatus[];

function BillsContent() {
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [chamberFilter, setChamberFilter] = useState<'all' | 'house' | 'senate'>(
    (searchParams.get('chamber') as 'house' | 'senate') || 'all'
  );
  const [statusFilter, setStatusFilter] = useState<BillStatus | 'all'>(
    (searchParams.get('status') as BillStatus) || 'all'
  );
  const [sortBy, setSortBy] = useState<'recent' | 'number' | 'days'>('recent');

  const allBills = useMemo(() => {
    return legislativeData.getAllBills().map((bill) => legislativeData.getBillCard(bill));
  }, []);

  const filteredBills = useMemo(() => {
    let bills = [...allBills];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      bills = bills.filter(
        (b) =>
          b.bill.billNumber.toLowerCase().includes(query) ||
          b.bill.title.toLowerCase().includes(query) ||
          b.bill.briefDescription.toLowerCase().includes(query) ||
          b.sponsor?.fullName.toLowerCase().includes(query)
      );
    }

    // Chamber filter
    if (chamberFilter !== 'all') {
      bills = bills.filter((b) => b.bill.chamber === chamberFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      bills = bills.filter((b) => b.bill.currentStatus === statusFilter);
    }

    // Sort
    switch (sortBy) {
      case 'recent':
        bills.sort(
          (a, b) =>
            new Date(b.bill.lastActionDate).getTime() - new Date(a.bill.lastActionDate).getTime()
        );
        break;
      case 'number':
        bills.sort((a, b) => a.bill.billSuffix - b.bill.billSuffix);
        break;
      case 'days':
        bills.sort((a, b) => b.daysInCommittee - a.daysInCommittee);
        break;
    }

    return bills;
  }, [allBills, searchQuery, chamberFilter, statusFilter, sortBy]);

  const clearFilters = () => {
    setSearchQuery('');
    setChamberFilter('all');
    setStatusFilter('all');
    setSortBy('recent');
  };

  const hasActiveFilters =
    searchQuery || chamberFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <FileText className="w-8 h-8 mr-3" />
          Bills
        </h1>
        <p className="text-gray-600 mt-2">
          Browse and search all bills in the 103rd General Assembly
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search bills by number, title, or sponsor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mo-blue focus:border-mo-blue"
            />
          </div>

          {/* Chamber Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={chamberFilter}
              onChange={(e) => setChamberFilter(e.target.value as 'all' | 'house' | 'senate')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mo-blue focus:border-mo-blue"
            >
              <option value="all">All Chambers</option>
              <option value="senate">Senate</option>
              <option value="house">House</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as BillStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mo-blue focus:border-mo-blue"
          >
            <option value="all">All Statuses</option>
            {ALL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'number' | 'days')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mo-blue focus:border-mo-blue"
          >
            <option value="recent">Most Recent</option>
            <option value="number">Bill Number</option>
            <option value="days">Days in Committee</option>
          </select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center px-3 py-2 text-sm text-mo-red hover:bg-mo-red/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-gray-600">
          Showing <span className="font-semibold">{filteredBills.length}</span> of{' '}
          <span className="font-semibold">{allBills.length}</span> bills
        </p>

        {/* Chamber summary pills */}
        <div className="flex gap-2">
          <span className="px-2 py-1 bg-mo-navy text-white text-xs rounded-full">
            {filteredBills.filter((b) => b.bill.chamber === 'senate').length} Senate
          </span>
          <span className="px-2 py-1 bg-mo-blue text-white text-xs rounded-full">
            {filteredBills.filter((b) => b.bill.chamber === 'house').length} House
          </span>
        </div>
      </div>

      {/* Bills List */}
      {filteredBills.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No bills match your search criteria</p>
          <button
            onClick={clearFilters}
            className="mt-4 text-mo-blue hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBills.map((billCard) => (
            <BillCard key={billCard.bill.id} billCard={billCard} />
          ))}
        </div>
      )}
    </div>
  );
}

function BillsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-mo-blue" />
        <span className="ml-2 text-gray-600">Loading bills...</span>
      </div>
    </div>
  );
}

export default function BillsPage() {
  return (
    <Suspense fallback={<BillsLoading />}>
      <BillsContent />
    </Suspense>
  );
}
