import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { storage } from './storage';

// Define message types
export interface SocketMessage {
  type: string;
  payload: Record<string, unknown>;
}

export interface OrderStatusUpdate {
  orderId: number;
  status: string;
  restaurantId: number;
}

export interface NewOrder {
  restaurantId: number;
  order: any;
}

export interface WaiterRequest {
  restaurantId: number;
  tableId: number;
  customerName: string;
  timestamp: string;
}

// Client tracking
type SocketClient = {
  socket: WebSocket;
  restaurantId?: number;
  tableId?: number;
};

let clients: SocketClient[] = [];

export const setupWebSocketServer = (server: HttpServer) => {
  // Create a WebSocket server on a distinct path
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket: WebSocket) => {
    // Add new client to the list
    const client: SocketClient = { socket };
    clients.push(client);

    // Handle messages from client
    socket.on('message', async (data: string) => {
      try {
        const message: SocketMessage = JSON.parse(data);
        
        switch (message.type) {
          case 'register-restaurant':
            // Register this connection as belonging to a restaurant
            client.restaurantId = message.payload.restaurantId;
            break;
            
          case 'register-table':
            // Register this connection as belonging to a table
            client.restaurantId = message.payload.restaurantId;
            client.tableId = message.payload.tableId;
            break;
            
          case 'update-order-status':
            // Handle order status update
            const updateData: OrderStatusUpdate = message.payload;
            
            // Update in database
            await storage.updateOrder(updateData.orderId, { status: updateData.status });
            
            // Broadcast to all clients for this restaurant
            broadcastToRestaurant(updateData.restaurantId, {
              type: 'order-status-updated',
              payload: updateData
            });
            break;
            
          case 'new-order':
            // Handle new order creation
            const orderData: NewOrder = message.payload;
            
            // Broadcast to restaurant
            broadcastToRestaurant(orderData.restaurantId, {
              type: 'new-order-received',
              payload: orderData.order
            });
            break;
            
          case 'call-waiter':
            // Handle waiter request
            const waiterRequest: WaiterRequest = message.payload;
            
            // Broadcast to restaurant staff
            broadcastToRestaurant(waiterRequest.restaurantId, {
              type: 'waiter-requested',
              payload: waiterRequest
            });
            break;
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    // Handle client disconnection
    socket.on('close', () => {
      // Remove client from the list
      clients = clients.filter(c => c.socket !== socket);
    });
  });

  return wss;
};

// Helper function to send a message to all clients connected to a specific restaurant
const broadcastToRestaurant = (restaurantId: number, message: SocketMessage) => {
  clients.forEach(client => {
    if (
      client.restaurantId === restaurantId && 
      client.socket.readyState === WebSocket.OPEN
    ) {
      client.socket.send(JSON.stringify(message));
    }
  });
};

// Helper function to send a message to a specific table
export const sendToTable = (restaurantId: number, tableId: number, message: SocketMessage) => {
  clients.forEach(client => {
    if (
      client.restaurantId === restaurantId && 
      client.tableId === tableId && 
      client.socket.readyState === WebSocket.OPEN
    ) {
      client.socket.send(JSON.stringify(message));
    }
  });
};
