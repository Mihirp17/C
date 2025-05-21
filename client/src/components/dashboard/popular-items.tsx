import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

interface PopularItem {
  id: number;
  name: string;
  count: number;
  price: string;
}

interface PopularItemsProps {
  restaurantId?: number;
}

export function PopularItems({ restaurantId }: PopularItemsProps) {
  const { toast } = useToast();
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPopularItems = async () => {
      if (!restaurantId) return;

      try {
        const response = await fetch(`/api/restaurants/${restaurantId}/analytics/popular-items?limit=4`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setPopularItems(data);
        } else {
          throw new Error('Failed to fetch popular items');
        }
      } catch (error) {
        console.error('Error fetching popular items:', error);
        toast({
          title: "Error",
          description: "Failed to load popular menu items",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPopularItems();
  }, [restaurantId, toast]);

  // Get icon based on item name
  const getItemIcon = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('burger')) return 'lunch_dining';
    if (lowerName.includes('pizza')) return 'local_pizza';
    if (lowerName.includes('pasta') || lowerName.includes('noodle')) return 'ramen_dining';
    if (lowerName.includes('ice') || lowerName.includes('sundae')) return 'icecream';
    return 'restaurant_menu';
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Popular Menu Items</h3>
          <div className="animate-pulse w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="p-4 space-y-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="animate-pulse flex items-center">
              <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
              <div className="ml-3 flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Popular Menu Items</h3>
        <Link href="/menu-management">
          <Button variant="link" className="text-sm text-brand hover:text-red-800 dark:hover:text-red-400 font-medium">
            View All
          </Button>
        </Link>
      </div>
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {popularItems && popularItems.length > 0 ? (
          popularItems.map((item) => (
            <li key={item.id} className="p-4 flex items-center">
              <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center">
                <span className="material-icons text-brand">{getItemIcon(item.name)}</span>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.count} orders this month</p>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formatCurrency(parseFloat(item.price))}
              </span>
            </li>
          ))
        ) : (
          <li className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">No order data available yet</p>
          </li>
        )}
      </ul>
    </div>
  );
}
