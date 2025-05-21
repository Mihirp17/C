import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { StatsCard } from "@/components/dashboard/stats-card";
import { LiveOrders } from "@/components/dashboard/live-orders";
import { TablesOverview } from "@/components/dashboard/tables-overview";
import { PopularItems } from "@/components/dashboard/popular-items";
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

export default function Dashboard() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId;
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');
  const [stats, setStats] = useState({
    orderCount: 0,
    revenue: 0,
    averageOrderValue: 0,
    activeTables: 0,
    totalTables: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  // Connect to WebSocket for real-time updates
  useSocket(restaurantId);

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
            <Button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand">
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
    </Layout>
  );
}
