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
    <div className="absolute right-0 top-0 h-full w-96 bg-dark-card border-l border-gray-800 overflow-y-auto z-30">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Výsledky analýzy</h2>
          <div className="flex gap-2">
            <button
              onClick={() => onExport('csv')}
              className="px-3 py-1 text-sm bg-gray-800 text-gray-200 hover:bg-gray-700 transition-colors"
            >
              CSV
            </button>
            <button
              onClick={() => onExport('json')}
              className="px-3 py-1 text-sm bg-gray-800 text-gray-200 hover:bg-gray-700 transition-colors"
            >
              JSON
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="bg-gray-900 border border-gray-800 p-3 mb-4">
          <h3 className="text-md font-semibold text-gray-300 mb-3">Přehled</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-400">Celkem nemovitostí</div>
              <div className="text-white font-mono">{results.length}</div>
            </div>
            <div>
              <div className="text-gray-400">Vhodné k akvizici</div>
              <div className="text-green-400 font-mono">{neglectedProperties.length}</div>
            </div>
            <div>
              <div className="text-gray-400">Prům. spolehlivost</div>
              <div className="text-white font-mono">{(avgConfidence * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-gray-400">Celková hodnota</div>
              <div className="text-white font-mono">
                {(results.reduce((acc, r) => acc + r.estimatedValue, 0) / 1000).toFixed(0)}k CZK
              </div>
            </div>
          </div>
        </div>

        {/* Sort Options */}
        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-1 block">Seřadit podle:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:border-electric-blue outline-none appearance-none"
          >
            <option value="confidence">Spolehlivosti</option>
            <option value="value">Odhadované hodnoty</option>
            <option value="name">Názvu</option>
          </select>
        </div>

        {/* Results List */}
        <div className="space-y-2">
          {sortedResults.map((result) => (
            <div key={result.id} className="bg-gray-900 border border-gray-800 overflow-hidden">
              <div
                className="p-3 cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => toggleExpanded(result.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-white mb-1">{result.name}</h4>
                    <div className="text-xs text-gray-500 mb-2 font-mono">
                      [{result.coordinates[1].toFixed(4)}, {result.coordinates[0].toFixed(4)}]
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium ${
                          result.condition === 'neglected'
                            ? 'bg-red-500/20 text-red-400'
                            : result.condition === 'good'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {result.condition}
                      </span>
                      <span className="text-sm text-gray-400 font-mono">
                        {(result.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold font-mono">
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
                <div className="px-3 pb-3 border-t border-gray-800">
                  <div className="mt-3">
                    <h5 className="text-sm font-semibold text-gray-300 mb-2">Zjištěné problémy</h5>
                    <ul className="space-y-1">
                      {result.issues.map((issue, index) => (
                        <li key={index} className="text-sm text-gray-400 flex items-center gap-2">
                          <div className="w-1 h-1 bg-red-400"></div>
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-3">
                    <h5 className="text-sm font-semibold text-gray-300 mb-1">Doporučení</h5>
                    <p className="text-sm text-gray-300">{result.recommendation}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {results.length === 0 && (
          <div className="text-center text-gray-500 mt-12 py-8">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>Zatím žádné výsledky analýzy</p>
            <p className="text-sm mt-1">Vymezte oblast na mapě pro spuštění analýzy</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPanel;