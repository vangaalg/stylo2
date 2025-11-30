/**
 * Simple performance logging utility to track operation durations
 * and help diagnose latency issues.
 */

export interface LogEntry {
  id: string;
  type: 'start' | 'end' | 'info' | 'error';
  message: string;
  timestamp: number;
  duration?: number;
  data?: any;
}

type Listener = (log: LogEntry) => void;

export const perfLogger = {
  timers: new Map<string, number>(),
  logs: [] as LogEntry[],
  listeners: [] as Listener[],

  /**
   * Subscribe to log updates
   */
  subscribe: (listener: Listener) => {
    perfLogger.listeners.push(listener);
    return () => {
      perfLogger.listeners = perfLogger.listeners.filter(l => l !== listener);
    };
  },

  /**
   * Internal helper to emit logs
   */
  emit: (entry: LogEntry) => {
    perfLogger.logs.unshift(entry); // Add to beginning
    // Keep only last 100 logs to prevent memory issues
    if (perfLogger.logs.length > 100) perfLogger.logs.pop();
    
    perfLogger.listeners.forEach(l => l(entry));
  },

  /**
   * Start a timer with a unique ID
   */
  start: (id: string) => {
    perfLogger.timers.set(id, performance.now());
    console.log(`%c[START] ${id}`, 'color: #6366f1; font-weight: bold'); // Indigo
    
    perfLogger.emit({
      id,
      type: 'start',
      message: `Started: ${id}`,
      timestamp: Date.now()
    });
  },

  /**
   * End a timer and log the duration
   */
  end: (id: string) => {
    const startTime = perfLogger.timers.get(id);
    if (startTime) {
      const duration = parseFloat((performance.now() - startTime).toFixed(2));
      const color = duration > 5000 ? '#ef4444' : '#10b981'; // Red if > 5s, Green otherwise
      console.log(`%c[PERF] ${id}: ${duration}ms (${(duration/1000).toFixed(2)}s)`, `color: ${color}; font-weight: bold`);
      perfLogger.timers.delete(id);

      perfLogger.emit({
        id,
        type: 'end',
        message: `Completed: ${id}`,
        timestamp: Date.now(),
        duration
      });
    } else {
      console.warn(`[PERF] Timer ID "${id}" not found.`);
    }
  },

  /**
   * Log a general info message with distinct styling
   */
  log: (message: string, data?: any) => {
    if (data) {
      console.log(`%c[INFO] ${message}`, 'color: #3b82f6', data); // Blue
    } else {
      console.log(`%c[INFO] ${message}`, 'color: #3b82f6');
    }
    
    perfLogger.emit({
      id: 'info',
      type: 'info',
      message,
      timestamp: Date.now(),
      data
    });
  },
  
  /**
   * Log an error with distinct styling
   */
  error: (message: string, error?: any) => {
    console.log(`%c[ERROR] ${message}`, 'color: #f43f5e; font-weight: bold', error || ''); // Rose
    
    perfLogger.emit({
      id: 'error',
      type: 'error',
      message,
      timestamp: Date.now(),
      data: error
    });
  },

  /**
   * Get all stored logs
   */
  getLogs: () => perfLogger.logs
};
