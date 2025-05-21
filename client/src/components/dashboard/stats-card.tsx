import { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  iconColor: string;
  iconBgClass: string;
  trend?: {
    value: string | number;
    label: string;
    isPositive: boolean;
  };
}

export function StatsCard({ 
  title, 
  value, 
  icon, 
  iconColor, 
  iconBgClass,
  trend 
}: StatsCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
      <div className="flex items-center">
        <div className={`flex-shrink-0 rounded-md ${iconBgClass} p-3`}>
          <span className={`material-icons ${iconColor}`}>{icon}</span>
        </div>
        <div className="ml-5">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
      {trend && (
        <div className="mt-4">
          <div className="flex items-center text-sm">
            <span className={`${trend.isPositive ? 'text-success' : 'text-error'} flex items-center`}>
              <span className="material-icons text-xs mr-1">
                {trend.isPositive ? 'arrow_upward' : 'arrow_downward'}
              </span>
              {trend.value}
            </span>
            <span className="ml-2 text-gray-500 dark:text-gray-400">{trend.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}
