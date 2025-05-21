import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { getRelativeDateRange } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

// Define the type of analytics data
interface AnalyticsData {
  orderCount: number;
  revenue: number;
  averageOrderValue: number;
  popularItems: Array<{
    id: number;
    name: string;
    count: number;
    price: string;
  }>;
}

export default function Analytics() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId;
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Define colors for charts
  const COLORS = ['#e53e3e', '#dd6b20', '#38a169', '#3182ce', '#805ad5', '#d53f8c'];

  useEffect(() => {
    const fetchAnalyticsData = async () => {
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
        
        // Fetch popular items
        const popularItemsResponse = await fetch(`/api/restaurants/${restaurantId}/analytics/popular-items?limit=10`, {
          credentials: 'include'
        });
        const popularItemsData = await popularItemsResponse.json();
        
        setAnalyticsData({
          orderCount: orderCountData.orderCount || 0,
          revenue: revenueData.revenue || 0,
          averageOrderValue: avgOrderData.averageOrderValue || 0,
          popularItems: popularItemsData || []
        });
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [restaurantId, dateRange]);

  // Prepare data for popular items chart
  const popularItemsChartData = analyticsData?.popularItems.map(item => ({
    name: item.name || `Item #${item.id}`,
    value: item.count
  })) || [];

  // Prepare data for revenue by item chart
  const revenueByItemData = analyticsData?.popularItems.map(item => ({
    name: item.name || `Item #${item.id}`,
    revenue: parseFloat(item.price) * item.count
  })) || [];

  return (
    <Layout
      title="Analytics"
      description="View performance metrics for your restaurant"
      requireAuth
      allowedRoles={['restaurant']}
    >
      <div className="space-y-6">
        {/* Date Range Selector */}
        <div className="flex justify-end">
          <Select
            value={dateRange}
            onValueChange={(value: any) => setDateRange(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Total Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLoading ? "Loading..." : analyticsData?.orderCount}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {dateRange === 'today' ? 'Today' : 
                 dateRange === 'week' ? 'Past 7 days' : 
                 dateRange === 'month' ? 'Past 30 days' : 'Past year'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLoading ? "Loading..." : formatCurrency(analyticsData?.revenue || 0)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {dateRange === 'today' ? 'Today' : 
                 dateRange === 'week' ? 'Past 7 days' : 
                 dateRange === 'month' ? 'Past 30 days' : 'Past year'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Average Order Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLoading ? "Loading..." : formatCurrency(analyticsData?.averageOrderValue || 0)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {dateRange === 'today' ? 'Today' : 
                 dateRange === 'week' ? 'Past 7 days' : 
                 dateRange === 'month' ? 'Past 30 days' : 'Past year'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Popular Items Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Popular Items</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-80">
                  <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
                </div>
              ) : popularItemsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={popularItemsChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {popularItemsChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} orders`, 'Count']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue by Item Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Item</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-80">
                  <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
                </div>
              ) : revenueByItemData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={revenueByItemData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 60,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                    <Bar dataKey="revenue" fill="#e53e3e" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Popular Items Table */}
        <Card>
          <CardHeader>
            <CardTitle>Popular Menu Items</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
              </div>
            ) : analyticsData?.popularItems && analyticsData.popularItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Orders</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit Price</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {analyticsData.popularItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{item.name || `Item #${item.id}`}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{item.count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(parseFloat(item.price))}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(parseFloat(item.price) * item.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
