'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { cn, formatTime } from '@/lib/utils';
import type { CalendarEvent } from '@/types';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  FileText,
} from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';

interface CalendarViewProps {
  events: CalendarEvent[];
  onDateSelect?: (date: Date) => void;
}

export function CalendarView({ events, onDateSelect }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const dateKey = event.date;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [events]);

  const selectedDateEvents = selectedDate
    ? eventsByDate.get(format(selectedDate, 'yyyy-MM-dd')) || []
    : [];

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Calendar Header */}
      <div className="bg-mo-navy text-white p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-mo-blue transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2" />
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-mo-blue transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="py-2 text-center text-sm font-semibold text-gray-600"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDate.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const hasEvents = dayEvents.length > 0;

          return (
            <div
              key={index}
              onClick={() => handleDateClick(day)}
              className={cn(
                'calendar-day cursor-pointer transition-colors',
                !isCurrentMonth && 'bg-gray-50 text-gray-400',
                isToday(day) && 'today',
                hasEvents && 'has-events',
                isSelected && 'ring-2 ring-mo-blue ring-inset'
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm',
                    isToday(day) && 'bg-mo-gold text-mo-navy font-bold',
                    isSelected && !isToday(day) && 'bg-mo-blue text-white'
                  )}
                >
                  {format(day, 'd')}
                </span>
                {hasEvents && (
                  <span className="text-xs bg-mo-blue text-white px-1.5 rounded-full">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Event Indicators */}
              {hasEvents && (
                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        'text-xs truncate px-1 py-0.5 rounded',
                        event.type === 'hearing' && 'bg-mo-gold/20 text-mo-navy',
                        event.type === 'floor_session' && 'bg-mo-blue/20 text-mo-blue',
                        event.type === 'deadline' && 'bg-mo-red/20 text-mo-red'
                      )}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-500 px-1">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Date Events */}
      {selectedDate && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <CalendarIcon className="w-4 h-4 mr-2" />
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h3>

          {selectedDateEvents.length === 0 ? (
            <p className="text-gray-500 text-sm">No events scheduled for this date.</p>
          ) : (
            <div className="space-y-3">
              {selectedDateEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface EventCardProps {
  event: CalendarEvent;
}

function EventCard({ event }: EventCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                event.type === 'hearing' && 'bg-mo-gold/20 text-mo-gold-dark',
                event.type === 'floor_session' && 'bg-mo-blue/20 text-mo-blue',
                event.type === 'deadline' && 'bg-mo-red/20 text-mo-red'
              )}
            >
              {event.type.replace('_', ' ').toUpperCase()}
            </span>
            {event.committee && (
              <span className="text-xs text-gray-500">
                {event.committee.shortName}
              </span>
            )}
          </div>
          <h4 className="font-medium text-gray-900">{event.title}</h4>
          <p className="text-sm text-gray-600">{event.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
        <span className="flex items-center">
          <Clock className="w-3 h-3 mr-1" />
          {formatTime(event.time)}
        </span>
        {event.room && (
          <span className="flex items-center">
            <MapPin className="w-3 h-3 mr-1" />
            {event.room}
          </span>
        )}
      </div>

      {/* Bills on agenda */}
      {event.bills && event.bills.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2 flex items-center">
            <FileText className="w-3 h-3 mr-1" />
            Bills on Agenda
          </p>
          <div className="flex flex-wrap gap-2">
            {event.bills.map((bill) => (
              <Link
                key={bill.id}
                href={`/bills/${bill.billNumber.replace(' ', '-').toLowerCase()}`}
                className={cn(
                  'px-2 py-1 rounded text-xs font-medium text-white hover:opacity-80 transition-opacity',
                  bill.chamber === 'senate' ? 'bg-mo-navy' : 'bg-mo-blue'
                )}
              >
                {bill.billNumber}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact calendar for sidebar
interface MiniCalendarProps {
  events: CalendarEvent[];
}

export function MiniCalendar({ events }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const dateKey = event.date;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [events]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1 rounded hover:bg-gray-100"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold">
          {format(currentMonth, 'MMM yyyy')}
        </span>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1 rounded hover:bg-gray-100"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-xs text-gray-500 py-1">
            {day}
          </div>
        ))}
        {calendarDays.map((day, index) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const hasEvents = eventsByDate.has(dateKey);

          return (
            <Link
              key={index}
              href={`/calendar?date=${dateKey}`}
              className={cn(
                'text-xs py-1 rounded transition-colors',
                !isSameMonth(day, currentMonth) && 'text-gray-300',
                isToday(day) && 'bg-mo-gold text-mo-navy font-bold',
                hasEvents && !isToday(day) && 'bg-mo-blue/10 text-mo-blue font-medium',
                'hover:bg-gray-100'
              )}
            >
              {format(day, 'd')}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
