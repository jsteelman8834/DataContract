/**
 * Sync Scheduler
 *
 * Main scheduler module using node-cron for automated sync jobs
 */

import * as cron from 'node-cron';
import { schedules, getEnabledSchedules, type ScheduleConfig } from './schedules';
import { runJob, getJobHistory, getRunningJobs, type JobResult } from './job-runner';
import { syncLogger as logger } from '../utils/logger';
import { fullSync, incrementalSync, syncBills } from '../index';
import { syncHearingsOnly, syncStaticData } from '../sync-partial';
import { detectAndStoreEvents } from '../events/detector';
import { dispatchPendingWebhooks } from '../webhooks/dispatcher';

// Store scheduled tasks for cleanup
const scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

// Scheduler state
let isRunning = false;

/**
 * Start the scheduler with all enabled jobs
 */
export function startScheduler(): void {
  if (isRunning) {
    logger.warn('Scheduler is already running');
    return;
  }

  logger.info('Starting sync scheduler...');

  const enabledSchedules = getEnabledSchedules();

  for (const schedule of enabledSchedules) {
    scheduleJob(schedule);
  }

  isRunning = true;
  logger.info(`Scheduler started with ${enabledSchedules.length} jobs`, {
    jobs: enabledSchedules.map(s => s.name),
  });
}

/**
 * Stop the scheduler and all jobs
 */
export function stopScheduler(): void {
  if (!isRunning) {
    logger.warn('Scheduler is not running');
    return;
  }

  logger.info('Stopping sync scheduler...');

  for (const [name, task] of scheduledTasks) {
    task.stop();
    logger.info(`Stopped job: ${name}`);
  }

  scheduledTasks.clear();
  isRunning = false;
  logger.info('Scheduler stopped');
}

/**
 * Schedule a single job
 */
function scheduleJob(schedule: ScheduleConfig): void {
  if (scheduledTasks.has(schedule.name)) {
    logger.warn(`Job ${schedule.name} is already scheduled`);
    return;
  }

  const task = cron.schedule(schedule.cronExpression, async () => {
    await executeJob(schedule);
  });

  scheduledTasks.set(schedule.name, task);
  logger.info(`Scheduled job: ${schedule.name}`, {
    cron: schedule.cronExpression,
    type: schedule.type,
    priority: schedule.priority,
  });
}

/**
 * Execute a job based on its type
 */
async function executeJob(schedule: ScheduleConfig): Promise<JobResult> {
  return runJob(schedule.name, schedule.type, async () => {
    let stats: Record<string, number> = {};

    switch (schedule.type) {
      case 'full':
        const fullResult = await fullSync();
        stats = {
          houseBills: fullResult.houseBills.total,
          senateBills: fullResult.senateBills.total,
          members: fullResult.members.total,
          committees: fullResult.committees.total,
        };
        break;

      case 'incremental':
        const incResult = await incrementalSync();
        stats = {
          houseBillsUpdated: incResult.houseBills.updated,
          senateBillsUpdated: incResult.senateBills.updated,
          hearingsUpdated: incResult.hearings.updated,
        };
        break;

      case 'bills-only':
        const billsResult = await incrementalSync();
        stats = {
          houseBills: billsResult.houseBills.total,
          senateBills: billsResult.senateBills.total,
        };
        break;

      case 'hearings-only':
        const hearingsStats = await syncHearingsOnly();
        stats = hearingsStats;
        break;

      case 'static':
        const staticStats = await syncStaticData();
        stats = staticStats;
        break;
    }

    // After sync, detect events and dispatch webhooks
    await detectAndStoreEvents();
    await dispatchPendingWebhooks();

    return stats;
  });
}

/**
 * Manually trigger a job by name
 */
export async function triggerJob(name: string): Promise<JobResult | null> {
  const schedule = schedules.find(s => s.name === name);

  if (!schedule) {
    logger.error(`Unknown job: ${name}`);
    return null;
  }

  logger.info(`Manually triggering job: ${name}`);
  return executeJob(schedule);
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  running: boolean;
  scheduledJobs: string[];
  runningJobs: string[];
  recentHistory: JobResult[];
} {
  return {
    running: isRunning,
    scheduledJobs: Array.from(scheduledTasks.keys()),
    runningJobs: getRunningJobs(),
    recentHistory: getJobHistory(10),
  };
}

/**
 * Run scheduler as standalone process
 */
export async function runStandalone(): Promise<void> {
  logger.info('Running scheduler in standalone mode');

  startScheduler();

  // Keep process alive
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down scheduler');
    stopScheduler();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down scheduler');
    stopScheduler();
    process.exit(0);
  });

  // Prevent process from exiting
  await new Promise(() => {});
}

export default {
  startScheduler,
  stopScheduler,
  triggerJob,
  getSchedulerStatus,
  runStandalone,
};
