import { useEffect, useState } from "react";
import { useOrders } from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
import { getStatusColor, calculateTimeAgo } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface LiveOrdersProps {
  restaurantId?: number;
}

export function LiveOrders({ restaurantId }: LiveOrdersProps) {
  const { activeOrders, updateOrderStatus, isLoading } = useOrders(restaurantId || 0) as { activeOrders: any[]; updateOrderStatus: (args: { orderId: number; status: 'pending' | 'confirmed' | 'preparing' | 'served' | 'completed' | 'cancelled' }) => void; isLoading: boolean };
  const [orders, setOrders] = useState<any[]>([]);
  const { toast } = useToast();

  // Update orders when activeOrders changes
  useEffect(() => {
    if (Array.isArray(activeOrders)) {
      setOrders(activeOrders);
    }
  }, [activeOrders]);

  // Handle order status update
  const handleUpdateStatus = async (
    orderId: number,
    status: 'pending' | 'confirmed' | 'preparing' | 'served' | 'completed' | 'cancelled'
  ) => {
    try {
      await updateOrderStatus({ orderId, status });
      toast({
        title: "Success",
        description: `Order #${orderId} status updated to ${status}.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      toast({
        title: "Error",
        description: "Failed to update order status. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Get next status options based on current status
  const getNextStatus = (currentStatus: string): { label: string; value: 'pending' | 'confirmed' | 'preparing' | 'served' | 'completed' | 'cancelled' } | null => {
    switch (currentStatus) {
      case 'pending':
        return { label: 'Confirm', value: 'confirmed' };
      case 'confirmed':
        return { label: 'Prepare', value: 'preparing' };
      case 'preparing':
        return { label: 'Serve', value: 'served' };
      case 'served':
        return { label: 'Complete', value: 'completed' };
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Live Orders</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            Loading...
          </span>
        </div>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Live Orders</h3>
        {orders && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-brand dark:bg-red-900/30">
            {orders.length} Active
          </span>
        )}
      </div>
      
      <div className="p-4">
        {orders && orders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => {
              const statusColors = getStatusColor(order.status);
              const nextStatus = getNextStatus(order.status);
              
              return (
                <div 
                  key={order.id} 
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 ${
                    order.status === 'pending' 
                      ? 'border-amber-500' 
                      : order.status === 'confirmed' 
                      ? 'border-blue-500' 
                      : order.status === 'preparing' 
                      ? 'border-purple-500' 
                      : order.status === 'served' 
                      ? 'border-green-500' 
                      : 'border-gray-300'
                  } overflow-hidden`}
                >
                  <div className="p-4">
                    <div className="flex justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Order #{order.id}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{calculateTimeAgo(order.createdAt)}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors.bgClass} ${statusColors.textClass} ${statusColors.darkBgClass} ${statusColors.darkTextClass}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                    
                    <div className="mb-3">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Customer:</span>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">{order.customerName}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Table:</span>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">Table {order.tableId}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Items:</span>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">{order.items?.length || 0} items</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total:</span>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">${parseFloat(order.total).toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {order.items && order.items.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded p-2 max-h-32 overflow-y-auto">
                          <ul className="space-y-1">
                            {order.items.map((item: any, index: number) => (
                              <li key={index} className="text-xs">
                                <span className="font-medium">{item.quantity}x</span> {item.menuItem?.name || `Item #${item.menuItemId}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="flex space-x-2">
                        {nextStatus && (
                          <Button
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 h-auto"
                            onClick={() => handleUpdateStatus(order.id, nextStatus.value)}
                          >
                            {nextStatus.label}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="text-red-600 hover:text-red-800 text-xs py-1 px-2 h-auto"
                          onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No active orders</p>
          </div>
        )}
      </div>
    </div>
  );
}
