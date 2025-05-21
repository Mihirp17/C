import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Link } from "wouter";
import { getInitials } from "@/lib/utils";

interface SidebarProps {
  active: string;
}

export function Sidebar({ active }: SidebarProps) {
  const { user, logout } = useAuth();

  // Menu items for restaurant admin
  const restaurantMenuItems = [
    { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
    { label: "Menu Management", href: "/menu-management", icon: "restaurant_menu" },
    { label: "Tables", href: "/tables", icon: "table_bar" },
    { label: "Orders", href: "/orders", icon: "receipt_long" },
    { label: "Analytics", href: "/analytics", icon: "bar_chart" },
    { label: "Settings", href: "/settings", icon: "settings" },
  ];

  // Menu items for admin section
  const adminMenuItems = [
    { label: "Dashboard", href: "/admin", icon: "dashboard" },
    { label: "Restaurants", href: "/admin/restaurants", icon: "storefront" },
    { label: "Subscriptions", href: "/admin/subscriptions", icon: "payments" },
    { label: "Settings", href: "/admin/settings", icon: "settings" },
  ];

  const menuItems = user?.role === 'platform_admin' ? adminMenuItems : restaurantMenuItems;

  const secondaryMenuItems = [
    { label: "Subscription", href: "/subscription", icon: "credit_card" },
    { label: "Support", href: "/support", icon: "support_agent" },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-brand">FoodieManager</h2>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                active === item.href
                  ? "bg-brand text-white"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              <span className="material-icons mr-3 text-sm">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
        
        {user?.role === 'restaurant' && (
          <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="px-4 py-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Your Restaurant</p>
            </div>
            {secondaryMenuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                  active === item.href
                    ? "bg-brand text-white"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                <span className="material-icons mr-3 text-sm">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white">
            {user ? getInitials(user.name) : "U"}
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium">{user?.name || "User"}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role === 'platform_admin' ? 'Admin' : 'Manager'}</p>
          </div>
          <div className="ml-auto flex items-center space-x-2">
            <ThemeToggle />
            <button onClick={() => logout()} className="text-gray-500 dark:text-gray-400">
              <span className="material-icons">logout</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
