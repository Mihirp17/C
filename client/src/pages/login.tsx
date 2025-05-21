import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, isLoginPending } = useAuth();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      const user = await login(email, password);
      
      // Redirect based on user role
      if (user.role === 'platform_admin') {
        navigate('/admin');
      } else if (user.role === 'restaurant') {
        navigate('/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || "Failed to login. Please check your credentials.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold text-brand">FoodieManager</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="your@email.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-xs text-brand hover:underline">
                  Forgot password?
                </a>
              </div>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-brand hover:bg-red-700 text-white"
              disabled={isLoginPending}
            >
              {isLoginPending ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="justify-center text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Don't have an account?{" "}
            <a href="/register" className="text-brand hover:underline">
              Register
            </a>
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
