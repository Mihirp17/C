import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface Table {
  id: number;
  number: number;
  qrCode: string;
  restaurantId: number;
  isOccupied: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useTables(restaurantId: number) {
  const queryClient = useQueryClient();
  
  const { data: tables, isLoading, error } = useQuery({
    queryKey: [`/api/restaurants/${restaurantId}/tables`],
    enabled: !!restaurantId
  });
  
  // Create table mutation
  const createTableMutation = useMutation({
    mutationFn: async (table: { number: number }) => {
      const response = await apiRequest('POST', `/api/restaurants/${restaurantId}/tables`, table);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/tables`]
      });
    }
  });
  
  // Update table mutation
  const updateTableMutation = useMutation({
    mutationFn: async ({ tableId, data }: { tableId: number; data: Partial<Table> }) => {
      const response = await apiRequest('PUT', `/api/restaurants/${restaurantId}/tables/${tableId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/tables`]
      });
    }
  });
  
  // Delete table mutation
  const deleteTableMutation = useMutation({
    mutationFn: async (tableId: number) => {
      const response = await apiRequest('DELETE', `/api/restaurants/${restaurantId}/tables/${tableId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/tables`]
      });
    }
  });
  
  return {
    tables,
    isLoading,
    error,
    createTable: createTableMutation.mutate,
    updateTable: updateTableMutation.mutate,
    deleteTable: deleteTableMutation.mutate,
    isCreating: createTableMutation.isPending,
    isUpdating: updateTableMutation.isPending,
    isDeleting: deleteTableMutation.isPending
  };
}

export function useTable(restaurantId: number, tableId: number) {
  const { tables } = useTables(restaurantId);
  
  return {
    table: tables?.find(table => table.id === tableId),
    isLoading: !tables
  };
}
