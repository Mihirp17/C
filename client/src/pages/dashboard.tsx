import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { StatsCard } from "@/components/dashboard/stats-card";
import { LiveOrders } from "@/components/dashboard/live-orders";
import { TablesOverview } from "@/components/dashboard/tables-overview";
import { PopularItems } from "@/components/dashboard/popular-items";
import { StaffOrderDialog } from "@/components/menu/staff-order-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getRelativeDateRange } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Toast, ToastProvider, ToastViewport } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useTables, Table } from "@/hooks/use-tables";

interface WaiterRequest {
  restaurantId: number;
  tableId: number;
  customerName: string;
  timestamp: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId;
  const { toast } = useToast();
  const { tables: rawTables = [], isLoading: isTablesLoading } = useTables(restaurantId!);
  const tables: Table[] = Array.isArray(rawTables) ? rawTables : [];
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');
  const [stats, setStats] = useState({
    orderCount: 0,
    revenue: 0,
    averageOrderValue: 0,
    activeTables: 0,
    totalTables: 0
  });
  const [waiterRequests, setWaiterRequests] = useState<WaiterRequest[]>([]);
  const [selectedWaiterRequest, setSelectedWaiterRequest] = useState<WaiterRequest | null>(null);
  const [isWaiterDialogOpen, setIsWaiterDialogOpen] = useState(false);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  // Connect to WebSocket for real-time updates
  const { addEventListener } = useSocket(restaurantId);
  
  // Listen for waiter requests
  useEffect(() => {
    const handleWaiterRequest = (request: WaiterRequest) => {
      // Add new request to the list
      setWaiterRequests(prev => [request, ...prev]);
      
      // Show notification
      toast({
        title: "Waiter Requested",
        description: `Table ${request.tableId}: ${request.customerName} needs assistance`,
        variant: "default"
      });
      
      // Play notification sound
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log('Error playing notification sound', e));
    };
    
    // Register event listener
    addEventListener('waiter-requested', handleWaiterRequest);
    
    // Cleanup
    return () => {
      // No need to remove event listener, this is handled by the useSocket hook cleanup
    };
  }, [addEventListener, toast]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!restaurantId) return;

      setIsLoading(true);
      try {
        const { startDate, endDate } = getRelativeDateRange(dateRange);
        
        // Fetch order count
        const orderCountResponse = await apiRequest('POST', 
          `/api/restaurants/${restaurantId}/analytics/orders`, 
          { startDate, endDate }
        );
        const orderCountData = await orderCountResponse.json();
        
        // Fetch revenue
        const revenueResponse = await apiRequest('POST', 
          `/api/restaurants/${restaurantId}/analytics/revenue`, 
          { startDate, endDate }
        );
        const revenueData = await revenueResponse.json();
        
        // Fetch average order value
        const avgOrderResponse = await apiRequest('POST', 
          `/api/restaurants/${restaurantId}/analytics/average-order`, 
          { startDate, endDate }
        );
        const avgOrderData = await avgOrderResponse.json();
        
        // Fetch tables
        const tablesResponse = await fetch(`/api/restaurants/${restaurantId}/tables`, {
          credentials: 'include'
        });
        const tablesData = await tablesResponse.json();
        
        setStats({
          orderCount: orderCountData.orderCount || 0,
          revenue: revenueData.revenue || 0,
          averageOrderValue: avgOrderData.averageOrderValue || 0,
          activeTables: tablesData.filter((table: any) => table.isOccupied).length,
          totalTables: tablesData.length
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [restaurantId, dateRange]);

  return (
    <Layout 
      title="Dashboard" 
      description="Overview of your restaurant performance"
      requireAuth
      allowedRoles={['restaurant']}
    >
      <div className="space-y-6">
        {/* Waiter Requests Alert - Only show if there are active requests */}
        {waiterRequests.length > 0 && (
          <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <span className="material-icons text-amber-500 mr-2">notifications_active</span>
            <AlertTitle className="text-amber-800 dark:text-amber-300">Waiter Assistance Needed</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              {waiterRequests.length} {waiterRequests.length === 1 ? 'table is' : 'tables are'} requesting assistance.
              <Button 
                variant="link" 
                className="text-amber-700 dark:text-amber-400 p-0 ml-2 underline" 
                onClick={() => {
                  setSelectedWaiterRequest(waiterRequests[0]);
                  setIsWaiterDialogOpen(true);
                }}
              >
                View Requests
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Stats Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div></div>
          <div className="mt-4 md:mt-0 flex space-x-3">
            <Select
              value={dateRange}
              onValueChange={(value: any) => setDateRange(value)}
            >
              <SelectTrigger className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm py-2 px-3 text-sm w-[140px]">
                <SelectValue placeholder="Select Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={() => setIsOrderDialogOpen(true)}
            >
              <span className="material-icons mr-2 text-sm">add</span>
              New Order
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Orders */}
          <StatsCard
            title="Total Orders"
            value={isLoading ? "Loading..." : stats.orderCount.toString()}
            icon="receipt"
            iconColor="text-brand"
            iconBgClass="bg-red-100 dark:bg-red-900/30"
            trend={{
              value: "12.5%",
              label: "from last period",
              isPositive: true
            }}
          />

          {/* Revenue */}
          <StatsCard
            title="Revenue"
            value={isLoading ? "Loading..." : formatCurrency(stats.revenue)}
            icon="payments"
            iconColor="text-success"
            iconBgClass="bg-green-100 dark:bg-green-900/30"
            trend={{
              value: "8.2%",
              label: "from last period",
              isPositive: true
            }}
          />

          {/* Avg Order Value */}
          <StatsCard
            title="Avg Order Value"
            value={isLoading ? "Loading..." : formatCurrency(stats.averageOrderValue)}
            icon="attach_money"
            iconColor="text-info"
            iconBgClass="bg-blue-100 dark:bg-blue-900/30"
            trend={{
              value: "2.3%",
              label: "from last period",
              isPositive: false
            }}
          />

          {/* Active Tables */}
          <StatsCard
            title="Active Tables"
            value={isLoading ? "Loading..." : `${stats.activeTables}/${stats.totalTables}`}
            icon="table_restaurant"
            iconColor="text-warning"
            iconBgClass="bg-orange-100 dark:bg-orange-900/30"
            trend={{
              value: stats.activeTables.toString(),
              label: "tables occupied",
              isPositive: true
            }}
          />
        </div>

        {/* Live Orders Section */}
        <LiveOrders restaurantId={restaurantId} />

        {/* Tables Overview and Menu Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TablesOverview restaurantId={restaurantId} />
          <PopularItems restaurantId={restaurantId} />
        </div>
      </div>

      {/* Waiter Request Details Dialog */}
      <Dialog open={isWaiterDialogOpen} onOpenChange={setIsWaiterDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Waiter Requests</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {waiterRequests.length > 0 ? (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {waiterRequests.map((request, index) => (
                  <div 
                    key={index} 
                    className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">Table {request.tableId}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Customer: {request.customerName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {new Date(request.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                        onClick={() => {
                          // Mark as completed
                          setWaiterRequests(prev => 
                            prev.filter((_, i) => i !== index)
                          );
                          
                          // If no more requests, close dialog
                          if (waiterRequests.length === 1) {
                            setIsWaiterDialogOpen(false);
                          }
                        }}
                      >
                        <span className="material-icons text-sm mr-1">check</span>
                        Complete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No active waiter requests</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              onClick={() => setIsWaiterDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Selection Dialog */}
      <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Order</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {isTablesLoading ? (
              <div className="text-center text-gray-500">Loading tables...</div>
            ) : (
              <>
                <label className="block mb-2 font-medium">Select a vacant table:</label>
                <select
                  className="w-full border rounded p-2 mb-4"
                  value={selectedTableId ?? ''}
                  onChange={e => setSelectedTableId(Number(e.target.value))}
                >
                  <option value="" disabled>Select table</option>
                  {tables.filter((t: Table) => !t.isOccupied).map((table: Table) => (
                    <option key={table.id} value={table.id}>
                      Table {table.number}
                    </option>
                  ))}
                </select>
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!selectedTableId}
                  onClick={() => {
                    // Close table selection and open order dialog
                    setIsOrderDialogOpen(false);
                    setShowOrderDialog(true);
                  }}
                >
                  Start Order
                </Button>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsOrderDialogOpen(false)} variant="outline">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Order Dialog */}
      <StaffOrderDialog
        restaurantId={restaurantId!}
        selectedTableId={selectedTableId!}
        isOpen={showOrderDialog}
        onOpenChange={setShowOrderDialog}
        onOrderPlaced={() => {
          // Reset state and refresh data
          setSelectedTableId(null);
          setShowOrderDialog(false);
        }}
      />
    </Layout>
  );
}
