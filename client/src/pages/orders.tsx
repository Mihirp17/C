import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useOrders } from "@/hooks/use-orders";
import { OrderItem } from "@/components/orders/order-item";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSocket } from "@/hooks/use-socket";
import { calculateTimeAgo } from "@/lib/utils";

export default function Orders() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId;
  const { orders, activeOrders, isLoading, updateOrderStatus } = useOrders(restaurantId!);
  const [activeTab, setActiveTab] = useState<string>("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Connect to WebSocket for real-time updates
  const { addEventListener } = useSocket(restaurantId);
  
  // Listen for new orders
  useEffect(() => {
    const handleNewOrder = (orderData: any) => {
      // Play notification sound
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log('Error playing notification sound', e));
      
      // Show desktop notification if browser supports it
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Order Received', {
          body: `Order from ${orderData.customerName} at Table ${orderData.tableId}`,
          icon: '/logo.png'
        });
      }
    };
    
    // Register event listener
    addEventListener('new-order-received', handleNewOrder);
    
    // Request notification permission
    if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
    
    return () => {
      // Cleanup happens in the useSocket hook
    };
  }, [addEventListener]);

  // Filter orders based on search term
  useEffect(() => {
    if (activeTab === "active" && activeOrders) {
      setFilteredOrders(
        activeOrders.filter(order => 
          order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.id.toString().includes(searchTerm.toLowerCase())
        )
      );
    } else if (orders) {
      setFilteredOrders(
        orders.filter(order => 
          order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.id.toString().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [searchTerm, activeTab, orders, activeOrders]);

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order);
    setIsDetailDialogOpen(true);
  };

  const handleUpdateStatus = (orderId: number, status: any) => {
    updateOrderStatus({ orderId, status });
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({
        ...selectedOrder,
        status
      });
    }
  };

  const getStatusOptions = (currentStatus: string) => {
    const allStatuses: any = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['served', 'cancelled'],
      'served': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    };
    
    return allStatuses[currentStatus] || [];
  };

  return (
    <Layout
      title="Orders"
      description="Manage and track customer orders"
      requireAuth
      allowedRoles={['restaurant']}
    >
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative">
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
            <span className="absolute left-3 top-2.5 text-gray-400 material-icons">search</span>
          </div>
          <div>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="active">Active Orders</TabsTrigger>
                <TabsTrigger value="all">All Orders</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {activeTab === "active" ? "Active Orders" : "All Orders"}
            </h3>
            {activeTab === "active" && activeOrders && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-brand dark:bg-red-900/30">
                {activeOrders.length} Active
              </span>
            )}
          </div>
          
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Loading orders...</p>
              </div>
            ) : filteredOrders && filteredOrders.length > 0 ? (
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
                  {filteredOrders.map(order => (
                    <tr key={order.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-300">#{order.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{order.customerName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">Table {order.tableId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{order.items?.length || 0} items</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${parseFloat(order.total).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <OrderItem.StatusBadge status={order.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {calculateTimeAgo(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          className="text-brand hover:text-red-800 dark:hover:text-red-400"
                          onClick={() => handleViewOrder(order)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  {activeTab === "active"
                    ? "No active orders found"
                    : "No orders found"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order Details #{selectedOrder?.id}</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Customer</span>
                <span className="font-medium">{selectedOrder.customerName}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Table</span>
                <span className="font-medium">Table {selectedOrder.tableId}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
                <OrderItem.StatusBadge status={selectedOrder.status} />
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Time</span>
                <span className="font-medium">{calculateTimeAgo(selectedOrder.createdAt)}</span>
              </div>
              
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <h4 className="font-medium mb-2">Order Items</h4>
                <ul className="space-y-2">
                  {selectedOrder.items?.map((item: any) => (
                    <li key={item.id} className="flex justify-between">
                      <div className="flex-1">
                        <span className="font-medium">{item.quantity}x {item.menuItem?.name || `Item #${item.menuItemId}`}</span>
                        {item.menuItem?.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-[200px]">
                            {item.menuItem.description}
                          </p>
                        )}
                      </div>
                      <span className="ml-4 whitespace-nowrap">${parseFloat(item.price).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <span className="font-medium">Total</span>
                <span className="font-bold">${parseFloat(selectedOrder.total).toFixed(2)}</span>
              </div>
              
              {getStatusOptions(selectedOrder.status).length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <h4 className="font-medium mb-2">Update Status</h4>
                  <div className="flex space-x-2">
                    {getStatusOptions(selectedOrder.status).map((status: string) => (
                      <Button
                        key={status}
                        onClick={() => handleUpdateStatus(selectedOrder.id, status)}
                        className={
                          status === 'cancelled'
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : status === 'completed'
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-brand hover:bg-red-700 text-white'
                        }
                        size="sm"
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDetailDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
