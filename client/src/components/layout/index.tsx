import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileMenu } from "./mobile-menu";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface LayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  requireAuth?: boolean;
  allowedRoles?: string[];
}

export function Layout({ 
  children, 
  title, 
  description, 
  requireAuth = true,
  allowedRoles = []
}: LayoutProps) {
  const [location, navigate] = useLocation();
  const { user, loading } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);
  
  useEffect(() => {
    // Authentication and authorization logic
    if (loading) return;
    
    if (requireAuth && !user) {
      navigate("/login");
    } else if (user && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      if (user.role === 'platform_admin') {
        navigate("/admin");
      } else if (user.role === 'restaurant') {
        navigate("/dashboard");
      }
    }
    setAuthChecked(true);
  }, [loading, user, requireAuth, allowedRoles, navigate]);

  // Show loading state
  if (loading || !authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  // Don't render the protected content if auth check failed
  if ((requireAuth && !user) || 
      (user && allowedRoles.length > 0 && !allowedRoles.includes(user.role))) {
    return null;
  }

  // Main layout
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar (desktop only) */}
      <Sidebar active={location} />

      {/* Mobile Menu */}
      <MobileMenu active={location} />

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Main Content Scrollable Area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
          {/* Page header */}
          {(title || description) && (
            <div className="mb-6">
              {title && <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>}
              {description && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>}
            </div>
          )}
          
          {/* Page content */}
          {children}
        </main>
      </div>
    </div>
  );
}
