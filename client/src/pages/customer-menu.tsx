import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/use-socket";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price: string;
  image: string | null;
  category: string;
  isAvailable: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
}

export default function CustomerMenu() {
  const { restaurantId, tableId } = useParams();
  const { toast } = useToast();
  
  // Connect to WebSocket for real-time updates
  const { sendMessage } = useSocket(parseInt(restaurantId), parseInt(tableId));
  
  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderingDialogOpen, setIsOrderingDialogOpen] = useState(false);
  const [isOrderSuccessDialogOpen, setIsOrderSuccessDialogOpen] = useState(false);
  const [isCallWaiterDialogOpen, setIsCallWaiterDialogOpen] = useState(false);
  const [waiterRequestSent, setWaiterRequestSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch restaurant and menu items
  useEffect(() => {
    const fetchRestaurantAndMenu = async () => {
      try {
        // Fetch restaurant
        const restaurantResponse = await fetch(`/api/restaurants/${restaurantId}`);
        if (!restaurantResponse.ok) throw new Error("Failed to fetch restaurant");
        const restaurantData = await restaurantResponse.json();
        setRestaurant(restaurantData);
        
        // Fetch menu items
        const menuResponse = await fetch(`/api/restaurants/${restaurantId}/menu-items`);
        if (!menuResponse.ok) throw new Error("Failed to fetch menu items");
        const menuData = await menuResponse.json();
        
        // Filter only available items
        const availableItems = menuData.filter((item: MenuItem) => item.isAvailable);
        setMenuItems(availableItems);
        
        // Extract unique categories
        const uniqueCategories = Array.from(new Set(availableItems.map((item: MenuItem) => item.category)));
        setCategories(uniqueCategories);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Error",
          description: "Failed to load menu, please try again",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRestaurantAndMenu();
  }, [restaurantId, toast]);

  // Filter menu items based on category and search term
  const filteredMenuItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Add item to cart
  const addToCart = (item: MenuItem) => {
    setCart(prevCart => {
      // Check if item already exists in cart
      const existingItemIndex = prevCart.findIndex(cartItem => cartItem.id === item.id);
      
      if (existingItemIndex >= 0) {
        // Increment quantity of existing item
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex].quantity += 1;
        return updatedCart;
      } else {
        // Add new item to cart
        return [...prevCart, { ...item, quantity: 1 }];
      }
    });
    
    toast({
      title: "Added to order",
      description: `${item.name} added to your order`
    });
  };

  // Remove item from cart
  const removeFromCart = (itemId: number) => {
    setCart(prevCart => {
      const existingItemIndex = prevCart.findIndex(item => item.id === itemId);
      
      if (existingItemIndex >= 0) {
        const updatedCart = [...prevCart];
        if (updatedCart[existingItemIndex].quantity > 1) {
          // Decrement quantity
          updatedCart[existingItemIndex].quantity -= 1;
          return updatedCart;
        } else {
          // Remove item completely
          return prevCart.filter(item => item.id !== itemId);
        }
      }
      
      return prevCart;
    });
  };

  // Calculate cart total
  const cartTotal = cart.reduce((total, item) => {
    return total + (parseFloat(item.price) * item.quantity);
  }, 0);

  // Calculate total cart items
  const cartItemCount = cart.reduce((count, item) => count + item.quantity, 0);
  
  // Call waiter function
  const callWaiter = () => {
    if (!customerName.trim()) {
      setIsCallWaiterDialogOpen(true);
      return;
    }
    
    sendWaiterRequest();
  };
  
  // Send waiter request via WebSocket
  const sendWaiterRequest = () => {
    if (!restaurantId || !tableId) return;
    
    sendMessage({
      type: 'call-waiter',
      payload: {
        restaurantId: parseInt(restaurantId),
        tableId: parseInt(tableId),
        customerName: customerName.trim() || 'Guest',
        timestamp: new Date().toISOString()
      }
    });
    
    setIsCallWaiterDialogOpen(false);
    setWaiterRequestSent(true);
    
    toast({
      title: "Waiter called",
      description: "A staff member will be with you shortly",
    });
    
    // Reset waiter request status after 30 seconds
    setTimeout(() => {
      setWaiterRequestSent(false);
    }, 30000);
  };

  // Place order
  const placeOrder = async () => {
    if (!customerName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name to place an order",
        variant: "destructive"
      });
      return;
    }
    
    if (cart.length === 0) {
      toast({
        title: "Empty order",
        description: "Please add items to your order",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare order data
      const orderData = {
        customerName,
        tableId: parseInt(tableId),
        status: "pending",
        total: cartTotal.toString(),
        items: cart.map(item => ({
          menuItemId: item.id,
          quantity: item.quantity,
          price: item.price
        }))
      };
      
      // Submit order
      const response = await apiRequest("POST", `/api/restaurants/${restaurantId}/orders`, orderData);
      
      if (response.ok) {
        // Show success dialog
        setIsOrderSuccessDialogOpen(true);
        // Close ordering dialog
        setIsOrderingDialogOpen(false);
        // Clear cart
        setCart([]);
      }
    } catch (error) {
      console.error("Error placing order:", error);
      toast({
        title: "Error",
        description: "Failed to place your order, please try again",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine menu item category icon
  const getCategoryIcon = (category: string) => {
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        {/* Restaurant Header */}
        <div className="relative h-40 bg-gradient-to-r from-red-500 to-red-700">
          <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-black bg-opacity-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-16 h-16 rounded-full bg-white p-1 shadow-lg">
                  <div className="w-full h-full rounded-full bg-brand flex items-center justify-center text-white font-bold text-xl">
                    {restaurant?.name ? restaurant.name.substring(0, 2).toUpperCase() : "RE"}
                  </div>
                </div>
                <div className="ml-3">
                  <h1 className="text-xl font-bold text-white">{restaurant?.name || "Restaurant"}</h1>
                  <p className="text-sm text-gray-200">Table {tableId}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white text-brand hover:bg-gray-100"
                onClick={callWaiter}
                disabled={waiterRequestSent}
              >
                <span className="material-icons mr-1 text-sm">
                  {waiterRequestSent ? "check_circle" : "pan_tool"}
                </span>
                {waiterRequestSent ? "Waiter Coming" : "Call Waiter"}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Menu Categories */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Our Menu</h2>
            <button 
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-700"
              onClick={() => setSearchTerm(searchTerm ? "" : searchTerm)}
            >
              <span className="material-icons text-gray-500">{searchTerm ? "close" : "search"}</span>
            </button>
          </div>
          
          {searchTerm ? (
            <div className="mb-6">
              <Input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search menu..."
                className="w-full"
              />
            </div>
          ) : (
            <div className="flex overflow-x-auto scrollbar-hide py-2 space-x-2 mb-6">
              <Button
                onClick={() => setSelectedCategory("all")}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
                  selectedCategory === "all" 
                    ? "bg-brand text-white" 
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
                variant="ghost"
              >
                All Items
              </Button>
              
              {categories.map((category) => (
                <Button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
                    selectedCategory === category 
                      ? "bg-brand text-white" 
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
                  variant="ghost"
                >
                  {category}
                </Button>
              ))}
            </div>
          )}
          
          {/* Menu Items List */}
          <div className="space-y-4">
            {filteredMenuItems.length > 0 ? (
              filteredMenuItems.map((item) => (
                <div key={item.id} className="flex bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                  <div className="w-24 h-24 bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-icons text-3xl text-brand">
                        {getCategoryIcon(item.category)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 p-3 flex flex-col">
                    <div className="flex justify-between">
                      <h3 className="font-medium text-gray-900 dark:text-white">{item.name}</h3>
                      <p className="font-medium text-brand">{formatCurrency(parseFloat(item.price))}</p>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {item.description || "No description available"}
                    </p>
                    <button 
                      className="self-end mt-auto px-3 py-1 rounded-full bg-brand text-white text-xs"
                      onClick={() => addToCart(item)}
                    >
                      Add to order
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No menu items found</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Order Footer */}
        {cart.length > 0 && (
          <div className="sticky bottom-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <button 
              className="w-full py-3 rounded-lg bg-brand text-white font-medium flex items-center justify-center"
              onClick={() => setIsOrderingDialogOpen(true)}
            >
              <span className="material-icons mr-2">shopping_cart</span>
              View Order ({cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}) - {formatCurrency(cartTotal)}
            </button>
          </div>
        )}
      </div>
      
      {/* Order Dialog */}
      <Dialog open={isOrderingDialogOpen} onOpenChange={setIsOrderingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Your Order</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Name</label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>
            
            <div className="border-t pt-2">
              <h3 className="font-medium mb-2">Order Items</h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-2 border-b">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatCurrency(parseFloat(item.price))} x {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 w-8 rounded-full p-0"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <span className="material-icons text-sm">remove</span>
                      </Button>
                      <span className="w-6 text-center">{item.quantity}</span>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 w-8 rounded-full p-0"
                        onClick={() => addToCart(item)}
                      >
                        <span className="material-icons text-sm">add</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total</span>
                <span className="font-bold text-lg">{formatCurrency(cartTotal)}</span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOrderingDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              className="bg-brand hover:bg-red-700 text-white"
              onClick={placeOrder}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Placing Order...
                </span>
              ) : (
                "Place Order"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Order Success Dialog */}
      <Dialog open={isOrderSuccessDialogOpen} onOpenChange={setIsOrderSuccessDialogOpen}>
        <DialogContent className="max-w-md">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-icons text-2xl text-green-600">check</span>
            </div>
            <h2 className="text-xl font-bold mb-2">Order Placed Successfully!</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Your order has been received and is being processed. You can follow the status of your order on this page.
            </p>
            <Button
              className="w-full bg-brand hover:bg-red-700 text-white"
              onClick={() => setIsOrderSuccessDialogOpen(false)}
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Call Waiter Dialog */}
      <Dialog open={isCallWaiterDialogOpen} onOpenChange={setIsCallWaiterDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Call a Waiter</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-gray-500 dark:text-gray-400">
              Please enter your name so the waiter knows who to assist.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Name</label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsCallWaiterDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={sendWaiterRequest}
              className="bg-brand hover:bg-red-700 text-white"
            >
              Call Waiter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
