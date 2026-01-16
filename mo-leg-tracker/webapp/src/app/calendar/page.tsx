'use client';

import { useMemo } from 'react';
import legislativeData from '@/data/legislative-data';
import { CalendarView } from '@/components/calendar/CalendarView';
import { Calendar, Info } from 'lucide-react';

export default function CalendarPage() {
  const allEvents = useMemo(() => {
    // Get events for the whole year
    const startOfYear = '2026-01-01';
    const endOfYear = '2026-12-31';
    return legislativeData.getCalendarEvents(startOfYear, endOfYear);
  }, []);

  const upcomingHearings = legislativeData.getUpcomingHearings();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Calendar className="w-8 h-8 mr-3" />
          Legislative Calendar
        </h1>
        <p className="text-gray-600 mt-2">
          Track committee hearings, floor sessions, and important deadlines
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-mo-gold text-mo-navy rounded-xl p-4">
          <p className="text-sm opacity-80">Upcoming Hearings</p>
          <p className="text-3xl font-bold">{upcomingHearings.length}</p>
        </div>
        <div className="bg-mo-navy text-white rounded-xl p-4">
          <p className="text-sm opacity-80">Total Events</p>
          <p className="text-3xl font-bold">{allEvents.length}</p>
        </div>
        <div className="bg-mo-blue text-white rounded-xl p-4">
          <p className="text-sm opacity-80">Session Status</p>
          <p className="text-xl font-bold">In Session</p>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Calendar Legend</span>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center">
            <span className="w-4 h-4 rounded bg-mo-gold/20 border border-mo-gold mr-2" />
            <span>Committee Hearing</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded bg-mo-blue/20 border border-mo-blue mr-2" />
            <span>Floor Session</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded bg-mo-red/20 border border-mo-red mr-2" />
            <span>Deadline</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded bg-mo-gold border border-mo-gold mr-2" />
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <CalendarView events={allEvents} />

      {/* Key Session Dates */}
      <div className="mt-8 bg-mo-cream rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Key Session Dates - 2026
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">Session Begins</p>
            <p className="font-semibold">January 8, 2026</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">Bill Filing Deadline</p>
            <p className="font-semibold">March 1, 2026</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">Committee Deadline</p>
            <p className="font-semibold">April 15, 2026</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">Last Day for House Bills</p>
            <p className="font-semibold">May 1, 2026</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">Last Day for Senate Bills</p>
            <p className="font-semibold">May 8, 2026</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">Session Ends</p>
            <p className="font-semibold">May 30, 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}
