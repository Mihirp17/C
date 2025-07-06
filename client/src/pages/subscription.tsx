import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle } from 'lucide-react';

interface Subscription {
  id: number;
  status: string;
  plan: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export default function SubscriptionPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useQuery<Subscription>({
    queryKey: ['subscription', restaurantId],
    queryFn: async () => {
      const response = await fetch(`/api/restaurants/${restaurantId}/subscription`);
      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }
      return response.json();
    },
    enabled: !!restaurantId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          onClick={() => navigate(`/restaurant/${restaurantId}`)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold">Subscription Management</h1>
      </div>

      <Alert className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Stripe payment integration has been removed. Subscription management is now handled through alternative methods.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Current Subscription</CardTitle>
          <CardDescription>
            Manage your restaurant's subscription plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">Plan</h3>
                  <p className="text-sm text-gray-600 capitalize">{subscription.plan}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Status</h3>
                  <p className="text-sm text-gray-600 capitalize">{subscription.status}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">Current Period Start</h3>
                  <p className="text-sm text-gray-600">
                    {new Date(subscription.currentPeriodStart).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold">Current Period End</h3>
                  <p className="text-sm text-gray-600">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600">No active subscription found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
