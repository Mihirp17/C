import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Stripe imports
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

// Payment form component
const PaymentForm = ({ clientSecret, onSuccess }: { clientSecret: string, onSuccess: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { error: paymentError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/subscription',
        },
        redirect: 'if_required'
      });

      if (paymentError) {
        setError(paymentError.message || 'An error occurred with your payment');
      } else {
        toast({
          title: "Payment Successful",
          description: "Your subscription is now active",
        });
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred with your payment');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <PaymentElement />
      
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing} 
        className="w-full bg-brand hover:bg-red-700 text-white"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center">
            <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
            Processing...
          </span>
        ) : (
          "Subscribe Now"
        )}
      </Button>
    </form>
  );
};

const PlanCard = ({ 
  name, 
  price, 
  features, 
  isCurrentPlan, 
  onSelect, 
  disabled 
}: { 
  name: string, 
  price: string, 
  features: string[], 
  isCurrentPlan?: boolean, 
  onSelect: () => void, 
  disabled?: boolean 
}) => {
  return (
    <Card className={`${isCurrentPlan ? 'border-brand' : ''}`}>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <div className="mt-2">
          <span className="text-3xl font-bold">${price}</span>
          <span className="text-gray-500 dark:text-gray-400">/month</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={onSelect} 
          className={`w-full ${isCurrentPlan ? 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300' : 'bg-brand hover:bg-red-700 text-white'}`}
          disabled={isCurrentPlan || disabled}
        >
          {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default function Subscription() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId;
  const { toast } = useToast();
  
  const [subscription, setSubscription] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  
  // Fetch subscription details
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!restaurantId) return;
      
      try {
        const response = await fetch(`/api/restaurants/${restaurantId}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const restaurant = await response.json();
          
          // Check if restaurant has subscription relation
          if (restaurant.subscription) {
            setSubscription(restaurant.subscription);
          }
        }
      } catch (error) {
        console.error("Error fetching subscription details:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSubscription();
  }, [restaurantId]);
  
  // Initialize payment when plan is selected
  const handlePlanSelect = async (planId: string) => {
    if (!restaurantId) return;
    
    try {
      const response = await apiRequest("POST", `/api/restaurants/${restaurantId}/subscription`, {
        planId
      });
      
      const data = await response.json();
      setClientSecret(data.clientSecret);
      setSelectedPlan(planId);
    } catch (error) {
      console.error("Error initializing subscription:", error);
      toast({
        title: "Error",
        description: "Failed to initialize subscription",
        variant: "destructive"
      });
    }
  };
  
  // Reset payment form after successful payment
  const handlePaymentSuccess = () => {
    setClientSecret(null);
    setSelectedPlan(null);
    
    // Refetch subscription details
    if (restaurantId) {
      setIsLoading(true);
      fetch(`/api/restaurants/${restaurantId}`, {
        credentials: 'include'
      })
        .then(response => response.json())
        .then(restaurant => {
          if (restaurant.subscription) {
            setSubscription(restaurant.subscription);
          }
        })
        .catch(error => {
          console.error("Error fetching updated subscription details:", error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  };
  
  // Define plans
  const plans = [
    {
      id: "price_placeholder_basic",
      name: "Basic",
      price: isAnnual ? "24.99" : "29.99",
      features: [
        "Up to 50 menu items",
        "Up to 10 tables",
        "Basic analytics",
        "Email support"
      ]
    },
    {
      id: "price_placeholder_premium",
      name: "Premium",
      price: isAnnual ? "41.99" : "49.99",
      features: [
        "Unlimited menu items",
        "Up to 30 tables",
        "Advanced analytics",
        "Priority email support",
        "Custom QR code branding"
      ]
    },
    {
      id: "price_placeholder_enterprise",
      name: "Enterprise",
      price: isAnnual ? "83.99" : "99.99",
      features: [
        "Unlimited everything",
        "24/7 phone support",
        "Custom branding",
        "API access",
        "Dedicated account manager"
      ]
    }
  ];

  return (
    <Layout
      title="Subscription Management"
      description="Manage your restaurant subscription plan"
      requireAuth
      allowedRoles={['restaurant']}
    >
      <div className="space-y-6">
        {/* Current Subscription Status */}
        {!isLoading && (
          <>
            {subscription ? (
              <Card>
                <CardHeader>
                  <CardTitle>Current Subscription</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Plan</p>
                      <p className="font-medium">{subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                      <p className="font-medium">
                        {subscription.status === "active" ? (
                          <span className="text-green-600 dark:text-green-400">Active</span>
                        ) : subscription.status === "cancelled" ? (
                          <span className="text-red-600 dark:text-red-400">Cancelled</span>
                        ) : (
                          <span className="text-yellow-600 dark:text-yellow-400">Past Due</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Billing Period Start</p>
                      <p className="font-medium">{formatDate(subscription.currentPeriodStart)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Billing Period End</p>
                      <p className="font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="mr-2">
                    View Billing History
                  </Button>
                  {subscription.status === "active" && (
                    <Button variant="destructive">
                      Cancel Subscription
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <AlertDescription>
                  You don't have an active subscription yet. Choose a plan below to get started.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* Plan Selection */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Subscription Plans
            </h3>
            <div className="flex items-center space-x-2">
              <span className={`text-sm ${!isAnnual ? 'font-medium' : ''}`}>Monthly</span>
              <Switch
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
                id="billing-toggle"
              />
              <span className={`text-sm ${isAnnual ? 'font-medium' : ''}`}>Annual (Save 20%)</span>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  name={plan.name}
                  price={plan.price}
                  features={plan.features}
                  isCurrentPlan={subscription?.plan.toLowerCase() === plan.name.toLowerCase()}
                  onSelect={() => handlePlanSelect(plan.id)}
                  disabled={!!clientSecret}
                />
              ))}
            </div>
          )}
        </div>

        {/* Payment Form */}
        {clientSecret && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
              <CardDescription>
                Complete your subscription by providing your payment details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Elements
                stripe={stripePromise}
                options={{ clientSecret }}
              >
                <PaymentForm 
                  clientSecret={clientSecret}
                  onSuccess={handlePaymentSuccess}
                />
              </Elements>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
