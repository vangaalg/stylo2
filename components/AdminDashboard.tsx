import React, { useEffect, useState } from 'react';
import { perfLogger, LogEntry } from '../utils/performanceLogger';
import { getAllUsers, findUserByEmail, giftCreditsToUser } from '../services/userService';

interface AdminDashboardProps {
  onClose: () => void;
}

type Tab = 'users' | 'performance';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // User management state
  const [users, setUsers] = useState<any[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [giftCredits, setGiftCredits] = useState('');
  const [giftCreditsUserId, setGiftCreditsUserId] = useState<string | null>(null);
  const [userGiftInputs, setUserGiftInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load users
  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab]);

  // Load performance logs
  useEffect(() => {
    if (activeTab === 'performance') {
      setLogs(perfLogger.getLogs());
      const unsubscribe = perfLogger.subscribe((newLog) => {
        setLogs(prev => [newLog, ...prev].slice(0, 100));
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const allUsers = await getAllUsers(200);
      setUsers(allUsers);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGiftToNewEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !giftCredits) return;
    
    setLoading(true);
    setMessage(null);
    
    try {
      const credits = parseInt(giftCredits);
      if (isNaN(credits) || credits <= 0) {
        throw new Error('Please enter a valid number of credits');
      }
      
      // Try to find user first
      const user = await findUserByEmail(newEmail);
      
      if (user) {
        // User exists, gift credits
        await giftCreditsToUser(user.id, credits);
        setMessage({ type: 'success', text: `Successfully gifted ${credits} credits to ${newEmail}` });
        setNewEmail('');
        setGiftCredits('');
        loadUsers();
      } else {
        setMessage({ type: 'error', text: `User with email ${newEmail} not found. They need to sign up first.` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGiftToExistingUser = async (userId: string, email: string, creditsInput: string) => {
    if (!creditsInput) {
      setMessage({ type: 'error', text: 'Please enter number of credits to gift' });
      return;
    }
    
    setLoading(true);
    setMessage(null);
    setGiftCreditsUserId(userId);
    
    try {
      const credits = parseInt(creditsInput);
      if (isNaN(credits) || credits <= 0) {
        throw new Error('Please enter a valid number of credits');
      }
      
      await giftCreditsToUser(userId, credits);
      setMessage({ type: 'success', text: `Successfully gifted ${credits} credits to ${email}` });
      setGiftCreditsUserId(null);
      loadUsers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
      setGiftCreditsUserId(null);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchEmail.toLowerCase())
  );

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
      <div className="bg-zinc-900 w-full max-w-6xl h-[85vh] rounded-2xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Admin Dashboard</h2>
              <p className="text-xs text-zinc-400">Manage users and monitor performance</p>
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

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/50">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 text-sm font-semibold transition ${
              activeTab === 'users'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-6 py-3 text-sm font-semibold transition ${
              activeTab === 'performance'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Performance Dashboard
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'users' ? (
            <div className="space-y-6">
              {/* Message */}
              {message && (
                <div className={`p-4 rounded-lg ${
                  message.type === 'success' 
                    ? 'bg-green-900/30 border border-green-700 text-green-300' 
                    : 'bg-red-900/30 border border-red-700 text-red-300'
                }`}>
                  {message.text}
                </div>
              )}

              {/* Gift Credits to New Email */}
              <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700">
                <h3 className="text-lg font-bold text-white mb-4">Gift Credits to Email</h3>
                <form onSubmit={handleGiftToNewEmail} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">Email Address</label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                        placeholder="user@example.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">Credits to Gift</label>
                      <input
                        type="number"
                        value={giftCredits}
                        onChange={(e) => setGiftCredits(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                        placeholder="100"
                        min="1"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Gift Credits'}
                  </button>
                </form>
                <p className="text-xs text-zinc-500 mt-3">
                  Note: User must have signed up first. If they haven't, ask them to create an account.
                </p>
              </div>

              {/* Existing Users List */}
              <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-white">Existing Users</h3>
                  <input
                    type="text"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-64"
                    placeholder="Search by email..."
                  />
                </div>
                
                <div className="space-y-2 max-h-96 overflow-auto">
                  {loading ? (
                    <div className="text-center py-8 text-zinc-500">Loading users...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">No users found</div>
                  ) : (
                    filteredUsers.map((user) => (
                        <div key={user.id} className="bg-zinc-900 p-4 rounded-lg border border-zinc-700 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <p className="font-semibold text-white">{user.email}</p>
                              {user.is_admin && (
                                <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs rounded">Admin</span>
                              )}
                            </div>
                            <p className="text-sm text-zinc-400 mt-1">
                              Credits: <span className="text-white font-semibold">{user.credits}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={userGiftInputs[user.id] || ''}
                              onChange={(e) => setUserGiftInputs({ ...userGiftInputs, [user.id]: e.target.value })}
                              className="w-24 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                              placeholder="Credits"
                              min="1"
                            />
                            <button
                              onClick={() => {
                                const credits = userGiftInputs[user.id] || '';
                                handleGiftToExistingUser(user.id, user.email, credits);
                                setUserGiftInputs({ ...userGiftInputs, [user.id]: '' });
                              }}
                              disabled={loading || giftCreditsUserId === user.id || !userGiftInputs[user.id]}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
                            >
                              {loading && giftCreditsUserId === user.id ? 'Gifting...' : 'Gift'}
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats Summary */}
              <div className="grid grid-cols-3 gap-4">
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
              <div className="bg-zinc-950/30 rounded-lg">
                <div className="w-full text-left border-collapse">
                  <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider flex px-4 py-3 z-10">
                    <div className="w-24">Time</div>
                    <div className="w-16 text-center">Type</div>
                    <div className="flex-1">Operation</div>
                    <div className="w-24 text-right">Duration</div>
                  </div>
                  
                  <div className="space-y-1 mt-2 p-4 max-h-96 overflow-auto">
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
          )}
        </div>
      </div>
    </div>
  );
};
