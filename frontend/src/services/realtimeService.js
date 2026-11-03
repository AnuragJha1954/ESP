// ============================================================================
// TRADOPAD REAL-TIME EVENT STREAM SERVICE (Zero-Polling Push Engine)
// Built with native Server-Sent Events (SSE) & Webhook Bridge
// ============================================================================

class RealtimeService {
  constructor() {
    this.eventSource = null;
    this.listeners = new Map(); // eventName -> Set of callbacks
    this.isConnected = false;
    this.reconnectTimer = null;
    this.retryDelay = 2000;
    this.currentAuthToken = null;
  }

  connect(authToken = null) {
    if (authToken) {
      this.currentAuthToken = authToken;
    }

    if (this.eventSource) {
      if (this.isConnected) return;
      this.disconnect();
    }

    const token = this.currentAuthToken || localStorage.getItem('token') || sessionStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const url = `${baseUrl}/api/realtime/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.retryDelay = 2000;
        this.notify('connection_change', { connected: true });
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        this.notify('connection_change', { connected: false });
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Auto-reconnect with exponential backoff up to 15s
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.retryDelay = Math.min(this.retryDelay * 1.5, 15000);
            this.connect();
          }, this.retryDelay);
        }
      };

      // Built-in named event stream listeners
      const events = [
        'connected',
        'kill_switch',
        'tokens_status',
        'device_readiness',
        'trade_event'
      ];

      events.forEach(evt => {
        this.eventSource.addEventListener(evt, (e) => {
          try {
            const data = JSON.parse(e.data);
            this.notify(evt, data);
          } catch (parseErr) {
            this.notify(evt, e.data);
          }
        });
      });

    } catch (err) {
      console.warn('[RealtimeService] EventSource failed to initialize:', err);
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
  }

  subscribe(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(callback);

    // Return cleanup function for useEffect
    return () => {
      if (this.listeners.has(eventName)) {
        this.listeners.get(eventName).delete(callback);
      }
    };
  }

  notify(eventName, data) {
    if (this.listeners.has(eventName)) {
      for (const cb of this.listeners.get(eventName)) {
        try {
          cb(data);
        } catch (e) {
          console.error(`[RealtimeService] Error executing listener for "${eventName}":`, e);
        }
      }
    }
  }
}

export const realtimeService = new RealtimeService();
