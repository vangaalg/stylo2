import React, { useEffect, useState } from 'react';
import { perfLogger, LogEntry } from '../utils/performanceLogger';
import { 
  getAllUsers, 
  findUserByEmail, 
  giftCreditsToUser, 
  getAllSupportTickets, 
  updateSupportTicket,
  getUserDetailedStats,
  getUserTransactionsForAdmin,
  getUserHistoryForAdmin,
  getUserSupportTicketsForAdmin,
  type UserDetailedStats
} from '../services/userService';
import { CatalogApproval } from './CatalogApproval';

interface AdminDashboardProps {
  onClose: () => void;
}

type Tab = 'users' | 'performance' | 'support' | 'catalog';

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
  
  // Support tickets state
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [refundCredits, setRefundCredits] = useState('');
  
  // User details state
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetailedStats | null>(null);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [userTickets, setUserTickets] = useState<any[]>([]);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [userDetailsTab, setUserDetailsTab] = useState<'overview' | 'transactions' | 'history' | 'support'>('overview');

  // Load users
  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab]);

  // Load support tickets
  useEffect(() => {
    if (activeTab === 'support') {
      loadSupportTickets();
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

  // Load detailed user information
  const loadUserDetails = async (userId: string) => {
    setSelectedUser(userId);
    setLoadingUserDetails(true);
    setUserDetailsTab('overview');
    
    try {
      // Load all user data in parallel
      const [stats, transactions, history, tickets] = await Promise.all([
        getUserDetailedStats(userId),
        getUserTransactionsForAdmin(userId),
        getUserHistoryForAdmin(userId, 20),
        getUserSupportTicketsForAdmin(userId)
      ]);
      
      setUserDetails(stats);
      setUserTransactions(transactions);
      setUserHistory(history);
      setUserTickets(tickets);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoadingUserDetails(false);
    }
  };

  // Load support tickets
  const loadSupportTickets = async () => {
    setLoading(true);
    try {
      const tickets = await getAllSupportTickets();
      setSupportTickets(tickets || []);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle ticket resolution
  const handleResolveTicket = async (ticketId: string, status: 'resolved' | 'rejected' | 'refunded') => {
    setLoading(true);
    setMessage(null);
    
    try {
      const credits = refundCredits ? parseInt(refundCredits) : undefined;
      if (credits && credits < 0) {
        throw new Error('Refund credits must be positive');
      }
      
      await updateSupportTicket(ticketId, status, adminNotes || undefined, credits);
      setMessage({ type: 'success', text: `Ticket ${status} successfully${credits ? ` (${credits} credits refunded)` : ''}` });
      setSelectedTicket(null);
      setAdminNotes('');
      setRefundCredits('');
      loadSupportTickets();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

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
          <button
            onClick={() => {
              setActiveTab('support');
              loadSupportTickets();
            }}
            className={`px-6 py-3 text-sm font-semibold transition ${
              activeTab === 'support'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Support Tickets
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-6 py-3 text-sm font-semibold transition ${
              activeTab === 'catalog'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Catalog Management
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'catalog' ? (
            <CatalogApproval onClose={() => setActiveTab('users')} />
          ) : activeTab === 'users' ? (
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
                        <div key={user.id} className="bg-zinc-900 p-4 rounded-lg border border-zinc-700 hover:border-zinc-600 transition">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <p className="font-semibold text-white">{user.email}</p>
                                {user.is_admin && (
                                  <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs rounded">Admin</span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400">
                                <span>Credits: <span className="text-white font-semibold">{user.credits}</span></span>
                                <span>Joined: {new Date(user.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => loadUserDetails(user.id)}
                                className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                              >
                                View Details
                              </button>
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
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'performance' ? (
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
          ) : activeTab === 'support' ? (
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

              {/* Support Tickets List */}
              <div className="space-y-4">
                {loading && supportTickets.length === 0 ? (
                  <div className="text-center py-12 text-zinc-600">Loading tickets...</div>
                ) : supportTickets.length === 0 ? (
                  <div className="text-center py-12 text-zinc-600">No support tickets found</div>
                ) : (
                  supportTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 hover:border-zinc-600 transition cursor-pointer"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-sm text-indigo-400">{ticket.ticket_number}</span>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              ticket.status === 'pending' ? 'bg-yellow-900/30 text-yellow-400' :
                              ticket.status === 'in_review' ? 'bg-blue-900/30 text-blue-400' :
                              ticket.status === 'resolved' ? 'bg-green-900/30 text-green-400' :
                              ticket.status === 'refunded' ? 'bg-purple-900/30 text-purple-400' :
                              'bg-red-900/30 text-red-400'
                            }`}>
                              {ticket.status.toUpperCase()}
                            </span>
                          </div>
                          <h3 className="text-white font-semibold mb-1">{ticket.subject}</h3>
                          <p className="text-zinc-400 text-sm line-clamp-2">{ticket.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                            <span>User: {ticket.user?.email || 'N/A'}</span>
                            <span>Credits: {ticket.credits_used}</span>
                            <span>{new Date(ticket.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Ticket Detail Modal */}
              {selectedTicket && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-zinc-900 w-full max-w-2xl rounded-2xl border border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">Ticket Details</h2>
                        <button
                          onClick={() => {
                            setSelectedTicket(null);
                            setAdminNotes('');
                            setRefundCredits('');
                          }}
                          className="text-zinc-500 hover:text-white"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-zinc-500">Ticket Number</label>
                          <p className="text-indigo-400 font-mono">{selectedTicket.ticket_number}</p>
                        </div>

                        <div>
                          <label className="text-xs text-zinc-500">Status</label>
                          <p className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            selectedTicket.status === 'pending' ? 'bg-yellow-900/30 text-yellow-400' :
                            selectedTicket.status === 'in_review' ? 'bg-blue-900/30 text-blue-400' :
                            selectedTicket.status === 'resolved' ? 'bg-green-900/30 text-green-400' :
                            selectedTicket.status === 'refunded' ? 'bg-purple-900/30 text-purple-400' :
                            'bg-red-900/30 text-red-400'
                          }`}>
                            {selectedTicket.status.toUpperCase()}
                          </p>
                        </div>

                        <div>
                          <label className="text-xs text-zinc-500">User Email</label>
                          <p className="text-white">{selectedTicket.user?.email || 'N/A'}</p>
                        </div>

                        <div>
                          <label className="text-xs text-zinc-500">Subject</label>
                          <p className="text-white">{selectedTicket.subject}</p>
                        </div>

                        <div>
                          <label className="text-xs text-zinc-500">Description</label>
                          <p className="text-white whitespace-pre-wrap">{selectedTicket.description}</p>
                        </div>

                        <div>
                          <label className="text-xs text-zinc-500">Credits Used</label>
                          <p className="text-white">{selectedTicket.credits_used}</p>
                        </div>

                        {selectedTicket.related_image_urls && selectedTicket.related_image_urls.length > 0 && (
                          <div>
                            <label className="text-xs text-zinc-500 mb-2 block">Related Images</label>
                            <div className="grid grid-cols-2 gap-2">
                              {selectedTicket.related_image_urls.map((url: string, idx: number) => (
                                <img key={idx} src={url} alt={`Related ${idx + 1}`} className="rounded-lg w-full" />
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedTicket.admin_notes && (
                          <div>
                            <label className="text-xs text-zinc-500">Admin Notes</label>
                            <p className="text-zinc-300 whitespace-pre-wrap">{selectedTicket.admin_notes}</p>
                          </div>
                        )}

                        {selectedTicket.status === 'pending' || selectedTicket.status === 'in_review' ? (
                          <div className="space-y-4 pt-4 border-t border-zinc-800">
                            <div>
                              <label className="block text-sm text-zinc-400 mb-2">Admin Notes</label>
                              <textarea
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                rows={3}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
                                placeholder="Add notes about resolution..."
                              />
                            </div>

                            <div>
                              <label className="block text-sm text-zinc-400 mb-2">Refund Credits (Optional)</label>
                              <input
                                type="number"
                                value={refundCredits}
                                onChange={(e) => setRefundCredits(e.target.value)}
                                min="0"
                                max={selectedTicket.credits_used}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                placeholder="Enter credits to refund"
                              />
                            </div>

                            <div className="flex gap-3">
                              <button
                                onClick={() => handleResolveTicket(selectedTicket.id, 'resolved')}
                                disabled={loading}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50"
                              >
                                Resolve
                              </button>
                              <button
                                onClick={() => handleResolveTicket(selectedTicket.id, 'refunded')}
                                disabled={loading || !refundCredits}
                                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50"
                              >
                                Refund & Resolve
                              </button>
                              <button
                                onClick={() => handleResolveTicket(selectedTicket.id, 'rejected')}
                                disabled={loading}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-4 border-t border-zinc-800">
                            <p className="text-sm text-zinc-400">
                              Resolved by: {selectedTicket.resolved_by ? 'Admin' : 'N/A'}
                              {selectedTicket.resolved_at && ` on ${new Date(selectedTicket.resolved_at).toLocaleString()}`}
                            </p>
                            {selectedTicket.credits_refunded > 0 && (
                              <p className="text-sm text-purple-400 mt-1">
                                Credits Refunded: {selectedTicket.credits_refunded}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && userDetails && (
        <div className="fixed inset-0 z-[101] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 w-full max-w-5xl h-[90vh] rounded-2xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
              <div>
                <h2 className="text-xl font-bold text-white">User Details</h2>
                <p className="text-sm text-zinc-400 mt-1">{userDetails.profile.email}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserDetails(null);
                  setUserTransactions([]);
                  setUserHistory([]);
                  setUserTickets([]);
                }}
                className="text-zinc-500 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-800 bg-zinc-950/50">
              {(['overview', 'transactions', 'history', 'support'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setUserDetailsTab(tab)}
                  className={`px-6 py-3 text-sm font-semibold transition capitalize ${
                    userDetailsTab === tab
                      ? 'text-indigo-400 border-b-2 border-indigo-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {loadingUserDetails ? (
                <div className="text-center py-12 text-zinc-500">Loading user details...</div>
              ) : userDetailsTab === 'overview' ? (
                <div className="space-y-6">
                  {/* Profile Section */}
                  <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700">
                    <h3 className="text-lg font-bold text-white mb-4">Profile Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-zinc-500">Email</label>
                        <p className="text-white font-semibold">{userDetails.profile.email}</p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">User ID</label>
                        <p className="text-white font-mono text-xs">{userDetails.profile.id}</p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Age</label>
                        <p className="text-white">{userDetails.profile.age || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Height</label>
                        <p className="text-white">{userDetails.profile.height || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Weight</label>
                        <p className="text-white">{userDetails.profile.weight || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Account Created</label>
                        <p className="text-white">{new Date(userDetails.profile.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Credits Section */}
                  <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700">
                    <h3 className="text-lg font-bold text-white mb-4">Credits</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-zinc-500">Current Balance</label>
                        <p className="text-2xl font-bold text-white">{userDetails.credits.current}</p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Total Earned</label>
                        <p className="text-2xl font-bold text-green-400">{userDetails.credits.total_earned}</p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Total Spent</label>
                        <p className="text-2xl font-bold text-red-400">{userDetails.credits.total_spent}</p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Net Credits</label>
                        <p className={`text-2xl font-bold ${userDetails.credits.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {userDetails.credits.net}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Activity Section */}
                  <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700">
                    <h3 className="text-lg font-bold text-white mb-4">Activity & Time</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-zinc-500">Account Age</label>
                        <p className="text-white font-semibold">{userDetails.activity.account_age_days} days</p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Last Activity</label>
                        <p className="text-white">
                          {userDetails.activity.last_activity 
                            ? new Date(userDetails.activity.last_activity).toLocaleString()
                            : 'Never'}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Photos Generated</label>
                        <p className="text-white font-semibold">{userDetails.activity.photos_generated}</p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Transactions</label>
                        <p className="text-white font-semibold">{userDetails.activity.transactions_count}</p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Support Tickets</label>
                        <p className="text-white font-semibold">{userDetails.activity.support_tickets_count}</p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">5-Star Ratings Given</label>
                        <p className="text-yellow-400 font-semibold flex items-center gap-1">
                          ⭐ {userDetails.activity.five_star_ratings_count}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : userDetailsTab === 'transactions' ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white mb-4">Transaction History</h3>
                  {userTransactions.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500">No transactions found</div>
                  ) : (
                    <div className="space-y-2">
                      {userTransactions.map((tx) => (
                        <div key={tx.id} className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white font-semibold">{tx.package_name || 'Unknown Package'}</p>
                              <p className="text-xs text-zinc-400 mt-1">
                                {new Date(tx.date).toLocaleString()} • Payment ID: {tx.payment_id.substring(0, 12)}...
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-bold">₹{tx.amount}</p>
                              <p className="text-xs text-green-400">+{tx.credits} credits</p>
                              <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
                                tx.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                                tx.status === 'failed' ? 'bg-red-900/30 text-red-400' :
                                'bg-yellow-900/30 text-yellow-400'
                              }`}>
                                {tx.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : userDetailsTab === 'history' ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white mb-4">Generated Images ({userHistory.length})</h3>
                  {userHistory.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500">No images generated</div>
                  ) : (
                    <div className="grid grid-cols-4 gap-4">
                      {userHistory.map((item) => (
                        <div key={item.id} className="bg-zinc-800/50 rounded-lg border border-zinc-700 overflow-hidden">
                          <img src={item.url} alt={item.style} className="w-full h-32 object-cover" />
                          <div className="p-2">
                            <p className="text-xs text-white font-semibold truncate">{item.style}</p>
                            <p className="text-xs text-zinc-400">{new Date(item.date).toLocaleDateString()}</p>
                            {item.rating > 0 && (
                              <p className="text-xs text-yellow-400 mt-1">⭐ {item.rating}/5</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : userDetailsTab === 'support' ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white mb-4">Support Tickets ({userTickets.length})</h3>
                  {userTickets.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500">No support tickets</div>
                  ) : (
                    <div className="space-y-2">
                      {userTickets.map((ticket) => (
                        <div key={ticket.id} className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-mono text-sm text-indigo-400">{ticket.ticket_number}</span>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  ticket.status === 'pending' ? 'bg-yellow-900/30 text-yellow-400' :
                                  ticket.status === 'in_review' ? 'bg-blue-900/30 text-blue-400' :
                                  ticket.status === 'resolved' ? 'bg-green-900/30 text-green-400' :
                                  ticket.status === 'refunded' ? 'bg-purple-900/30 text-purple-400' :
                                  'bg-red-900/30 text-red-400'
                                }`}>
                                  {ticket.status.toUpperCase()}
                                </span>
                              </div>
                              <h4 className="text-white font-semibold mb-1">{ticket.subject}</h4>
                              <p className="text-zinc-400 text-sm line-clamp-2">{ticket.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                                <span>Credits: {ticket.credits_used}</span>
                                <span>{new Date(ticket.created_at).toLocaleString()}</span>
                                {ticket.credits_refunded > 0 && (
                                  <span className="text-purple-400">Refunded: {ticket.credits_refunded} credits</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
