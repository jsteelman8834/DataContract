'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  formatCurrency,
  formatPercentage,
  getLikelihoodDots,
  getProbabilityLabel,
  getFiscalImpactColor,
} from '@/lib/fiscal-utils';
import type { FiscalNote } from '@/types';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface FiscalSummaryCardProps {
  fiscalNote: FiscalNote;
  passageProbability: number;
  onViewDetails?: () => void;
  compact?: boolean;
}

export function FiscalSummaryCard({
  fiscalNote,
  passageProbability,
  onViewDetails,
  compact = false,
}: FiscalSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const weightedImpact = fiscalNote.netImpact * passageProbability;
  const likelihoodDots = getLikelihoodDots(passageProbability);
  const impactIsNegative = fiscalNote.netImpact < 0;

  // Prepare chart data
  const chartData = fiscalNote.yearByYearImpact.map((year) => ({
    year: `FY${year.fiscalYear.toString().slice(-2)}`,
    cost: year.cost / 1_000_000,
    revenue: year.revenue / 1_000_000,
    net: year.netImpact / 1_000_000,
  }));

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-3 border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Fiscal Impact</span>
          </div>
          <div className={cn('text-sm font-bold', getFiscalImpactColor(fiscalNote.netImpact))}>
            {formatCurrency(fiscalNote.netImpact, { compact: true, showSign: true })}
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
          <span>Weighted: {formatCurrency(weightedImpact, { compact: true, showSign: true })}</span>
          <span>{formatPercentage(passageProbability)} likely</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            <h3 className="font-semibold">Fiscal Impact</h3>
          </div>
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="text-xs px-2 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
            >
              View Details
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        {/* Net Impact Display */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">
              FY{fiscalNote.fiscalYears[0]} Net Impact
            </p>
            <p className={cn('text-3xl font-bold', getFiscalImpactColor(fiscalNote.netImpact))}>
              {formatCurrency(fiscalNote.netImpact, { compact: true, showSign: true })}
            </p>
          </div>
          <div className="text-right">
            {impactIsNegative ? (
              <TrendingDown className="w-8 h-8 text-red-500" />
            ) : (
              <TrendingUp className="w-8 h-8 text-green-500" />
            )}
          </div>
        </div>

        {/* Cost/Revenue Breakdown */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-xs text-red-600 font-medium">Appropriations</p>
            <p className="text-lg font-bold text-red-700">
              {formatCurrency(fiscalNote.estimatedCost || 0, { compact: true })}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-600 font-medium">Revenue</p>
            <p className="text-lg font-bold text-green-700">
              {formatCurrency(fiscalNote.estimatedRevenue || 0, { compact: true })}
            </p>
          </div>
        </div>

        {/* Year-over-Year Chart */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2 font-medium">
            {fiscalNote.yearByYearImpact.length}-Year Projection
          </p>
          <div className="h-40 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}M`}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                  }}
                  formatter={(value, name) => value !== undefined ? [
                    `$${Number(value).toFixed(1)}M`,
                    name === 'cost' ? 'Cost' : name === 'revenue' ? 'Revenue' : 'Net',
                  ] : ['']}
                />
                <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                <Bar dataKey="cost" name="cost" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                <Bar dataKey="revenue" name="revenue" stackId="b" fill="#22c55e" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Passage Likelihood */}
        <div className="bg-slate-50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Passage Likelihood</span>
            <span className="text-sm font-medium">
              {getProbabilityLabel(passageProbability)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((dot) => (
              <div
                key={dot}
                className={cn(
                  'w-6 h-2 rounded-full transition-colors',
                  dot <= likelihoodDots ? 'bg-mo-blue' : 'bg-gray-200'
                )}
              />
            ))}
            <span className="ml-2 text-sm font-bold text-mo-navy">
              {formatPercentage(passageProbability)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Weighted Impact</span>
              <span className={cn('font-bold', getFiscalImpactColor(weightedImpact))}>
                {formatCurrency(weightedImpact, { compact: true, showSign: true })}
              </span>
            </div>
          </div>
        </div>

        {/* Expandable Details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-sm text-mo-blue hover:text-mo-navy transition-colors py-2"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show More Details
            </>
          )}
        </button>

        {expanded && (
          <div className="pt-4 border-t border-gray-200 space-y-4">
            {/* Fund Breakdown */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Impact by Fund
              </p>
              <div className="space-y-2">
                {Object.entries(fiscalNote.fundImpacts).map(([fund, amount]) => {
                  if (amount === 0) return null;
                  const label = fund
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, (str) => str.toUpperCase());
                  return (
                    <div key={fund} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{label}</span>
                      <span className={cn('font-medium', getFiscalImpactColor(amount))}>
                        {formatCurrency(amount, { compact: true, showSign: true })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Uncertainty Range */}
            {fiscalNote.uncertaintyRange && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Uncertainty Range
                </p>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm text-gray-600">
                    {formatCurrency(fiscalNote.uncertaintyRange.low, { compact: true })} to{' '}
                    {formatCurrency(fiscalNote.uncertaintyRange.high, { compact: true })}
                  </span>
                </div>
              </div>
            )}

            {/* Key Assumptions */}
            {fiscalNote.assumptions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Key Assumptions
                </p>
                <ul className="space-y-1">
                  {fiscalNote.assumptions.map((assumption, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                      <Info className="w-3 h-3 mt-1 text-gray-400 flex-shrink-0" />
                      {assumption}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Metadata */}
            <div className="pt-2 border-t border-gray-100 text-xs text-gray-500">
              <div className="flex items-center justify-between">
                <span>Issuing Agency: {fiscalNote.issuingAgency}</span>
                <span>Published: {fiscalNote.publishedDate}</span>
              </div>
              {fiscalNote.pdfUrl && (
                <a
                  href={fiscalNote.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-mo-blue hover:underline mt-2"
                >
                  <FileText className="w-3 h-3" />
                  View Full Fiscal Note (PDF)
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
