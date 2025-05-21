import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price: string;
  image: string | null;
  category: string;
  isAvailable: boolean;
  restaurantId: number;
  createdAt: string;
  updatedAt: string;
}

export function useMenu(restaurantId: number) {
  const queryClient = useQueryClient();
  
  const { data: menuItems, isLoading, error } = useQuery({
    queryKey: [`/api/restaurants/${restaurantId}/menu-items`],
    enabled: !!restaurantId
  });
  
  // Create menu item mutation
  const createMenuItemMutation = useMutation({
    mutationFn: async (menuItem: Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>) => {
      const response = await apiRequest('POST', `/api/restaurants/${restaurantId}/menu-items`, menuItem);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/menu-items`]
      });
    }
  });
  
  // Update menu item mutation
  const updateMenuItemMutation = useMutation({
    mutationFn: async ({ menuItemId, data }: { menuItemId: number; data: Partial<MenuItem> }) => {
      const response = await apiRequest('PUT', `/api/restaurants/${restaurantId}/menu-items/${menuItemId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/menu-items`]
      });
    }
  });
  
  // Delete menu item mutation
  const deleteMenuItemMutation = useMutation({
    mutationFn: async (menuItemId: number) => {
      const response = await apiRequest('DELETE', `/api/restaurants/${restaurantId}/menu-items/${menuItemId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/menu-items`]
      });
    }
  });
  
  // Get menu items by category
  const getMenuItemsByCategory = (category: string) => {
    return menuItems?.filter(item => item.category === category) || [];
  };
  
  // Get all unique categories
  const getCategories = () => {
    if (!menuItems) return [];
    const categories = new Set(menuItems.map(item => item.category));
    return Array.from(categories);
  };
  
  return {
    menuItems,
    isLoading,
    error,
    createMenuItem: createMenuItemMutation.mutate,
    updateMenuItem: updateMenuItemMutation.mutate,
    deleteMenuItem: deleteMenuItemMutation.mutate,
    isCreating: createMenuItemMutation.isPending,
    isUpdating: updateMenuItemMutation.isPending,
    isDeleting: deleteMenuItemMutation.isPending,
    getMenuItemsByCategory,
    getCategories
  };
}

export function useMenuItem(restaurantId: number, menuItemId: number) {
  const { menuItems } = useMenu(restaurantId);
  
  return {
    menuItem: menuItems?.find(item => item.id === menuItemId),
    isLoading: !menuItems
  };
}
