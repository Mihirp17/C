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
import { useQueryClient } from "@tanstack/react-query";

interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price: string;
  image: string | null;
  isAvailable: boolean;
  category?: string; // Ensure category is optional
}

interface CartItem extends MenuItem {
  quantity: number;
}

export default function CustomerMenu() {
  const { restaurantId, tableId } = useParams();
  const { toast } = useToast();
  const { sendMessage } = useSocket(
    restaurantId ? parseInt(restaurantId) : undefined, 
    tableId ? parseInt(tableId) : undefined
  );
  const queryClient = useQueryClient();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isOrderingDialogOpen, setIsOrderingDialogOpen] = useState(false);
  const [isOrderSuccessDialogOpen, setIsOrderSuccessDialogOpen] = useState(false);
  const [isCallWaiterDialogOpen, setIsCallWaiterDialogOpen] = useState(false);
  const [waiterRequestSent, setWaiterRequestSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNameSubmitted, setIsNameSubmitted] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  // Toggle favorite menu item
  const toggleFavorite = (itemId: number) => {
    setFavorites((prevFavorites) =>
      prevFavorites.includes(itemId)
        ? prevFavorites.filter((id) => id !== itemId)
        : [...prevFavorites, itemId]
    );
  };

  // --- UI/UX Improvements Start ---
  // 1. Add menu item image modal for preview
  const openItemModal = (item: MenuItem) => {
    setSelectedItem(item);
    setIsItemModalOpen(true);
  };
  const closeItemModal = () => {
    setIsItemModalOpen(false);
    setSelectedItem(null);
  };
  // --- UI/UX Improvements End ---

  // The sendWaiterRequest function is defined further down in the file

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

  // Get unique categories from menu items
  const categories = [...new Set(menuItems.map(item => item.category || "Uncategorized"))].sort();

  // Filter menu items based on search term and category
  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get category icon based on name
  const getCategoryIcon = (category: string) => {
    const lowerCategory = category.toLowerCase();
    
    // Return appropriate SVG icon based on category
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {lowerCategory.includes('starter') || lowerCategory.includes('appetizer') ? (
          // Salad/Starter icon
          <>
            <path d="M12 2a8 8 0 0 0-8 8v1h16v-1a8 8 0 0 0-8-8Z"/>
            <path d="M2 11v2c0 5 4 9 9 9h2c5 0 9-4 9-9v-2"/>
          </>
        ) : lowerCategory.includes('soup') ? (
          // Bowl/Soup icon
          <>
            <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z"/>
            <path d="M7 21h10"/>
            <path d="M19.5 12V3h-15v9"/>
          </>
        ) : lowerCategory.includes('burger') ? (
          // Burger icon
          <>
            <path d="M4 10h16"/>
            <path d="M4 14h16"/>
            <path d="M4 18h16"/>
            <path d="M6 6h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/>
          </>
        ) : lowerCategory.includes('pizza') ? (
          // Pizza icon
          <>
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="4"/>
            <line x1="12" y1="2" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
          </>
        ) : lowerCategory.includes('pasta') ? (
          // Pasta/Noodles icon
          <>
            <path d="M4 11h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"/>
            <path d="M6 11V7c0-1.7 1.3-3 3-3h6c1.7 0 3 1.3 3 3v4"/>
          </>
        ) : lowerCategory.includes('dessert') ? (
          // Dessert/Cake icon
          <>
            <path d="M20 11H4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2Z"/>
            <path d="M4 11V7c0-1.7 1.3-3 3-3h10c1.7 0 3 1.3 3 3v4"/>
            <path d="M8 11V7"/>
            <path d="M16 11V7"/>
          </>
        ) : lowerCategory.includes('drink') || lowerCategory.includes('beverage') ? (
          // Drink icon
          <>
            <path d="M8 2h8"/>
            <path d="M12 2v7"/>
            <path d="M4 9h16"/>
            <path d="M6 14c.7 1.2 1.7 2 3 2"/>
            <path d="M18 14c-.7 1.2-1.7 2-3 2"/>
          </>
        ) : lowerCategory.includes('beer') || lowerCategory.includes('alcohol') ? (
          // Beer/Alcohol icon
          <>
            <path d="M17 11h1a3 3 0 0 1 0 6h-1"/>
            <path d="M9 12v6"/>
            <path d="M13 12v6"/>
            <path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 3 11 3s2 .5 3 .5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/>
            <path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>
          </>
        ) : lowerCategory.includes('sandwich') ? (
          // Sandwich icon
          <>
            <path d="M3 11h18"/>
            <path d="M12 11v8"/>
            <path d="M4 7h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/>
          </>
        ) : (
          // Default food/dish icon
          <>
            <path d="M3 11h18"/>
            <path d="M12 11v8"/>
            <path d="M4 7h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/>
          </>
        )}
      </svg>
    );
  };

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
    
    if (!customerName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name so the waiter knows who to assist.",
        variant: "destructive"
      });
      return;
    }
    
    // The socket library expects a message with type and payload fields
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
      title: "Waiter Called",
      description: "A staff member will be with you shortly",
    });
    
    // Reset waiter request status after 2 minutes
    setTimeout(() => {
      setWaiterRequestSent(false);
    }, 2 * 60 * 1000);
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
    if (!restaurantId || isNaN(Number(restaurantId)) || !tableId || isNaN(Number(tableId))) {
      toast({
        title: "Invalid QR/Table",
        description: "Missing or invalid restaurant or table information. Please scan the correct QR code or contact staff.",
        variant: "destructive"
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const orderData = {
        customerName,
        tableId: parseInt(tableId),
        restaurantId: parseInt(restaurantId),
        status: "pending",
        total: cartTotal.toString(),
        items: cart.map(item => ({
          menuItemId: item.id,
          quantity: item.quantity,
          price: item.price
        }))
      };

      // Place the order
      const response = await apiRequest("POST", `/api/restaurants/${restaurantId}/orders`, orderData);
      
      if (response.ok) {
        // Update table status to occupied
        await apiRequest("PATCH", `/api/restaurants/${restaurantId}/tables/${tableId}`, {
          isOccupied: true
        });

        // Update table status in cache with correct query key
        queryClient.invalidateQueries({ queryKey: [`/api/restaurants/${restaurantId}/tables`] });
        
        // Close ordering dialog and show success dialog
        setIsOrderingDialogOpen(false);
        setCart([]);
        setIsOrderSuccessDialogOpen(true);
      } else {
        throw new Error("Failed to place your order, please try again");
      }
    } catch (error) {
      console.error("Error placing order:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to place your order, please try again",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + parseFloat(item.price) * item.quantity, 0);
  };

  // --- UI update start ---
  if (!isNameSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-card/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-border/20">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-full mx-auto mb-4"></div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Welcome to {restaurant?.name}</h1>
              <p className="text-muted-foreground">Please enter your name to get started</p>
            </div>
            <div className="space-y-4">
              <Input
                placeholder="Your Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="h-12 text-lg border-2 border-border rounded-xl focus-visible:ring-primary transition-colors"
              />
              <Button
                onClick={() => setIsNameSubmitted(true)}
                disabled={!customerName.trim()}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
              >
                Continue to Menu
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto bg-card min-h-screen">
        {/* Header */}
        <div className="relative h-64 bg-gradient-to-br from-primary via-primary/90 to-primary/80 overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-end justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-background/10 backdrop-blur-md rounded-2xl border border-border/30"></div>
                <div>
                  <h1 className="text-2xl font-bold text-primary-foreground">{restaurant?.name}</h1>
                  <p className="text-primary-foreground/80 text-sm">Table {tableId}</p>
                </div>
              </div>
              <Button 
                variant="secondary"
                size="sm"
                className="bg-background/10 backdrop-blur-md border-border/30 text-primary-foreground hover:bg-background/20 transition-all duration-300"
                onClick={callWaiter}
                disabled={waiterRequestSent}
              >
                {waiterRequestSent ? (
                  <span className="flex items-center space-x-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Waiter Coming</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
                    </svg>
                    <span>Call Waiter</span>
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
        {/* Search and Categories */}
        <div className="p-6 bg-card border-b border-border">
          <div className="relative mb-6">
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search menu..."
              className="h-12 pl-12 border-2 border-border rounded-xl focus-visible:ring-primary transition-colors"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
          </div>
          
          {/* Categories */}
          <div className="flex overflow-x-auto py-2 space-x-2 scrollbar-hide">
            <Button
              onClick={() => setSelectedCategory("all")}
              variant={selectedCategory === "all" ? "default" : "outline"}
              className="rounded-full px-4 py-2 whitespace-nowrap shadow-sm hover:shadow transition-all duration-200"
            >
              All Items
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                onClick={() => setSelectedCategory(category)}
                variant={selectedCategory === category ? "default" : "outline"}
                className="rounded-full px-4 py-2 whitespace-nowrap shadow-sm hover:shadow transition-all duration-200"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Menu Items */}
        <div className="px-6 pb-32 space-y-4">
          {filteredMenuItems.length > 0 ? (
            filteredMenuItems.map((item) => (
              <Card key={item.id} className="overflow-hidden border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-sm rounded-2xl group">
                <CardContent className="p-0">
                  <div className="flex">
                    <div 
                      className="w-32 h-32 bg-muted cursor-pointer relative overflow-hidden group-hover:w-36 transition-all duration-500 ease-in-out"
                      onClick={() => openItemModal(item)}
                    >
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-accent via-accent/90 to-accent/80">
                          {getCategoryIcon(item.category || "Uncategorized")}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    <div className="flex-1 p-5 flex flex-col">
                      <div className="flex justify-between items-start mb-2">
                        <div className="space-y-1">
                          <h3 className="font-bold text-foreground text-lg leading-tight tracking-tight group-hover:text-primary transition-colors duration-300">{item.name}</h3>
                          <Badge variant="outline" className="bg-background/50 backdrop-blur-sm">
                            {item.category || "Uncategorized"}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFavorite(item.id)}
                          className={`p-1.5 h-8 w-8 rounded-full hover:bg-accent/50 hover:text-primary transition-all duration-300 ${favorites.includes(item.id) ? 'text-primary scale-110' : 'text-muted-foreground'}`}
                        >★</Button>
                      </div>
                      <p className="text-muted-foreground/80 text-sm mb-3 line-clamp-2 leading-relaxed group-hover:text-muted-foreground transition-colors duration-300">
                        {item.description || "Delicious dish prepared with care"}
                      </p>
                      <div className="flex justify-between items-center mt-auto">
                        <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                          {formatCurrency(parseFloat(item.price))}
                        </span>
                        <div className="flex items-center space-x-2">
                          {cart.find(cartItem => cartItem.id === item.id) ? (
                            <div className="flex items-center space-x-2 bg-gradient-to-r from-background/80 to-background/60 backdrop-blur-md rounded-full px-3 py-1 border border-border/50 shadow-lg">
                              <Button
                                onClick={() => removeFromCart(item.id)}
                                size="sm"
                                variant="ghost"
                                className="w-8 h-8 rounded-full bg-background/80 hover:bg-destructive/10 hover:text-destructive text-lg font-medium p-0 shadow-sm border border-border/50 transition-all duration-300 hover:scale-105"
                              >
                                −
                              </Button>
                              <span className="font-bold text-foreground min-w-[28px] text-center">
                                {cart.find(cartItem => cartItem.id === item.id)?.quantity || 0}
                              </span>
                              <Button
                                onClick={() => addToCart(item)}
                                size="sm"
                                variant="ghost"
                                className="w-8 h-8 rounded-full bg-background/80 hover:bg-primary/10 hover:text-primary text-lg font-medium p-0 shadow-sm border border-border/50 transition-all duration-300 hover:scale-105"
                              >
                                +
                              </Button>
                            </div>
                          ) : (
                            <Button
                              onClick={() => addToCart(item)}
                              className="bg-gradient-to-r from-primary via-primary/95 to-primary/90 hover:from-primary hover:to-primary/95 text-primary-foreground rounded-full px-6 py-3 text-sm font-semibold shadow-[0_8px_16px_rgba(0,0,0,0.1)] transition-all duration-500 transform hover:scale-105 hover:shadow-[0_12px_24px_rgba(0,0,0,0.15)] backdrop-blur-md border border-white/10"
                            >
                              Add to Order
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4 animate-bounce">
                {selectedCategory === "all" ? (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                ) : getCategoryIcon(selectedCategory)}
              </div>
              <p className="text-foreground text-lg font-medium">No dishes found</p>
              <p className="text-muted-foreground text-sm">
                {searchTerm ? "Try adjusting your search" : "No items in this category"}
              </p>
            </div>
          )}
        </div>
        {/* Floating Cart Button */}
        {cart.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom duration-500">
            <Button 
              className="bg-gradient-to-r from-primary via-primary/95 to-primary/90 hover:from-primary hover:to-primary/95 text-primary-foreground rounded-full px-6 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] text-lg font-bold transition-all duration-500 transform hover:scale-105 hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] backdrop-blur-md border border-white/10 group"
              onClick={() => setIsOrderingDialogOpen(true)}
            >
              <div className="flex items-center space-x-4 group-hover:scale-105 transition-transform duration-500">
                <div className="bg-white/20 rounded-full w-10 h-10 flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner">
                  <span className="font-bold text-lg">{cartItemCount}</span>
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-sm text-white/80">Review Order</span>
                  <span className="text-lg">{formatCurrency(cartTotal)}</span>
                </div>
              </div>
            </Button>
          </div>
        )}

        {/* Order Dialog */}
        <Dialog open={isOrderingDialogOpen} onOpenChange={setIsOrderingDialogOpen}>
          <DialogContent className="bg-gradient-to-b from-card to-card/95 backdrop-blur-xl border-border/50 shadow-2xl max-w-md mx-auto">
            <DialogHeader className="space-y-3 pb-4 border-b border-border/30">
              <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/90">Review Your Order</DialogTitle>
              <p className="text-muted-foreground font-medium">Table {tableId} • {restaurant?.name}</p>
            </DialogHeader>
            <div className="space-y-6 my-4">
              {!isNameSubmitted && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Your Name</label>
                  <Input
                    placeholder="Enter your name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-12 border-2 border-border focus-visible:ring-primary transition-all duration-300 bg-background/50 backdrop-blur-sm"
                  />
                </div>
              )}
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground mb-2">Order Items</div>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-accent/20 border border-border/50 backdrop-blur-sm transition-all duration-300 hover:bg-accent/30">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center font-mono">
                          {item.quantity}×
                        </div>
                        <span className="text-foreground font-medium">{item.name}</span>
                      </div>
                      <span className="text-foreground font-mono">{formatCurrency(parseFloat(item.price) * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-border/30 pt-4 mt-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg text-foreground font-medium">Total Amount</span>
                  <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/90">
                    {formatCurrency(cartTotal)}
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter className="space-x-3">
              <Button
                onClick={() => setIsOrderingDialogOpen(false)}
                variant="outline"
                className="flex-1 border-2 hover:bg-accent/10 transition-colors duration-300"
              >
                Cancel
              </Button>
              <Button
                onClick={placeOrder}
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 text-primary-foreground shadow-lg transition-all duration-300 hover:shadow-xl disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="flex items-center space-x-2">
                    <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                    <span>Processing...</span>
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
          <DialogContent className="bg-gradient-to-b from-card to-card/95 backdrop-blur-xl border-border/50 shadow-2xl max-w-md mx-auto">
            <div className="text-center space-y-6 py-4">
              <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full"></div>
              <div className="space-y-2">
                <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/90">
                  Order Placed Successfully!
                </DialogTitle>
                <p className="text-muted-foreground">Your delicious meal will be prepared shortly.</p>
              </div>
              <Button 
                onClick={() => setIsOrderSuccessDialogOpen(false)}
                className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 text-primary-foreground shadow-lg transition-all duration-300 hover:shadow-xl px-8"
              >
                Great!
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Call Waiter Dialog */}
        <Dialog open={isCallWaiterDialogOpen} onOpenChange={setIsCallWaiterDialogOpen}>
          <DialogContent className="bg-gradient-to-b from-card to-card/95 backdrop-blur-xl border-border/50 shadow-2xl max-w-md mx-auto">
            <DialogHeader className="space-y-3 pb-4 border-b border-border/30">
              <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/90">
                Call Waiter
              </DialogTitle>
              <p className="text-muted-foreground">Please provide your name so our staff can assist you better</p>
            </DialogHeader>
            <div className="space-y-6 my-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Your Name</label>
                <Input
                  placeholder="Enter your name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-12 border-2 border-border focus-visible:ring-primary transition-all duration-300 bg-background/50 backdrop-blur-sm"
                />
              </div>
            </div>
            <DialogFooter className="space-x-3">
              <Button
                onClick={() => setIsCallWaiterDialogOpen(false)}
                variant="outline"
                className="flex-1 border-2 hover:bg-accent/10 transition-colors duration-300"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (customerName.trim()) {
                    sendMessage({
                      type: 'call-waiter',
                      payload: {
                        restaurantId: parseInt(restaurantId!),
                        tableId: parseInt(tableId!),
                        customerName,
                        timestamp: new Date().toISOString()
                      }
                    });
                    setWaiterRequestSent(true);
                    setIsCallWaiterDialogOpen(false);
                    toast({
                      title: "Waiter Called",
                      description: "A waiter will be with you shortly",
                    });
                  } else {
                    toast({
                      title: "Name Required",
                      description: "Please enter your name",
                      variant: "destructive"
                    });
                  }
                }}
                disabled={waiterRequestSent}
                className="flex-1 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 text-primary-foreground shadow-lg transition-all duration-300 hover:shadow-xl disabled:opacity-50"
              >
                {waiterRequestSent ? "Waiter Called" : "Call Waiter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Item Modal */}
        <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
          <DialogContent className="bg-gradient-to-b from-card to-card/95 backdrop-blur-xl border-border/50 shadow-2xl max-w-md mx-auto">
            <DialogHeader className="space-y-3 pb-4">
              <DialogTitle className="text-2xl font-bold text-foreground">{selectedItem?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 my-2">
              {selectedItem?.image && (
                <div className="w-full aspect-video rounded-xl overflow-hidden">
                  <img 
                    src={selectedItem.image} 
                    alt={selectedItem.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <p className="text-muted-foreground text-sm leading-relaxed">
                {selectedItem?.description || "A delicious dish prepared with the finest ingredients."}
              </p>
              <div className="bg-accent/20 rounded-xl p-4 border border-border/50">
                <p className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/90">
                  {selectedItem && formatCurrency(parseFloat(selectedItem.price))}
                </p>
              </div>
            </div>
            <DialogFooter className="space-x-3 mt-4">
              <Button 
                onClick={() => setIsItemModalOpen(false)} 
                variant="outline"
                className="flex-1 border-2 hover:bg-accent/10 transition-colors duration-300"
              >
                Close
              </Button>
              {selectedItem && (
                <Button
                  onClick={() => {
                    addToCart(selectedItem);
                    setIsItemModalOpen(false);
                  }}
                  className="flex-1 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 text-primary-foreground shadow-lg transition-all duration-300 hover:shadow-xl"
                >
                  Add to Order
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}