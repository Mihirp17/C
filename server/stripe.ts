import Stripe from 'stripe';
import { storage } from './storage';

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY environment variable');
}

// Initialize Stripe with the API key
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2023-10-16',
});

// Plan IDs for different tiers
export const PLANS = {
  BASIC: process.env.STRIPE_BASIC_PLAN_ID || 'price_placeholder_basic',
  PREMIUM: process.env.STRIPE_PREMIUM_PLAN_ID || 'price_placeholder_premium',
  ENTERPRISE: process.env.STRIPE_ENTERPRISE_PLAN_ID || 'price_placeholder_enterprise'
};

// Create or update a customer in Stripe
export const createOrUpdateCustomer = async (restaurantId: number, email: string, name: string) => {
  try {
    // Check if restaurant already has a subscription with customer ID
    const existingSubscription = await storage.getSubscriptionByRestaurantId(restaurantId);
    
    if (existingSubscription?.stripeCustomerId) {
      // Update existing customer
      const customer = await stripe.customers.update(
        existingSubscription.stripeCustomerId,
        { email, name }
      );
      return customer;
    } else {
      // Create new customer
      const customer = await stripe.customers.create({ email, name });
      return customer;
    }
  } catch (error) {
    console.error('Error creating/updating Stripe customer:', error);
    throw error;
  }
};

// Create a subscription for a restaurant
export const createSubscription = async (
  restaurantId: number,
  customerId: string,
  planId: string
) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: planId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: { restaurantId }
    });
    
    // Store subscription info in database
    await storage.updateRestaurantStripeInfo(
      restaurantId,
      customerId,
      subscription.id
    );
    
    return subscription;
  } catch (error) {
    console.error('Error creating Stripe subscription:', error);
    throw error;
  }
};

// Update a subscription for a restaurant
export const updateSubscription = async (
  subscriptionId: string,
  planId: string
) => {
  try {
    // Retrieve the subscription to get the current items
    const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Get the first subscription item ID (assuming one item per subscription)
    const itemId = currentSubscription.items.data[0].id;
    
    // Update the subscription with the new plan
    const updatedSubscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        items: [{ id: itemId, price: planId }],
        proration_behavior: 'create_prorations'
      }
    );
    
    return updatedSubscription;
  } catch (error) {
    console.error('Error updating Stripe subscription:', error);
    throw error;
  }
};

// Cancel a subscription
export const cancelSubscription = async (subscriptionId: string) => {
  try {
    const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);
    return canceledSubscription;
  } catch (error) {
    console.error('Error canceling Stripe subscription:', error);
    throw error;
  }
};

// Generate a subscription client secret for payment
export const generateClientSecret = async (subscriptionId: string) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice.payment_intent']
    });
    
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    
    if (invoice.payment_intent) {
      const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
      return paymentIntent.client_secret;
    }
    
    throw new Error('No payment intent found for subscription');
  } catch (error) {
    console.error('Error generating client secret:', error);
    throw error;
  }
};

// Handle webhook events from Stripe
export const handleWebhookEvent = async (event: Stripe.Event) => {
  const { type, data } = event;
  
  try {
    switch (type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = data.object as Stripe.Subscription;
        const restaurantId = subscription.metadata.restaurantId
          ? parseInt(subscription.metadata.restaurantId)
          : undefined;
        
        if (restaurantId) {
          await storage.updateSubscriptionByRestaurantId(restaurantId, {
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000)
          });
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = data.object as Stripe.Subscription;
        const restaurantId = subscription.metadata.restaurantId
          ? parseInt(subscription.metadata.restaurantId)
          : undefined;
        
        if (restaurantId) {
          await storage.updateSubscriptionByRestaurantId(restaurantId, {
            status: 'canceled'
          });
        }
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = data.object as Stripe.Invoice;
        // Handle successful payment - update subscription status
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const restaurantId = subscription.metadata.restaurantId
            ? parseInt(subscription.metadata.restaurantId)
            : undefined;
          
          if (restaurantId) {
            await storage.updateSubscriptionByRestaurantId(restaurantId, {
              status: 'active'
            });
          }
        }
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = data.object as Stripe.Invoice;
        // Handle failed payment - update subscription status
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const restaurantId = subscription.metadata.restaurantId
            ? parseInt(subscription.metadata.restaurantId)
            : undefined;
          
          if (restaurantId) {
            await storage.updateSubscriptionByRestaurantId(restaurantId, {
              status: 'past_due'
            });
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error(`Error handling webhook event ${type}:`, error);
    throw error;
  }
};
