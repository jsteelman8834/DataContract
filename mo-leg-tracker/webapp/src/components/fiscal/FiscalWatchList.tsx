'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  formatCurrency,
  formatPercentage,
  getPassageProbability,
  getFiscalImpactColor,
  getProbabilityLabel,
} from '@/lib/fiscal-utils';
import type { Bill, FiscalNote } from '@/types';
import { STATUS_LABELS } from '@/types';
import {
  Eye,
  EyeOff,
  Bell,
  BellOff,
  Trash2,
  Plus,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';

interface WatchListItem {
  bill: Bill;
  fiscalNote: FiscalNote;
  addedDate: string;
  alertEnabled: boolean;
  notes?: string;
}

interface FiscalWatchListProps {
  availableBills: Array<{ bill: Bill; fiscalNote: FiscalNote }>;
}

// Simple localStorage-based persistence
const STORAGE_KEY = 'mo-leg-fiscal-watchlist';

function getWatchList(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveWatchList(billIds: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(billIds));
}

export function FiscalWatchList({ availableBills }: FiscalWatchListProps) {
  const [watchedBillIds, setWatchedBillIds] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState<Record<string, boolean>>({});

  // Load watchlist from localStorage on mount
  useEffect(() => {
    setWatchedBillIds(getWatchList());
  }, []);

  // Save to localStorage when watchlist changes
  useEffect(() => {
    saveWatchList(watchedBillIds);
  }, [watchedBillIds]);

  const watchedBills = availableBills.filter(({ bill }) =>
    watchedBillIds.includes(bill.id)
  );

  const unwatchedBills = availableBills.filter(
    ({ bill }) => !watchedBillIds.includes(bill.id)
  );

  const addToWatchList = (billId: string) => {
    if (!watchedBillIds.includes(billId)) {
      setWatchedBillIds([...watchedBillIds, billId]);
      setAlertsEnabled((prev) => ({ ...prev, [billId]: true }));
    }
  };

  const removeFromWatchList = (billId: string) => {
    setWatchedBillIds(watchedBillIds.filter((id) => id !== billId));
  };

  const toggleAlert = (billId: string) => {
    setAlertsEnabled((prev) => ({ ...prev, [billId]: !prev[billId] }));
  };

  // Calculate totals
  const totalWatchedImpact = watchedBills.reduce(
    (sum, { fiscalNote }) => sum + fiscalNote.netImpact,
    0
  );
  const totalWeightedImpact = watchedBills.reduce(
    (sum, { bill, fiscalNote }) =>
      sum + fiscalNote.netImpact * getPassageProbability(bill.currentStatus),
    0
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            <h3 className="font-semibold">Fiscal Watch List</h3>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Bills
          </button>
        </div>
        {watchedBills.length > 0 && (
          <div className="mt-3 flex items-center gap-4 text-sm">
            <span className="text-indigo-200">
              Watching {watchedBills.length} bills
            </span>
            <span className="text-indigo-200">|</span>
            <span>
              Total Impact:{' '}
              <span className={cn('font-bold', totalWatchedImpact < 0 ? 'text-red-300' : 'text-green-300')}>
                {formatCurrency(totalWatchedImpact, { compact: true, showSign: true })}
              </span>
            </span>
            <span className="text-indigo-200">|</span>
            <span>
              Weighted:{' '}
              <span className={cn('font-bold', totalWeightedImpact < 0 ? 'text-orange-300' : 'text-emerald-300')}>
                {formatCurrency(totalWeightedImpact, { compact: true, showSign: true })}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Watch List */}
      <div className="p-4">
        {watchedBills.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <EyeOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No bills in your watch list</p>
            <p className="text-sm mt-1">
              Add bills to track their fiscal impact and progress
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
            >
              Add Your First Bill
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {watchedBills.map(({ bill, fiscalNote }) => {
              const probability = getPassageProbability(bill.currentStatus);
              const weightedImpact = fiscalNote.netImpact * probability;
              const isAlertEnabled = alertsEnabled[bill.id] ?? true;

              return (
                <div
                  key={bill.id}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {/* Impact indicator */}
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      fiscalNote.netImpact < 0 ? 'bg-red-100' : 'bg-green-100'
                    )}
                  >
                    {fiscalNote.netImpact < 0 ? (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    ) : (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    )}
                  </div>

                  {/* Bill info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/bills/${bill.billNumber.toLowerCase().replace(' ', '-')}`}
                        className="font-medium text-gray-900 hover:text-indigo-600"
                      >
                        {bill.billNumber}
                      </Link>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-600">
                        {STATUS_LABELS[bill.currentStatus]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{bill.title}</p>
                  </div>

                  {/* Fiscal summary */}
                  <div className="text-right flex-shrink-0">
                    <p className={cn('font-bold', getFiscalImpactColor(fiscalNote.netImpact))}>
                      {formatCurrency(fiscalNote.netImpact, { compact: true, showSign: true })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatPercentage(probability)} - {getProbabilityLabel(probability)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleAlert(bill.id)}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        isAlertEnabled
                          ? 'text-indigo-600 hover:bg-indigo-100'
                          : 'text-gray-400 hover:bg-gray-200'
                      )}
                      title={isAlertEnabled ? 'Disable alerts' : 'Enable alerts'}
                    >
                      {isAlertEnabled ? (
                        <Bell className="w-4 h-4" />
                      ) : (
                        <BellOff className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => removeFromWatchList(bill.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove from watch list"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg m-4 max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Add Bills to Watch List</h3>
              <p className="text-sm text-gray-500 mt-1">
                Select bills with fiscal notes to track
              </p>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {unwatchedBills.length === 0 ? (
                <p className="text-center py-8 text-gray-500">
                  All bills with fiscal notes are already in your watch list
                </p>
              ) : (
                <div className="space-y-2">
                  {unwatchedBills.map(({ bill, fiscalNote }) => (
                    <button
                      key={bill.id}
                      onClick={() => {
                        addToWatchList(bill.id);
                        if (unwatchedBills.length === 1) {
                          setShowAddModal(false);
                        }
                      }}
                      className="w-full flex items-center gap-3 p-3 text-left bg-gray-50 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 border border-transparent transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {bill.billNumber}
                          </span>
                          <span
                            className={cn(
                              'px-2 py-0.5 text-xs rounded-full',
                              bill.chamber === 'senate'
                                ? 'bg-mo-navy text-white'
                                : 'bg-mo-blue text-white'
                            )}
                          >
                            {bill.chamber}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {bill.title}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p
                          className={cn(
                            'font-bold',
                            getFiscalImpactColor(fiscalNote.netImpact)
                          )}
                        >
                          {formatCurrency(fiscalNote.netImpact, {
                            compact: true,
                            showSign: true,
                          })}
                        </p>
                      </div>
                      <Plus className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowAddModal(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
