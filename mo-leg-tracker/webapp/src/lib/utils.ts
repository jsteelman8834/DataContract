import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

export function getDaysAgo(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getPartyColor(party: 'R' | 'D' | 'I'): string {
  switch (party) {
    case 'R':
      return 'bg-mo-red text-white';
    case 'D':
      return 'bg-mo-blue text-white';
    case 'I':
      return 'bg-mo-gold text-mo-navy';
    default:
      return 'bg-gray-500 text-white';
  }
}

export function getPartyBorderColor(party: 'R' | 'D' | 'I'): string {
  switch (party) {
    case 'R':
      return 'border-mo-red';
    case 'D':
      return 'border-mo-blue';
    case 'I':
      return 'border-mo-gold';
    default:
      return 'border-gray-500';
  }
}

export function getChamberColor(chamber: 'house' | 'senate'): string {
  return chamber === 'senate' ? 'bg-mo-navy' : 'bg-mo-blue';
}

export function getChamberBorderColor(chamber: 'house' | 'senate'): string {
  return chamber === 'senate' ? 'border-mo-navy' : 'border-mo-blue';
}

export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    prefiled: 'bg-gray-400',
    introduced: 'bg-mo-blue-light',
    first_read: 'bg-mo-blue-light',
    second_read: 'bg-mo-blue',
    referred: 'bg-mo-gold',
    in_committee: 'bg-mo-gold',
    hearing_scheduled: 'bg-mo-gold-light',
    hearing_held: 'bg-mo-gold-dark',
    committee_substitute: 'bg-amber-500',
    reported_do_pass: 'bg-green-500',
    reported_do_not_pass: 'bg-mo-red',
    placed_on_calendar: 'bg-green-400',
    perfected: 'bg-green-600',
    third_read: 'bg-green-600',
    passed_chamber: 'bg-emerald-500',
    referred_other_chamber: 'bg-purple-500',
    passed_second_chamber: 'bg-emerald-600',
    conference_committee: 'bg-purple-600',
    truly_agreed: 'bg-emerald-700',
    sent_to_governor: 'bg-indigo-500',
    signed: 'bg-green-700',
    vetoed: 'bg-mo-red-dark',
    veto_overridden: 'bg-green-800',
    enacted: 'bg-green-800',
    failed: 'bg-gray-600',
    tabled: 'bg-gray-500',
    withdrawn: 'bg-gray-400',
  };
  return statusColors[status] || 'bg-gray-500';
}

export function getBillTypeLabel(prefix: string): string {
  const labels: Record<string, string> = {
    HB: 'House Bill',
    SB: 'Senate Bill',
    HJR: 'House Joint Resolution',
    SJR: 'Senate Joint Resolution',
    HCR: 'House Concurrent Resolution',
    SCR: 'Senate Concurrent Resolution',
    HR: 'House Resolution',
    SR: 'Senate Resolution',
  };
  return labels[prefix] || prefix;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
