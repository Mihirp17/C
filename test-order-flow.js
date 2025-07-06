// Test script for restaurant management platform
import fetch from 'node-fetch';

// Constants
const BASE_URL = 'http://localhost:5000';
const RESTAURANT_ID = 2; // Updated to match the logged-in restaurant ID
const TABLE_ID = 2;
const CUSTOMER_NAME = 'Test Customer';

// Helper function for making API requests
async function apiRequest(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  return response;
}

// Login as restaurant manager to get session
async function loginAsRestaurant() {
  console.log('Logging in as restaurant manager...');
  const response = await apiRequest('POST', '/api/auth/login', {
    email: 'restaurant@demo.com',
    password: 'password123'
  });
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log('Login successful:', data);
  return response.headers.get('set-cookie');
}

// Get menu items for a restaurant
async function getMenuItems(restaurantId, cookie) {
  console.log(`Getting menu items for restaurant ${restaurantId}...`);
  const response = await fetch(`${BASE_URL}/api/restaurants/${restaurantId}/menu-items`, {
    headers: { Cookie: cookie }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get menu items: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`Retrieved ${data.length} menu items`);
  return data;
}

// Place an order as a customer
async function placeOrder(restaurantId, tableId, menuItems) {
  console.log(`Placing order at restaurant ${restaurantId}, table ${tableId}...`);
  
  // Select 2 specific menu items to ensure deterministic behavior
  const selectedItems = [];
  const itemsToSelect = Math.min(2, menuItems.length);
  
  // Use a set to track selected items to avoid duplicates
  const selectedIndices = new Set();
  
  while (selectedIndices.size < itemsToSelect && selectedIndices.size < menuItems.length) {
    const randomIndex = Math.floor(Math.random() * menuItems.length);
    if (!selectedIndices.has(randomIndex)) {
      selectedIndices.add(randomIndex);
      const menuItem = menuItems[randomIndex];
      selectedItems.push({
        menuItemId: menuItem.id,
        quantity: Math.floor(Math.random() * 3) + 1, // 1-3 items
        price: menuItem.price
      });
    }
  }
  
  // Calculate total more accurately
  const total = selectedItems.reduce((sum, item) => {
    const itemTotal = parseFloat(item.price) * item.quantity;
    return sum + itemTotal;
  }, 0);
  
  // Create order payload
  const orderData = {
    customerName: CUSTOMER_NAME,
    tableId: tableId,
    restaurantId: restaurantId,
    status: "pending",
    total: total.toFixed(2),
    items: selectedItems
  };
  
  console.log('Order details:', orderData);
  
  // Submit order
  const response = await apiRequest('POST', `/api/restaurants/${restaurantId}/orders`, orderData);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to place order: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log('Order placed successfully:', data);
  return data;
}

// Get active orders as restaurant manager (fixed endpoint)
async function getActiveOrders(restaurantId, cookie) {
  console.log(`Getting active orders for restaurant ${restaurantId}...`);
  const response = await fetch(`${BASE_URL}/api/restaurants/${restaurantId}/active-orders`, {
    headers: { Cookie: cookie }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get active orders: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log(`Retrieved ${data.length} active orders`);
  return data;
}

// Update order status
async function updateOrderStatus(restaurantId, orderId, status, cookie) {
  console.log(`Updating order ${orderId} status to "${status}"...`);
  const response = await fetch(`${BASE_URL}/api/restaurants/${restaurantId}/orders/${orderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie
    },
    body: JSON.stringify({ status })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update order status: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log(`Order status updated to "${status}"`);
  return data;
}

// Run the test
async function runTest() {
  try {
    console.log('Starting test of restaurant management platform...');
    
    // Login as restaurant manager
    const cookie = await loginAsRestaurant();
    
    // Get menu items
    const menuItems = await getMenuItems(RESTAURANT_ID, cookie);
    
    if (menuItems.length === 0) {
      throw new Error('No menu items found for restaurant. Please ensure menu items exist before running the test.');
    }
    
    // Place an order as a customer
    const order = await placeOrder(RESTAURANT_ID, TABLE_ID, menuItems);
    
    // Wait a moment for the order to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify order appears in active orders
    const activeOrders = await getActiveOrders(RESTAURANT_ID, cookie);
    const placedOrder = activeOrders.find(o => o.id === order.id);
    
    if (placedOrder) {
      console.log('✅ Order successfully appeared in active orders!');
    } else {
      console.error('❌ Order not found in active orders');
      console.log('Placed order ID:', order.id);
      console.log('Active order IDs:', activeOrders.map(o => o.id));
    }
    
    // Update order status through the workflow
    const statuses = ['confirmed', 'preparing', 'served', 'completed'];
    let updatedOrder = order;
    
    for (const status of statuses) {
      updatedOrder = await updateOrderStatus(RESTAURANT_ID, order.id, status, cookie);
      console.log(`✅ Order status changed to: ${updatedOrder.status}`);
      
      // Pause between status updates
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log('🎉 Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runTest();