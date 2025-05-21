import { useEffect, useState } from "react";
import { useOrders } from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
import { getStatusColor, calculateTimeAgo } from "@/lib/utils";

interface LiveOrdersProps {
  restaurantId?: number;
}

export function LiveOrders({ restaurantId }: LiveOrdersProps) {
  const { activeOrders, updateOrderStatus, isLoading } = useOrders(restaurantId || 0);
  const [orders, setOrders] = useState<any[]>([]);

  // Update orders when activeOrders changes
  useEffect(() => {
    if (activeOrders) {
      setOrders(activeOrders);
    }
  }, [activeOrders]);

  // Handle order status update
  const handleUpdateStatus = (orderId: number, status: string) => {
    updateOrderStatus({ orderId, status });
  };

  // Get next status options based on current status
  const getNextStatus = (currentStatus: string): { label: string; value: string } | null => {
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
      
      <div className="overflow-x-auto">
        {orders && orders.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Table</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Items</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {orders.map((order) => {
                const statusColors = getStatusColor(order.status);
                const nextStatus = getNextStatus(order.status);
                
                return (
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-300">#{order.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{order.customerName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">Table {order.tableId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{order.items?.length || 0} items</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${parseFloat(order.total).toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors.bgClass} ${statusColors.textClass} ${statusColors.darkBgClass} ${statusColors.darkTextClass}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{calculateTimeAgo(order.createdAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {nextStatus && (
                          <Button
                            size="sm"
                            className="bg-brand hover:bg-red-700 text-white text-xs py-1 px-2 h-auto"
                            onClick={() => handleUpdateStatus(order.id, nextStatus.value)}
                          >
                            {nextStatus.label}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-brand hover:text-red-800 dark:hover:text-red-400 text-xs py-1 px-2 h-auto"
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-800 text-xs py-1 px-2 h-auto"
                          onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                        >
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No active orders</p>
          </div>
        )}
      </div>
    </div>
  );
}
