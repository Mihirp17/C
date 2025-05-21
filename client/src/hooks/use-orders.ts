import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useState, useEffect } from 'react';
import { addEventListener, removeEventListener, sendMessage } from '@/lib/socket';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'served' | 'completed' | 'cancelled';

export interface OrderItem {
  id: number;
  quantity: number;
  price: string;
  orderId: number;
  menuItemId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: number;
  customerName: string;
  status: OrderStatus;
  total: string;
  restaurantId: number;
  tableId: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

// Hook to fetch all orders for a restaurant
export function useOrders(restaurantId: number) {
  const queryClient = useQueryClient();
  
  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    const handleOrderStatusUpdated = (data: any) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/orders`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/active-orders`]
      });
    };
    
    const handleNewOrder = (data: any) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/orders`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/active-orders`]
      });
    };
    
    addEventListener('order-status-updated', handleOrderStatusUpdated);
    addEventListener('new-order-received', handleNewOrder);
    
    return () => {
      removeEventListener('order-status-updated', handleOrderStatusUpdated);
      removeEventListener('new-order-received', handleNewOrder);
    };
  }, [restaurantId, queryClient]);
  
  const { data: orders, isLoading, error } = useQuery({
    queryKey: [`/api/restaurants/${restaurantId}/orders`],
    enabled: !!restaurantId
  });
  
  const { data: activeOrders, isLoading: isLoadingActive } = useQuery({
    queryKey: [`/api/restaurants/${restaurantId}/active-orders`],
    enabled: !!restaurantId
  });
  
  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => {
      const response = await apiRequest('POST', `/api/restaurants/${restaurantId}/orders`, order);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/orders`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/active-orders`]
      });
      
      // Notify via WebSocket about new order
      sendMessage({
        type: 'new-order',
        payload: {
          restaurantId
        }
      });
    }
  });
  
  // Update order status mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: OrderStatus }) => {
      const response = await apiRequest('PUT', `/api/restaurants/${restaurantId}/orders/${orderId}`, { status });
      return response.json();
    },
    onSuccess: (_, { orderId, status }) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/orders`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/active-orders`]
      });
      
      // Notify via WebSocket about order status update
      sendMessage({
        type: 'update-order-status',
        payload: {
          orderId,
          status,
          restaurantId
        }
      });
    }
  });
  
  return {
    orders,
    activeOrders,
    isLoading: isLoading || isLoadingActive,
    error,
    createOrder: createOrderMutation.mutate,
    updateOrderStatus: updateOrderStatusMutation.mutate,
    isCreating: createOrderMutation.isPending,
    isUpdating: updateOrderStatusMutation.isPending
  };
}

// Hook to fetch a single order
export function useOrder(restaurantId: number, orderId: number) {
  const { orders } = useOrders(restaurantId);
  
  return {
    order: orders?.find(order => order.id === orderId),
    isLoading: !orders
  };
}
