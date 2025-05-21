import { useEffect } from 'react';
import { connectWebSocket, disconnectWebSocket, addEventListener, removeEventListener, sendMessage } from '@/lib/socket';

export function useSocket(restaurantId?: number, tableId?: number) {
  // Connect to WebSocket on mount and disconnect on unmount
  useEffect(() => {
    if (restaurantId) {
      connectWebSocket(restaurantId, tableId);
      
      return () => {
        disconnectWebSocket();
      };
    }
  }, [restaurantId, tableId]);
  
  // Return the socket methods
  return {
    addEventListener,
    removeEventListener,
    sendMessage
  };
}
