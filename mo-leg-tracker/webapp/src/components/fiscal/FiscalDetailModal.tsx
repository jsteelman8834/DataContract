'use client';

import { useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
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
import type { FiscalNote, Bill } from '@/types';
import {
  X,
  DollarSign,
  TrendingDown,
  TrendingUp,
  FileText,
  AlertTriangle,
  Info,
  Building,
  Calendar,
  User,
  Download,
} from 'lucide-react';

interface FiscalDetailModalProps {
  fiscalNote: FiscalNote;
  bill: Bill;
  passageProbability: number;
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = {
  cost: '#ef4444',
  revenue: '#22c55e',
  generalRevenue: '#3b82f6',
  federalFunds: '#8b5cf6',
  otherStateFunds: '#f59e0b',
  localGovernment: '#6366f1',
};

export function FiscalDetailModal({
  fiscalNote,
  bill,
  passageProbability,
  isOpen,
  onClose,
}: FiscalDetailModalProps) {
  const weightedImpact = fiscalNote.netImpact * passageProbability;
  const likelihoodDots = getLikelihoodDots(passageProbability);

  // Prepare year-by-year chart data
  const yearlyData = fiscalNote.yearByYearImpact.map((year) => ({
    year: `FY${year.fiscalYear}`,
    Cost: Math.abs(year.cost) / 1_000_000,
    Revenue: Math.abs(year.revenue) / 1_000_000,
    'Net Impact': year.netImpact / 1_000_000,
  }));

  // Prepare cumulative data
  let cumulative = 0;
  const cumulativeData = fiscalNote.yearByYearImpact.map((year) => {
    cumulative += year.netImpact;
    return {
      year: `FY${year.fiscalYear}`,
      'Annual Impact': year.netImpact / 1_000_000,
      'Cumulative Impact': cumulative / 1_000_000,
    };
  });

  // Prepare fund breakdown pie chart data
  const fundData = Object.entries(fiscalNote.fundImpacts)
    .filter(([_, value]) => value !== 0)
    .map(([key, value]) => ({
      name: key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim(),
      value: Math.abs(value),
      fill: COLORS[key as keyof typeof COLORS] || '#6b7280',
    }));

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden m-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-mo-navy to-mo-blue p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-6 h-6" />
                <span className="text-lg font-bold">Fiscal Note Analysis</span>
              </div>
              <h2 className="text-xl font-bold">{bill.billNumber}</h2>
              <p className="text-white/80 text-sm mt-1">{bill.title}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <TrendingDown className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Total Cost</span>
              </div>
              <p className="text-2xl font-bold text-red-700">
                {formatCurrency(fiscalNote.estimatedCost || 0, { compact: true })}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Total Revenue</span>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(fiscalNote.estimatedRevenue || 0, { compact: true })}
              </p>
            </div>

            <div className={cn(
              'rounded-xl p-4 border',
              fiscalNote.netImpact < 0
                ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200'
                : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200'
            )}>
              <div className={cn(
                'flex items-center gap-2 mb-1',
                fiscalNote.netImpact < 0 ? 'text-orange-600' : 'text-emerald-600'
              )}>
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Net Impact</span>
              </div>
              <p className={cn(
                'text-2xl font-bold',
                fiscalNote.netImpact < 0 ? 'text-orange-700' : 'text-emerald-700'
              )}>
                {formatCurrency(fiscalNote.netImpact, { compact: true, showSign: true })}
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Weighted Impact</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(weightedImpact, { compact: true, showSign: true })}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {formatPercentage(passageProbability)} passage probability
              </p>
            </div>
          </div>

          {/* Passage Probability Visual */}
          <div className="bg-slate-50 rounded-xl p-4 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">Passage Likelihood</h3>
              <span className="px-3 py-1 bg-mo-blue text-white rounded-full text-sm font-medium">
                {getProbabilityLabel(passageProbability)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((dot) => (
                <div
                  key={dot}
                  className={cn(
                    'flex-1 h-3 rounded-full transition-colors',
                    dot <= likelihoodDots ? 'bg-mo-blue' : 'bg-gray-200'
                  )}
                />
              ))}
              <span className="ml-4 text-xl font-bold text-mo-navy">
                {formatPercentage(passageProbability)}
              </span>
            </div>
          </div>

          {/* Year-by-Year Chart */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-800 mb-4">Year-by-Year Impact</h3>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `$${v}M`}
                    />
                    <Tooltip
                      formatter={(value) => value !== undefined ? [`$${Number(value).toFixed(1)}M`] : ['']}
                      contentStyle={{ borderRadius: 8 }}
                    />
                    <Legend />
                    <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                    <Bar dataKey="Cost" fill={COLORS.cost} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Revenue" fill={COLORS.revenue} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Cumulative Impact Chart */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-800 mb-4">Cumulative Fiscal Impact</h3>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `$${v}M`}
                    />
                    <Tooltip
                      formatter={(value) => value !== undefined ? [`$${Number(value).toFixed(1)}M`] : ['']}
                      contentStyle={{ borderRadius: 8 }}
                    />
                    <Legend />
                    <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="Annual Impact"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Cumulative Impact"
                      stroke="#ef4444"
                      strokeWidth={3}
                      dot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Fund Breakdown */}
          {fundData.length > 0 && (
            <div className="mb-8">
              <h3 className="font-semibold text-gray-800 mb-4">Impact by Fund Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={fundData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${(name || '').split(' ')[0]} ${((percent || 0) * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {fundData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => value !== undefined ? [formatCurrency(Number(value), { compact: true })] : ['']}
                          contentStyle={{ borderRadius: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-3">
                  {Object.entries(fiscalNote.fundImpacts).map(([fund, amount]) => {
                    if (amount === 0) return null;
                    const label = fund
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, (str) => str.toUpperCase())
                      .trim();
                    return (
                      <div
                        key={fund}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: COLORS[fund as keyof typeof COLORS] || '#6b7280' }}
                          />
                          <span className="font-medium text-gray-700">{label}</span>
                        </div>
                        <span className={cn('font-bold', getFiscalImpactColor(amount))}>
                          {formatCurrency(amount, { compact: true, showSign: true })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Uncertainty Range */}
          {fiscalNote.uncertaintyRange && (
            <div className="mb-8">
              <h3 className="font-semibold text-gray-800 mb-4">Uncertainty Analysis</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Estimated Range</p>
                    <p className="text-amber-700">
                      The actual fiscal impact could range from{' '}
                      <span className="font-bold">
                        {formatCurrency(fiscalNote.uncertaintyRange.low, { compact: true })}
                      </span>{' '}
                      to{' '}
                      <span className="font-bold">
                        {formatCurrency(fiscalNote.uncertaintyRange.high, { compact: true })}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Assumptions */}
          {fiscalNote.assumptions.length > 0 && (
            <div className="mb-8">
              <h3 className="font-semibold text-gray-800 mb-4">Key Assumptions</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <ul className="space-y-2">
                  {fiscalNote.assumptions.map((assumption, index) => (
                    <li key={index} className="flex items-start gap-3 text-blue-800">
                      <Info className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
                      {assumption}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-800 mb-4">Analyst Summary</h3>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-gray-700 leading-relaxed">{fiscalNote.summary}</p>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-slate-100 rounded-xl p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-gray-500">Issuing Agency</p>
                  <p className="font-medium text-gray-800">{fiscalNote.issuingAgency}</p>
                </div>
              </div>
              {fiscalNote.analystName && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-gray-500">Analyst</p>
                    <p className="font-medium text-gray-800">{fiscalNote.analystName}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-gray-500">Published</p>
                  <p className="font-medium text-gray-800">{fiscalNote.publishedDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-gray-500">Note Type</p>
                  <p className="font-medium text-gray-800 capitalize">{fiscalNote.noteType}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex items-center justify-between">
          {fiscalNote.pdfUrl && (
            <a
              href={fiscalNote.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Full Fiscal Note
            </a>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-mo-navy text-white rounded-lg hover:bg-mo-blue transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
