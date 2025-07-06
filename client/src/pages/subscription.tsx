import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function Subscription() {
  return (
    <Layout
      title="Subscription Management"
      description="Manage your restaurant subscription plan"
      requireAuth
      allowedRoles={['restaurant']}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Subscription management is currently not available. All features are accessible for free during this period.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
