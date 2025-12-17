import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  Notification
} from '../services/userService';

interface NotificationCenterProps {
  user: User;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ user, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [user.id]);

  const loadNotifications = async () => {
    try {
      const [notifs, count] = await Promise.all([
        getUserNotifications(user.id),
        getUnreadNotificationCount(user.id)
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(user.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'credit_refund':
        return '💰';
      case 'ticket_resolved':
        return '✅';
      case 'ticket_updated':
        return '📝';
      case 'credit_gifted':
        return '🎁';
      default:
        return '🔔';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">Notifications</h2>
            {unreadCount > 0 && (
              <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition"
              >
                Mark all as read
              </button>
            )}
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-zinc-400 py-8">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center text-zinc-400 py-8">
              No notifications yet
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 rounded-lg border transition cursor-pointer ${
                    notif.is_read
                      ? 'bg-zinc-800/50 border-zinc-800'
                      : 'bg-indigo-500/10 border-indigo-500/30'
                  }`}
                  onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getNotificationIcon(notif.type)}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{notif.title}</h3>
                        {!notif.is_read && (
                          <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400">{notif.message}</p>
                      {notif.metadata?.credits_refunded && (
                        <p className="text-sm text-green-400 mt-1">
                          +{notif.metadata.credits_refunded} credits added to your account
                        </p>
                      )}
                      <p className="text-xs text-zinc-500 mt-2">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

