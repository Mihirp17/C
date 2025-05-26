// Socket.io client implementation
export interface SocketMessage {
  type: string;
  payload: Record<string, unknown>;
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners: { [key: string]: Function[] } = {};

export const connectWebSocket = (restaurantId?: number, tableId?: number) => {
  if (socket) {
    socket.close();
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('WebSocket connected');
    
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
          callback(message.payload);
        });
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  socket.onclose = () => {
    console.log('WebSocket disconnected, reconnecting...');
    
    // Clean up any existing reconnect timer
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    
    // Reconnect after a delay
    reconnectTimer = setTimeout(() => {
      connectWebSocket(restaurantId, tableId);
    }, 3000);
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    socket?.close();
  };
};

export const sendMessage = (message: SocketMessage) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    return true;
  }
  return false;
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
    socket.close();
    socket = null;
  }
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // Clear all listeners
  Object.keys(listeners).forEach(key => {
    listeners[key] = [];
  });
};
