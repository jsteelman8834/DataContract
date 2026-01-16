'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'blue' | 'red' | 'gold' | 'navy' | 'green';
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  trend,
}: StatsCardProps) {
  const colorClasses = {
    blue: 'bg-mo-blue text-white',
    red: 'bg-mo-red text-white',
    gold: 'bg-mo-gold text-mo-navy',
    navy: 'bg-mo-navy text-white',
    green: 'bg-green-600 text-white',
  };

  const iconBgClasses = {
    blue: 'bg-mo-blue-light',
    red: 'bg-mo-red-light',
    gold: 'bg-mo-gold-light',
    navy: 'bg-mo-blue',
    green: 'bg-green-500',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              'text-sm mt-2 flex items-center',
              trend.positive ? 'text-green-600' : 'text-mo-red'
            )}>
              <span className="font-medium">
                {trend.positive ? '+' : ''}{trend.value}
              </span>
              <span className="ml-1 text-gray-500">{trend.label}</span>
            </p>
          )}
        </div>
        <div className={cn(
          'p-3 rounded-lg',
          colorClasses[color]
        )}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

interface StatsGridProps {
  stats: Omit<StatsCardProps, 'icon'>[];
  icons: LucideIcon[];
}

export function StatsGrid({ stats, icons }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <StatsCard
          key={stat.title}
          {...stat}
          icon={icons[index] || icons[0]}
        />
      ))}
    </div>
  );
}
