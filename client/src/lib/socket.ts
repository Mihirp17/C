// Socket.io client implementation
export interface SocketMessage {
  type: string;
  payload: Record<string, unknown>;
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 3000;
const listeners: { [key: string]: Function[] } = {};

export const connectWebSocket = (restaurantId?: number, tableId?: number) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('WebSocket already connected');
    return;
  }

  if (socket) {
    socket.close();
  }

  // Determine the WebSocket URL based on the current page protocol and host
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  let wsHost = window.location.host;
  
  // For development, handle different scenarios
  if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
    // If accessing via HTTPS on port 443, use WSS
    if (window.location.protocol === 'https:' && window.location.port === '') {
      wsHost = window.location.hostname; // Will default to port 443 for WSS
    } else if (window.location.port === '443') {
      wsHost = `${window.location.hostname}:443`;
    } else {
      // For regular HTTP development, use the same host:port
      wsHost = window.location.host;
    }
  }
  
  const wsUrl = `${protocol}//${wsHost}/ws`;
  
  console.log(`Attempting WebSocket connection to: ${wsUrl}`);
  
  try {
    socket = new WebSocket(wsUrl);
  } catch (error) {
    console.error('Failed to create WebSocket:', error);
    scheduleReconnect(restaurantId, tableId);
    return;
  }

  socket.onopen = () => {
    console.log('WebSocket connected successfully');
    reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    
    // Register based on context
    if (restaurantId) {
      sendMessage({
        type: 'register-restaurant',
        payload: { restaurantId }
      });
      
      if (tableId) {
        sendMessage({
          type: 'register-table',
          payload: { restaurantId, tableId }
        });
      }
    }
  };

  socket.onmessage = (event) => {
    try {
      const message: SocketMessage = JSON.parse(event.data);
      
      // Trigger event listeners for this message type
      if (listeners[message.type]) {
        listeners[message.type].forEach(callback => {
          try {
            callback(message.payload);
          } catch (error) {
            console.error(`Error in listener for ${message.type}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  socket.onclose = (event) => {
    console.log(`WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`);
    
    // Only attempt to reconnect if it wasn't a normal closure
    if (event.code !== 1000 && event.code !== 1001) {
      scheduleReconnect(restaurantId, tableId);
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    // The socket will trigger onclose after onerror, so reconnection will be handled there
  };
};

const scheduleReconnect = (restaurantId?: number, tableId?: number) => {
  // Clean up any existing reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('Max reconnection attempts reached. Please refresh the page.');
    return;
  }
  
  reconnectAttempts++;
  const delay = Math.min(RECONNECT_DELAY * reconnectAttempts, 30000); // Max 30 seconds
  
  console.log(`Scheduling reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);
  
  reconnectTimer = setTimeout(() => {
    connectWebSocket(restaurantId, tableId);
  }, delay);
};

export const sendMessage = (message: SocketMessage) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn('WebSocket is not connected. Message not sent:', message);
    return false;
  }
  
  try {
    socket.send(JSON.stringify(message));
    return true;
  } catch (error) {
    console.error('Error sending WebSocket message:', error);
    return false;
  }
};

export const addEventListener = (event: string, callback: Function) => {
  if (!listeners[event]) {
    listeners[event] = [];
  }
  listeners[event].push(callback);
};

export const removeEventListener = (event: string, callback: Function) => {
  if (listeners[event]) {
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  }
};

export const disconnectWebSocket = () => {
  if (socket) {
    socket.close(1000, 'Client disconnect'); // Normal closure
    socket = null;
  }
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  reconnectAttempts = 0;
  
  // Clear all listeners
  Object.keys(listeners).forEach(key => {
    listeners[key] = [];
  });
};

// Add a method to check connection status
export const isConnected = () => {
  return socket && socket.readyState === WebSocket.OPEN;
};
