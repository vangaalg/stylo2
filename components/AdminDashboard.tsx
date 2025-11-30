import React, { useEffect, useState } from 'react';
import { perfLogger, LogEntry } from '../utils/performanceLogger';

interface AdminDashboardProps {
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Load initial logs
    setLogs(perfLogger.getLogs());

    // Subscribe to new logs
    const unsubscribe = perfLogger.subscribe((newLog) => {
      setLogs(prev => [newLog, ...prev].slice(0, 100));
    });

    return () => unsubscribe();
  }, []);

  const getDurationColor = (duration?: number) => {
    if (!duration) return 'text-zinc-400';
    if (duration < 1000) return 'text-green-400';
    if (duration < 5000) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getEntryIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'start': return '🏁';
      case 'end': return '✅';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-zinc-900 w-full max-w-4xl h-[80vh] rounded-2xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Performance Dashboard</h2>
              <p className="text-xs text-zinc-400">Real-time system metrics & logs</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition"
          >
            <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-zinc-900 border-b border-zinc-800">
          <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg">
            <p className="text-xs text-zinc-500 mb-1">Total Operations</p>
            <p className="text-xl font-bold text-white">{logs.filter(l => l.type === 'end').length}</p>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg">
            <p className="text-xs text-zinc-500 mb-1">Avg Generation Time</p>
            <p className="text-xl font-bold text-indigo-400">
              {(() => {
                const genLogs = logs.filter(l => l.id.includes('Gemini Gen') && l.duration);
                if (!genLogs.length) return '0s';
                const avg = genLogs.reduce((acc, curr) => acc + (curr.duration || 0), 0) / genLogs.length;
                return (avg / 1000).toFixed(2) + 's';
              })()}
            </p>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg">
            <p className="text-xs text-zinc-500 mb-1">Errors</p>
            <p className="text-xl font-bold text-red-500">{logs.filter(l => l.type === 'error').length}</p>
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-auto p-4 bg-zinc-950/30">
          <div className="w-full text-left border-collapse">
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider flex px-4 py-3 z-10">
              <div className="w-24">Time</div>
              <div className="w-16 text-center">Type</div>
              <div className="flex-1">Operation</div>
              <div className="w-24 text-right">Duration</div>
            </div>
            
            <div className="space-y-1 mt-2">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-zinc-600">
                  Waiting for operations...
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="flex items-center px-4 py-2 text-sm hover:bg-zinc-800/50 rounded-lg transition border border-transparent hover:border-zinc-800">
                    <div className="w-24 text-zinc-500 font-mono text-xs">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div className="w-16 text-center text-lg" title={log.type}>
                      {getEntryIcon(log.type)}
                    </div>
                    <div className="flex-1 font-medium text-zinc-300 truncate pr-4">
                      {log.message}
                      {log.data && (
                        <pre className="mt-1 text-[10px] text-zinc-500 bg-zinc-950 p-1 rounded overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                    <div className={`w-24 text-right font-mono ${getDurationColor(log.duration)}`}>
                      {log.duration ? `${(log.duration / 1000).toFixed(2)}s` : '-'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

