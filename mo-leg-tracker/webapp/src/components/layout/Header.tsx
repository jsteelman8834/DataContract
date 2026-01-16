'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  FileText,
  Users,
  Building2,
  Calendar,
  Search,
  Menu,
  X,
  DollarSign,
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Bills', href: '/bills', icon: FileText },
  { name: 'Fiscal', href: '/fiscal', icon: DollarSign },
  { name: 'Committees', href: '/committees', icon: Building2 },
  { name: 'Members', href: '/members', icon: Users },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
];

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-mo-navy text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-mo-gold rounded-full flex items-center justify-center">
              <span className="text-mo-navy font-bold text-lg">MO</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold">Missouri Legislative Tracker</h1>
              <p className="text-xs text-gray-300">103rd General Assembly</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-mo-blue text-white'
                      : 'text-gray-200 hover:bg-mo-blue/50 hover:text-white'
                  )}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Search and Mobile Menu Button */}
          <div className="flex items-center space-x-2">
            <button className="p-2 rounded-lg hover:bg-mo-blue/50 transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <button
              className="md:hidden p-2 rounded-lg hover:bg-mo-blue/50 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-mo-blue">
          <nav className="px-4 py-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-mo-blue text-white'
                      : 'text-gray-200 hover:bg-mo-blue/50 hover:text-white'
                  )}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
