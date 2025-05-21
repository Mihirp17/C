import { useState } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useTables } from "@/hooks/use-tables";
import { TableCard } from "@/components/tables/table-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

// Form schema for table
const tableSchema = z.object({
  number: z.string().refine((val) => !isNaN(parseInt(val)), { message: "Table number must be a number" })
});

export default function Tables() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId;
  const { tables, isLoading, createTable, updateTable, deleteTable } = useTables(restaurantId!);
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  
  const form = useForm<z.infer<typeof tableSchema>>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      number: ""
    }
  });

  const handleAddNewTable = () => {
    setEditingTable(null);
    form.reset({ number: "" });
    setIsDialogOpen(true);
  };

  const handleEditTable = (table: any) => {
    setEditingTable(table);
    form.reset({ number: table.number.toString() });
    setIsDialogOpen(true);
  };

  const handleDeleteTable = async (tableId: number) => {
    try {
      await deleteTable(tableId);
      toast({
        title: "Table deleted",
        description: "The table has been successfully deleted."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete table.",
        variant: "destructive"
      });
    }
  };

  const handleToggleOccupied = async (tableId: number, isOccupied: boolean) => {
    try {
      await updateTable({
        tableId,
        data: { isOccupied: !isOccupied }
      });
      toast({
        title: isOccupied ? "Table marked as free" : "Table marked as occupied",
        description: `Table status has been updated.`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update table status.",
        variant: "destructive"
      });
    }
  };

  const onSubmit = async (data: z.infer<typeof tableSchema>) => {
    try {
      const tableNumber = parseInt(data.number);
      
      if (editingTable) {
        // Update existing table
        await updateTable({
          tableId: editingTable.id,
          data: { number: tableNumber }
        });
        toast({
          title: "Table updated",
          description: "The table number has been successfully updated."
        });
      } else {
        // Create new table
        await createTable({ number: tableNumber });
        toast({
          title: "Table created",
          description: "The new table has been successfully added."
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save table.",
        variant: "destructive"
      });
    }
  };

  return (
    <Layout
      title="Tables"
      description="Manage tables and QR codes"
      requireAuth
      allowedRoles={['restaurant']}
    >
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Tables Overview
          </h3>
          <Button 
            onClick={handleAddNewTable}
            className="bg-brand hover:bg-red-700 text-white"
          >
            <span className="material-icons mr-2 text-sm">add</span>
            Add Table
          </Button>
        </div>

        {/* Tables Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-gray-500 dark:text-gray-400">Loading tables...</p>
          </div>
        ) : tables && tables.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {tables.map(table => (
              <TableCard
                key={table.id}
                table={table}
                onEdit={() => handleEditTable(table)}
                onDelete={() => handleDeleteTable(table.id)}
                onToggleOccupied={() => handleToggleOccupied(table.id, table.isOccupied)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No tables found</p>
            <Button 
              onClick={handleAddNewTable}
              variant="outline"
              className="mt-4"
            >
              Add your first table
            </Button>
          </div>
        )}
      </div>

      {/* Table Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTable ? "Edit Table" : "Add Table"}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Table Number</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="1" placeholder="1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-brand hover:bg-red-700 text-white"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <span className="flex items-center">
                      <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      Saving...
                    </span>
                  ) : (
                    editingTable ? "Update Table" : "Add Table"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
