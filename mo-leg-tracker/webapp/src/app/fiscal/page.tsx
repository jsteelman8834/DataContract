'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from 'recharts';
import legislativeData from '@/data/legislative-data';
import { cn } from '@/lib/utils';
import {
  formatCurrency,
  formatPercentage,
  getPassageProbability,
  getFiscalImpactColor,
  generateFiscalExportData,
  getProbabilityLabel,
} from '@/lib/fiscal-utils';
import { STATUS_LABELS } from '@/types';
import type { RiskQuadrantBill } from '@/types';
import { FiscalWatchList } from '@/components/fiscal';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  BarChart3,
  PieChart,
  AlertTriangle,
  Download,
  Filter,
  Eye,
  Building2,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Activity,
} from 'lucide-react';

// Session trajectory data (simulated)
const generateTrajectoryData = () => {
  const data = [];
  const startDate = new Date('2026-01-08');
  const today = new Date('2026-01-16');

  let runningTotal = 0;
  let weightedTotal = 0;

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dayProgress = (d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    // Simulate fiscal impact accumulating
    runningTotal = -50000000 - (dayProgress * 30000000);
    weightedTotal = runningTotal * 0.35;

    data.push({
      date: d.toISOString().split('T')[0],
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      rawImpact: runningTotal / 1_000_000,
      weightedImpact: weightedTotal / 1_000_000,
    });
  }

  return data;
};

export default function FiscalDashboardPage() {
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);
  const [impactFilter, setImpactFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const fiscalSummary = useMemo(() => legislativeData.getSessionFiscalSummary(), []);
  const committeeSummaries = useMemo(() => legislativeData.getCommitteeFiscalSummaries(), []);
  const riskQuadrantBills = useMemo(() => legislativeData.getRiskQuadrantBills(), []);
  const highImpactBills = useMemo(() => legislativeData.getHighImpactBills(10_000_000), []);
  const billsWithFiscal = useMemo(() => legislativeData.getBillsWithFiscalNotes(), []);
  const trajectoryData = useMemo(() => generateTrajectoryData(), []);

  // Prepare scatter plot data for risk quadrant
  const scatterData = riskQuadrantBills.map((item) => ({
    ...item,
    x: item.probability * 100,
    y: item.absoluteImpact / 1_000_000,
    name: item.bill.billNumber,
  }));

  // Filter by quadrant if selected
  const filteredScatterData = selectedQuadrant
    ? scatterData.filter((d) => d.quadrant === selectedQuadrant)
    : scatterData;

  // Export handler
  const handleExport = () => {
    const csv = generateFiscalExportData(billsWithFiscal);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiscal-impact-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const quadrantCounts = {
    critical: riskQuadrantBills.filter((b) => b.quadrant === 'critical').length,
    watch: riskQuadrantBills.filter((b) => b.quadrant === 'watch').length,
    tracking: riskQuadrantBills.filter((b) => b.quadrant === 'tracking').length,
    monitor: riskQuadrantBills.filter((b) => b.quadrant === 'monitor').length,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <DollarSign className="w-8 h-8 mr-3" />
            Fiscal Impact Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Track budget and revenue impacts across the 2026 legislative session
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-mo-navy text-white rounded-lg hover:bg-mo-blue transition-colors"
        >
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-100 text-sm font-medium">Total Appropriations</span>
            <TrendingDown className="w-5 h-5 text-red-200" />
          </div>
          <p className="text-3xl font-bold">
            {formatCurrency(fiscalSummary.totalCost, { compact: true })}
          </p>
          <p className="text-red-200 text-sm mt-1">
            Weighted: {formatCurrency(fiscalSummary.weightedCost, { compact: true })}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-100 text-sm font-medium">Revenue Impact</span>
            <TrendingUp className="w-5 h-5 text-green-200" />
          </div>
          <p className="text-3xl font-bold">
            {formatCurrency(fiscalSummary.totalRevenue, { compact: true, showSign: true })}
          </p>
          <p className="text-green-200 text-sm mt-1">
            Weighted: {formatCurrency(fiscalSummary.weightedRevenue, { compact: true, showSign: true })}
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-orange-100 text-sm font-medium">Net Session Impact</span>
            <Activity className="w-5 h-5 text-orange-200" />
          </div>
          <p className="text-3xl font-bold">
            {formatCurrency(fiscalSummary.netImpact, { compact: true, showSign: true })}
          </p>
          <p className="text-orange-200 text-sm mt-1">
            Weighted: {formatCurrency(fiscalSummary.weightedNetImpact, { compact: true, showSign: true })}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-100 text-sm font-medium">Bills with Fiscal Notes</span>
            <FileText className="w-5 h-5 text-blue-200" />
          </div>
          <p className="text-3xl font-bold">
            {fiscalSummary.billCount}
          </p>
          <p className="text-blue-200 text-sm mt-1">
            {fiscalSummary.highImpactBillCount} high impact (&gt;$10M)
          </p>
        </div>
      </div>

      {/* Session Trajectory Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Session Fiscal Trajectory
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              How the weighted fiscal impact evolves as bills progress
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span className="text-gray-600">Raw Impact</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span className="text-gray-600">Probability-Weighted</span>
            </div>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectoryData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRaw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorWeighted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `$${v}M`}
                axisLine={false}
              />
              <Tooltip
                formatter={(value) => value !== undefined ? [`$${Number(value).toFixed(1)}M`] : ['']}
                contentStyle={{ borderRadius: 8 }}
              />
              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="rawImpact"
                name="Raw Impact"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#colorRaw)"
              />
              <Area
                type="monotone"
                dataKey="weightedImpact"
                name="Weighted Impact"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorWeighted)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Risk Quadrant Matrix */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Target className="w-5 h-5 mr-2" />
                Risk Quadrant Matrix
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Bills by probability and fiscal impact
              </p>
            </div>
            {selectedQuadrant && (
              <button
                onClick={() => setSelectedQuadrant(null)}
                className="text-sm text-mo-blue hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>

          {/* Quadrant Selector */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setSelectedQuadrant(selectedQuadrant === 'watch' ? null : 'watch')}
              className={cn(
                'p-3 rounded-lg border-2 text-left transition-colors',
                selectedQuadrant === 'watch'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 hover:border-amber-300'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-600 uppercase">Watch</span>
                <span className="text-sm font-bold text-amber-700">{quadrantCounts.watch}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">High impact, lower probability</p>
            </button>
            <button
              onClick={() => setSelectedQuadrant(selectedQuadrant === 'critical' ? null : 'critical')}
              className={cn(
                'p-3 rounded-lg border-2 text-left transition-colors',
                selectedQuadrant === 'critical'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-red-300'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-600 uppercase">Critical</span>
                <span className="text-sm font-bold text-red-700">{quadrantCounts.critical}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">High impact, high probability</p>
            </button>
            <button
              onClick={() => setSelectedQuadrant(selectedQuadrant === 'monitor' ? null : 'monitor')}
              className={cn(
                'p-3 rounded-lg border-2 text-left transition-colors',
                selectedQuadrant === 'monitor'
                  ? 'border-gray-500 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-400'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 uppercase">Monitor</span>
                <span className="text-sm font-bold text-gray-700">{quadrantCounts.monitor}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Lower impact, lower probability</p>
            </button>
            <button
              onClick={() => setSelectedQuadrant(selectedQuadrant === 'tracking' ? null : 'tracking')}
              className={cn(
                'p-3 rounded-lg border-2 text-left transition-colors',
                selectedQuadrant === 'tracking'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-600 uppercase">Tracking</span>
                <span className="text-sm font-bold text-blue-700">{quadrantCounts.tracking}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Lower impact, high probability</p>
            </button>
          </div>

          {/* Scatter Plot */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Probability"
                  unit="%"
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Passage Probability', position: 'bottom', fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Impact"
                  unit="M"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Impact ($M)', angle: -90, position: 'left', fontSize: 11 }}
                />
                <ZAxis range={[100, 400]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as RiskQuadrantBill & { x: number; y: number; name: string };
                      return (
                        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                          <p className="font-bold text-gray-900">{data.name}</p>
                          <p className="text-sm text-gray-600">
                            Impact: {formatCurrency(data.absoluteImpact, { compact: true })}
                          </p>
                          <p className="text-sm text-gray-600">
                            Probability: {formatPercentage(data.probability)}
                          </p>
                          <p className={cn(
                            'text-xs font-medium mt-1 capitalize',
                            data.quadrant === 'critical' && 'text-red-600',
                            data.quadrant === 'watch' && 'text-amber-600',
                            data.quadrant === 'tracking' && 'text-blue-600',
                            data.quadrant === 'monitor' && 'text-gray-600',
                          )}>
                            {data.quadrant}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine x={50} stroke="#d1d5db" strokeDasharray="3 3" />
                <ReferenceLine y={10} stroke="#d1d5db" strokeDasharray="3 3" />
                <Scatter data={filteredScatterData}>
                  {filteredScatterData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.quadrant === 'critical' ? '#ef4444' :
                        entry.quadrant === 'watch' ? '#f59e0b' :
                        entry.quadrant === 'tracking' ? '#3b82f6' :
                        '#6b7280'
                      }
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Committee Fiscal Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Building2 className="w-5 h-5 mr-2" />
              Committee Fiscal Responsibility
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Weighted fiscal impact by committee
            </p>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={committeeSummaries.slice(0, 8).map((c) => ({
                  name: c.committee.shortName,
                  impact: c.weightedNetImpact / 1_000_000,
                  bills: c.billCount,
                }))}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `$${v}M`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={75}
                />
                <Tooltip
                  formatter={(value) => value !== undefined ? [
                    `$${Number(value).toFixed(1)}M`,
                    'Weighted Impact',
                  ] : ['']}
                  contentStyle={{ borderRadius: 8 }}
                />
                <ReferenceLine x={0} stroke="#9ca3af" />
                <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                  {committeeSummaries.slice(0, 8).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.weightedNetImpact < 0 ? '#ef4444' : '#22c55e'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* High Impact Bills Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                High Impact Bills
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Bills with fiscal impact greater than $10M
              </p>
            </div>
            <Link
              href="/bills"
              className="text-sm text-mo-blue hover:underline flex items-center gap-1"
            >
              View all bills
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Bill</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">Impact</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">Weighted</th>
                </tr>
              </thead>
              <tbody>
                {highImpactBills.slice(0, 6).map(({ bill, fiscalNote, weightedImpact }) => {
                  return (
                    <tr key={bill.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <Link
                          href={`/bills/${bill.billNumber.toLowerCase().replace(' ', '-')}`}
                          className="font-medium text-mo-blue hover:underline"
                        >
                          {bill.billNumber}
                        </Link>
                        <p className="text-xs text-gray-500 truncate max-w-[200px]">{bill.title}</p>
                      </td>
                      <td className={cn('py-3 px-2 text-right font-medium', getFiscalImpactColor(fiscalNote.netImpact))}>
                        {formatCurrency(fiscalNote.netImpact, { compact: true, showSign: true })}
                      </td>
                      <td className={cn('py-3 px-2 text-right font-bold', getFiscalImpactColor(weightedImpact))}>
                        {formatCurrency(weightedImpact, { compact: true, showSign: true })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fiscal Watch List */}
        <FiscalWatchList availableBills={billsWithFiscal} />
      </div>
    </div>
  );
}
