import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMenu, MenuItem } from "@/hooks/use-menu";
import { useOrders } from "@/hooks/use-orders";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface CartItem extends MenuItem {
  quantity: number;
}

interface StaffOrderDialogProps {
  restaurantId: number;
  selectedTableId: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderPlaced?: () => void;
}

export function StaffOrderDialog({ 
  restaurantId, 
  selectedTableId, 
  isOpen, 
  onOpenChange,
  onOrderPlaced 
}: StaffOrderDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { menuItems, isLoading: isMenuLoading, getCategories } = useMenu(restaurantId);
  const { createOrder, isCreating } = useOrders(restaurantId);
  const [customerName, setCustomerName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get unique categories from menu items
  useEffect(() => {
    if (menuItems && Array.isArray(menuItems)) {
      setCategories(getCategories() as string[]);
    }
  }, [menuItems, getCategories]);

  // Filter menu items based on category and search
  const filteredMenuItems: MenuItem[] = (menuItems && Array.isArray(menuItems) ? menuItems : []).filter((item: MenuItem) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch = searchTerm === "" || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return item.isAvailable && matchesCategory && matchesSearch;
  });

  // Add item to cart
  const addToCart = (item: MenuItem) => {
    setCart((prevCart: CartItem[]) => {
      const existingItemIndex = prevCart.findIndex(cartItem => cartItem.id === item.id);
      if (existingItemIndex >= 0) {
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex].quantity += 1;
        return updatedCart;
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  // Remove item from cart
  const removeFromCart = (itemId: number) => {
    setCart(prevCart => {
      const existingItemIndex = prevCart.findIndex(item => item.id === itemId);
      if (existingItemIndex >= 0) {
        const updatedCart = [...prevCart];
        if (updatedCart[existingItemIndex].quantity > 1) {
          updatedCart[existingItemIndex].quantity -= 1;
          return updatedCart;
        }
        return prevCart.filter(item => item.id !== itemId);
      }
      return prevCart;
    });
  };

  // Calculate cart total
  const cartTotal = cart.reduce((total, item) => {
    return total + (parseFloat(item.price) * item.quantity);
  }, 0);

  // Place order
  const placeOrder = async () => {
    if (!customerName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter customer name to place order",
        variant: "destructive"
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "Empty order",
        description: "Please add items to the order",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Mark table as occupied
      const tableResponse = await apiRequest('PUT', `/api/restaurants/${restaurantId}/tables/${selectedTableId}`, {
        isOccupied: true
      });

      if (!tableResponse.ok) {
        throw new Error('Failed to update table status');
      }

      // Create order
      const orderData = {
        customerName: customerName.trim(),
        tableId: selectedTableId,
        restaurantId,
        status: "pending" as const,
        total: cartTotal.toString(),
        items: cart.map(item => ({
          menuItemId: item.id,
          quantity: item.quantity,
          price: item.price
        }))
      };

      await createOrder(orderData);
      
      // Invalidate relevant queries to update UI
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/tables`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/orders`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/active-orders`]
      });

      toast({
        title: "Order placed",
        description: `Order placed successfully for Table ${selectedTableId}`
      });

      setCart([]);
      setCustomerName("");
      onOrderPlaced?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error placing order:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to place order, please try again",
        variant: "destructive"
      });

      // If table update succeeded but order creation failed, revert table status
      try {
        await apiRequest('PUT', `/api/restaurants/${restaurantId}/tables/${selectedTableId}`, {
          isOccupied: false
        });
      } catch (revertError) {
        console.error("Failed to revert table status:", revertError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get category icon based on category name
  const getCategoryIcon = (category: string): string => {
    switch (category.toLowerCase()) {
      case 'starters':
      case 'appetizers':
        return "lunch_dining";
      case 'main course':
      case 'mains':
        return "restaurant";
      case 'burgers':
        return "lunch_dining";
      case 'pizza':
        return "local_pizza";
      case 'pasta':
        return "ramen_dining";
      case 'desserts':
        return "icecream";
      case 'drinks':
        return "local_bar";
      default:
        return "restaurant_menu";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>New Order - Table {selectedTableId}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-1 gap-8 min-h-0">
          {/* Menu Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="space-y-4 mb-4">
              <Input
                placeholder="Customer name..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <Input
                placeholder="Search menu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex overflow-x-auto py-2 space-x-2 mb-4">
              <Button
                onClick={() => setSelectedCategory("all")}
                variant={selectedCategory === "all" ? "default" : "outline"}
                className="whitespace-nowrap"
              >
                All Items
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  variant={selectedCategory === category ? "default" : "outline"}
                  className="whitespace-nowrap"
                >
                  {category}
                </Button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid gap-4">
                {filteredMenuItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                  >
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <span className="material-icons text-2xl text-gray-400">
                          {getCategoryIcon(item.category)}
                        </span>
                      )}
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="flex justify-between">
                        <h3 className="font-medium">{item.name}</h3>
                        <p className="font-medium text-brand">
                          {formatCurrency(parseFloat(item.price))}
                        </p>
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {item.description}
                        </p>
                      )}
                      <Button 
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => addToCart(item)}
                      >
                        Add to order
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary Section */}
          <div className="w-72 flex flex-col border-l dark:border-gray-700">
            <h3 className="font-medium mb-4">Order Summary</h3>
            <div className="flex-1 overflow-y-auto">
              {cart.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b dark:border-gray-700"
                >
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(parseFloat(item.price))} × {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <span className="material-icons text-sm">remove</span>
                    </Button>
                    <span className="text-sm font-medium w-4 text-center">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => addToCart(item)}
                    >
                      <span className="material-icons text-sm">add</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="border-t dark:border-gray-700 pt-4 mt-4">
              <div className="flex justify-between mb-4">
                <span className="font-medium">Total</span>
                <span className="font-bold">{formatCurrency(cartTotal)}</span>
              </div>
              <Button
                className="w-full"
                onClick={placeOrder}
                disabled={isSubmitting || cart.length === 0}
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <span className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Placing Order...
                  </span>
                ) : (
                  "Place Order"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
