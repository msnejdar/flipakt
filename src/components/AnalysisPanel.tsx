import React, { useState } from 'react';

interface AnalysisResult {
  id: number;
  name: string;
  coordinates: [number, number];
  condition: string;
  confidence: number;
  issues: string[];
  recommendation: string;
  estimatedValue: number;
}

interface AnalysisPanelProps {
  results: AnalysisResult[];
  onExport: (format: 'csv' | 'json') => void;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ results, onExport }) => {
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<'confidence' | 'value' | 'name'>('confidence');

  const toggleExpanded = (id: number) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedResults(newExpanded);
  };

  const sortedResults = [...results].sort((a, b) => {
    switch (sortBy) {
      case 'confidence':
        return b.confidence - a.confidence;
      case 'value':
        return b.estimatedValue - a.estimatedValue;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  const neglectedProperties = results.filter(r => r.condition === 'neglected');
  const avgConfidence = results.reduce((acc, r) => acc + r.confidence, 0) / results.length;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-dark-card/95 backdrop-blur-sm border-l border-electric-blue/20 overflow-y-auto z-30">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-electric-blue">Analysis Results</h2>
          <div className="flex gap-2">
            <button
              onClick={() => onExport('csv')}
              className="px-3 py-1 text-sm bg-electric-blue/20 text-electric-blue rounded hover:bg-electric-blue/30 transition-colors"
            >
              CSV
            </button>
            <button
              onClick={() => onExport('json')}
              className="px-3 py-1 text-sm bg-electric-blue/20 text-electric-blue rounded hover:bg-electric-blue/30 transition-colors"
            >
              JSON
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="bg-dark-bg/50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Total Properties</div>
              <div className="text-white font-semibold">{results.length}</div>
            </div>
            <div>
              <div className="text-gray-400">Acquisition Targets</div>
              <div className="text-green-400 font-semibold">{neglectedProperties.length}</div>
            </div>
            <div>
              <div className="text-gray-400">Avg Confidence</div>
              <div className="text-white font-semibold">{(avgConfidence * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-gray-400">Est. Total Value</div>
              <div className="text-white font-semibold">
                {(results.reduce((acc, r) => acc + r.estimatedValue, 0) / 1000).toFixed(0)}k CZK
              </div>
            </div>
          </div>
        </div>

        {/* Sort Options */}
        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-2 block">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full bg-dark-bg border border-electric-blue/20 rounded px-3 py-2 text-white text-sm focus:border-electric-blue/50 outline-none"
          >
            <option value="confidence">Confidence</option>
            <option value="value">Estimated Value</option>
            <option value="name">Name</option>
          </select>
        </div>

        {/* Results List */}
        <div className="space-y-3">
          {sortedResults.map((result) => (
            <div key={result.id} className="bg-dark-bg/50 rounded-lg border border-electric-blue/10 overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-dark-bg/70 transition-colors"
                onClick={() => toggleExpanded(result.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-white mb-1">{result.name}</h4>
                    <div className="text-sm text-gray-400 mb-2">
                      [{result.coordinates[1].toFixed(4)}, {result.coordinates[0].toFixed(4)}]
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          result.condition === 'neglected'
                            ? 'bg-red-500/20 text-red-400'
                            : result.condition === 'good'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {result.condition}
                      </span>
                      <span className="text-sm text-gray-400">
                        {(result.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">
                      {(result.estimatedValue / 1000).toFixed(0)}k CZK
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 mt-1 transition-transform ${
                        expandedResults.has(result.id) ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {expandedResults.has(result.id) && (
                <div className="px-4 pb-4 border-t border-electric-blue/10">
                  <div className="mt-3">
                    <h5 className="text-sm font-semibold text-white mb-2">Identified Issues</h5>
                    <ul className="space-y-1">
                      {result.issues.map((issue, index) => (
                        <li key={index} className="text-sm text-gray-400 flex items-center gap-2">
                          <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-3">
                    <h5 className="text-sm font-semibold text-white mb-1">Recommendation</h5>
                    <p className="text-sm text-gray-300">{result.recommendation}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {results.length === 0 && (
          <div className="text-center text-gray-400 mt-12">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No analysis results yet</p>
            <p className="text-sm mt-1">Draw a polygon on the map to start analysis</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPanel;