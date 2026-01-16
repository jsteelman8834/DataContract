'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import legislativeData from '@/data/legislative-data';
import { ChamberView } from '@/components/dashboard/ChamberView';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { MiniCalendar } from '@/components/calendar/CalendarView';
import { BillCard } from '@/components/bills/BillCard';
import {
  FileText,
  Users,
  Building2,
  Calendar,
  TrendingUp,
  Clock,
  ChevronRight,
} from 'lucide-react';

export default function DashboardPage() {
  const stats = legislativeData.getStatistics();

  const senateCommittees = useMemo(() => {
    return legislativeData
      .getCommitteesByChamber('senate')
      .map((c) => legislativeData.getCommitteeWithBills(c));
  }, []);

  const houseCommittees = useMemo(() => {
    return legislativeData
      .getCommitteesByChamber('house')
      .map((c) => legislativeData.getCommitteeWithBills(c));
  }, []);

  const recentBills = useMemo(() => {
    return legislativeData
      .getAllBills()
      .sort((a, b) => new Date(b.lastActionDate).getTime() - new Date(a.lastActionDate).getTime())
      .slice(0, 5)
      .map((bill) => legislativeData.getBillCard(bill));
  }, []);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return legislativeData.getCalendarEvents(
      today.toISOString().split('T')[0],
      thirtyDaysFromNow.toISOString().split('T')[0]
    );
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Missouri Legislative Dashboard
        </h1>
        <p className="text-gray-600 mt-2">
          103rd General Assembly - 2026 Second Regular Session
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Total Bills"
          value={stats.totalBills}
          subtitle={`${stats.houseBills} House, ${stats.senateBills} Senate`}
          icon={FileText}
          color="blue"
        />
        <StatsCard
          title="Committees"
          value={stats.totalCommittees}
          subtitle={`${stats.houseCommittees} House, ${stats.senateCommittees} Senate`}
          icon={Building2}
          color="navy"
        />
        <StatsCard
          title="Legislators"
          value={stats.totalMembers}
          subtitle={`${stats.houseMembers} Reps, ${stats.senateMembers} Senators`}
          icon={Users}
          color="gold"
        />
        <StatsCard
          title="Upcoming Hearings"
          value={stats.upcomingHearings}
          subtitle="Scheduled this month"
          icon={Calendar}
          color="green"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Chamber Views */}
        <div className="lg:col-span-2 space-y-8">
          {/* Chamber Tabs / Views */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Building2 className="w-5 h-5 mr-2" />
                Committees & Bills
              </h2>
              <p className="text-sm text-gray-500">
                Click a committee to see its bills
              </p>
            </div>

            {/* Senate View */}
            <ChamberView chamber="senate" committees={senateCommittees} />

            {/* House View */}
            <ChamberView chamber="house" committees={houseCommittees} />
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Calendar Widget */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Calendar
              </h3>
              <Link
                href="/calendar"
                className="text-sm text-mo-blue hover:underline flex items-center"
              >
                View Full <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <MiniCalendar events={upcomingEvents} />
          </div>

          {/* Recent Activity */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Recent Activity
              </h3>
              <Link
                href="/bills"
                className="text-sm text-mo-blue hover:underline flex items-center"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="space-y-2">
              {recentBills.map((billCard) => (
                <BillCard key={billCard.bill.id} billCard={billCard} compact />
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-mo-navy rounded-xl p-4 text-white">
            <h3 className="font-semibold mb-3 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Quick Links
            </h3>
            <div className="space-y-2">
              <Link
                href="/bills?status=hearing_scheduled"
                className="block px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
              >
                Bills with Upcoming Hearings
              </Link>
              <Link
                href="/bills?chamber=senate"
                className="block px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
              >
                Senate Bills
              </Link>
              <Link
                href="/bills?chamber=house"
                className="block px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
              >
                House Bills
              </Link>
              <Link
                href="/members"
                className="block px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
              >
                Find Your Representative
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
