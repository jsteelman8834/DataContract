/**
 * Sync Schedule Configuration
 *
 * Defines the cron schedules for different sync job types
 */

export interface ScheduleConfig {
  name: string;
  cronExpression: string;
  type: SyncJobType;
  priority: 'high' | 'medium' | 'low';
  enabled: boolean;
  description: string;
}

export type SyncJobType =
  | 'full'
  | 'incremental'
  | 'bills-only'
  | 'hearings-only'
  | 'static';

/**
 * Schedule configuration
 *
 * Cron format: second minute hour dayOfMonth month dayOfWeek
 * For node-cron (no seconds): minute hour dayOfMonth month dayOfWeek
 */
export const schedules: ScheduleConfig[] = [
  {
    name: 'actions-status',
    cronExpression: '*/15 9-17 * * 1-5', // Every 15 min, 9am-5pm, Mon-Fri
    type: 'incremental',
    priority: 'high',
    enabled: true,
    description: 'Check for bill actions and status changes during business hours',
  },
  {
    name: 'bill-list',
    cronExpression: '0 * * * *', // Hourly
    type: 'bills-only',
    priority: 'medium',
    enabled: true,
    description: 'Refresh bill list for new introductions',
  },
  {
    name: 'hearings',
    cronExpression: '0 8,16 * * *', // 8am and 4pm daily
    type: 'hearings-only',
    priority: 'medium',
    enabled: true,
    description: 'Sync hearing schedule twice daily',
  },
  {
    name: 'full-sync',
    cronExpression: '0 2 * * *', // 2am daily
    type: 'full',
    priority: 'low',
    enabled: true,
    description: 'Complete database refresh overnight',
  },
  {
    name: 'members-committees',
    cronExpression: '0 3 * * 0', // Sunday 3am
    type: 'static',
    priority: 'low',
    enabled: true,
    description: 'Refresh member and committee data weekly',
  },
];

/**
 * Get schedule by name
 */
export function getSchedule(name: string): ScheduleConfig | undefined {
  return schedules.find(s => s.name === name);
}

/**
 * Get all enabled schedules
 */
export function getEnabledSchedules(): ScheduleConfig[] {
  return schedules.filter(s => s.enabled);
}

/**
 * Get schedules by priority
 */
export function getSchedulesByPriority(priority: ScheduleConfig['priority']): ScheduleConfig[] {
  return schedules.filter(s => s.priority === priority && s.enabled);
}

export default schedules;
