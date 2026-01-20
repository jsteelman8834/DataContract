'use client';

/**
 * Version Diff Modal
 *
 * Displays semantic differences between bill versions
 */

import { useState, useCallback, useEffect } from 'react';
import { X, Loader2, AlertTriangle, ArrowRight, GitCompare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SemanticChange {
  id: string;
  type: 'policy' | 'scope' | 'fiscal' | 'timeline' | 'enforcement' | 'technical';
  severity: 'major' | 'moderate' | 'minor';
  location: string;
  summary: string;
  details: string;
  beforeText?: string;
  afterText?: string;
}

interface VersionDiffModalProps {
  billId: string;
  billNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

export function VersionDiffModal({
  billId,
  billNumber,
  isOpen,
  onClose,
}: VersionDiffModalProps) {
  const [versions, setVersions] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedV1, setSelectedV1] = useState<string | null>(null);
  const [selectedV2, setSelectedV2] = useState<string | null>(null);
  const [comparison, setComparison] = useState<string | null>(null);
  const [changes, setChanges] = useState<SemanticChange[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load versions on open
  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, billId]);

  const loadVersions = useCallback(async () => {
    try {
      const response = await fetch(`/api/chat?action=versions&billId=${billId}`);
      const data = await response.json();
      if (data.versions) {
        setVersions(data.versions);
        if (data.versions.length >= 2) {
          setSelectedV1(data.versions[0].id);
          setSelectedV2(data.versions[1].id);
        }
      }
    } catch (err) {
      console.error('Failed to load versions:', err);
    }
  }, [billId]);

  const runComparison = useCallback(async () => {
    if (!selectedV1 || !selectedV2) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId,
          action: 'compare',
          version1: selectedV1,
          version2: selectedV2,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Comparison failed');
      }

      setComparison(data.comparison);
      setChanges(data.changes || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [billId, selectedV1, selectedV2]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <GitCompare className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold">Version Comparison</h2>
              <p className="text-sm text-gray-500">{billNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Version Selectors */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Version 1
              </label>
              <select
                value={selectedV1 || ''}
                onChange={(e) => setSelectedV1(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select version...</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="w-5 h-5 text-gray-400 mt-6" />

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Version 2
              </label>
              <select
                value={selectedV2 || ''}
                onChange={(e) => setSelectedV2(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select version...</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={runComparison}
              disabled={!selectedV1 || !selectedV2 || isLoading}
              className={cn(
                'px-4 py-2 rounded-md mt-6',
                'bg-blue-600 text-white hover:bg-blue-700',
                'disabled:bg-gray-300 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Compare'
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600">Analyzing changes...</p>
            </div>
          )}

          {comparison && !isLoading && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Summary</h3>
                <p className="text-sm text-blue-800 whitespace-pre-wrap">
                  {comparison}
                </p>
              </div>

              {/* Changes List */}
              {changes.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">
                    Detected Changes ({changes.length})
                  </h3>
                  <div className="space-y-3">
                    {changes.map((change) => (
                      <ChangeCard key={change.id} change={change} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!comparison && !isLoading && !error && (
            <div className="text-center py-12 text-gray-500">
              Select two versions and click Compare to see differences.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Individual change card
 */
function ChangeCard({ change }: { change: SemanticChange }) {
  const severityColors = {
    major: 'border-red-300 bg-red-50',
    moderate: 'border-yellow-300 bg-yellow-50',
    minor: 'border-blue-300 bg-blue-50',
  };

  const typeLabels = {
    policy: 'Policy Change',
    scope: 'Scope Change',
    fiscal: 'Fiscal Change',
    timeline: 'Timeline Change',
    enforcement: 'Enforcement Change',
    technical: 'Technical Change',
  };

  return (
    <div className={cn('p-4 border rounded-lg', severityColors[change.severity])}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-xs font-medium uppercase text-gray-500">
            {typeLabels[change.type]}
          </span>
          <span className="mx-2 text-gray-300">•</span>
          <span className="text-xs text-gray-500">{change.location}</span>
        </div>
        <span
          className={cn(
            'px-2 py-0.5 text-xs font-medium rounded',
            change.severity === 'major' && 'bg-red-100 text-red-700',
            change.severity === 'moderate' && 'bg-yellow-100 text-yellow-700',
            change.severity === 'minor' && 'bg-blue-100 text-blue-700'
          )}
        >
          {change.severity}
        </span>
      </div>
      <h4 className="font-medium text-gray-900 mb-1">{change.summary}</h4>
      <p className="text-sm text-gray-700">{change.details}</p>
    </div>
  );
}

export default VersionDiffModal;
