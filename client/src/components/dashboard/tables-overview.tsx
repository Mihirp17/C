import { useTables } from "@/hooks/use-tables";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface TablesOverviewProps {
  restaurantId?: number;
}

export function TablesOverview({ restaurantId }: TablesOverviewProps) {
  const { tables, isLoading, updateTable } = useTables(restaurantId || 0);

  // Toggle table occupancy status
  const handleToggleOccupied = (tableId: number, isOccupied: boolean) => {
    updateTable({ tableId, data: { isOccupied: !isOccupied } });
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Tables Overview</h3>
          <div className="animate-pulse w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="p-5 grid grid-cols-3 sm:grid-cols-4 gap-4">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg p-3 text-center">
              <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mx-auto"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Tables Overview</h3>
        <Link href="/tables">
          <Button variant="link" className="text-sm text-brand hover:text-red-800 dark:hover:text-red-400 font-medium">
            Manage
          </Button>
        </Link>
      </div>
      <div className="p-5 grid grid-cols-3 sm:grid-cols-4 gap-4">
        {tables && tables.length > 0 ? (
          tables.map((table) => (
            <div
              key={table.id}
              className={`rounded-lg p-3 text-center cursor-pointer transition-colors duration-200 ${
                table.isOccupied
                  ? "bg-red-100 dark:bg-red-900/30"
                  : "bg-gray-100 dark:bg-gray-700"
              }`}
              onClick={() => handleToggleOccupied(table.id, table.isOccupied)}
            >
              <p className={`font-medium ${
                table.isOccupied
                  ? "text-brand"
                  : "text-gray-700 dark:text-gray-300"
              }`}>
                Table {table.number}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {table.isOccupied ? "Occupied" : "Free"}
              </p>
            </div>
          ))
        ) : (
          <div className="col-span-4 text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No tables found</p>
            <Link href="/tables">
              <Button variant="link" className="mt-2 text-brand">
                Add tables
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
