import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getUserSupportTickets } from '../services/userService';
import { SupportModal } from './SupportModal';

interface SupportSectionProps {
  user: User;
  onClose: () => void;
}

export const SupportSection: React.FC<SupportSectionProps> = ({ user, onClose }) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [user.id]);

  const loadTickets = async () => {
    try {
      const data = await getUserSupportTickets(user.id);
      setTickets(data);
    } catch (err) {
      console.error('Error loading tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'text-green-400 bg-green-400/10';
      case 'in_review':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'rejected':
        return 'text-red-400 bg-red-400/10';
      case 'refunded':
        return 'text-indigo-400 bg-indigo-400/10';
      default:
        return 'text-zinc-400 bg-zinc-400/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return '✅';
      case 'in_review':
        return '⏳';
      case 'rejected':
        return '❌';
      case 'refunded':
        return '💰';
      default:
        return '📝';
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-4xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-800">
            <div>
              <h2 className="text-xl font-bold text-white">Support Tickets</h2>
              <p className="text-sm text-zinc-400 mt-1">View and manage your support requests</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewTicket(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-500 transition"
              >
                + New Ticket
              </button>
              <button
                onClick={onClose}
                className="text-zinc-400 hover:text-white transition text-xl ml-2"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tickets List */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center text-zinc-400 py-8">Loading tickets...</div>
            ) : tickets.length === 0 ? (
              <div className="text-center text-zinc-400 py-8">
                <p className="mb-4">No support tickets yet</p>
                <button
                  onClick={() => setShowNewTicket(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-500"
                >
                  Create Your First Ticket
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="bg-zinc-800 rounded-lg p-5 border border-zinc-700 hover:border-zinc-600 transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-white text-lg">{ticket.subject}</h3>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(ticket.status)}`}>
                            {getStatusIcon(ticket.status)} {ticket.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mb-2">
                          Ticket: <span className="text-indigo-400 font-mono">{ticket.ticket_number}</span>
                        </p>
                      </div>
                    </div>
                    
                    <p className="text-sm text-zinc-300 mb-4">{ticket.description}</p>
                    
                    {ticket.related_image_urls && ticket.related_image_urls.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-zinc-400 mb-2">Related Images ({ticket.related_image_urls.length}):</p>
                        <div className="flex gap-2 flex-wrap">
                          {ticket.related_image_urls.slice(0, 3).map((url: string, idx: number) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`Related ${idx + 1}`}
                              className="w-16 h-16 object-cover rounded border border-zinc-700"
                            />
                          ))}
                          {ticket.related_image_urls.length > 3 && (
                            <div className="w-16 h-16 bg-zinc-700 rounded border border-zinc-600 flex items-center justify-center text-xs text-zinc-400">
                              +{ticket.related_image_urls.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {ticket.admin_notes && (
                      <div className="bg-zinc-900 rounded p-4 mb-4 border-l-4 border-indigo-500">
                        <p className="text-xs text-indigo-400 mb-2 font-semibold">Admin Response:</p>
                        <p className="text-sm text-zinc-300">{ticket.admin_notes}</p>
                      </div>
                    )}
                    
                    {ticket.credits_refunded > 0 && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded p-3 mb-4">
                        <p className="text-sm text-green-400 font-semibold">
                          💰 {ticket.credits_refunded} credits refunded to your account
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-zinc-500 pt-3 border-t border-zinc-700">
                      <span>Created: {new Date(ticket.created_at).toLocaleString()}</span>
                      {ticket.resolved_at && (
                        <span>Resolved: {new Date(ticket.resolved_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showNewTicket && (
        <SupportModal
          onClose={() => {
            setShowNewTicket(false);
            loadTickets();
          }}
          user={user}
          relatedImageUrls={[]}
          creditsUsed={0}
          qualityMode="fast"
        />
      )}
    </>
  );
};

