/**
 * Job Runner
 *
 * Executes sync jobs with error handling, retries, and metrics
 */

import { syncLogger as logger } from '../utils/logger';
import { type SyncJobType } from './schedules';

export interface JobResult {
  jobId: string;
  name: string;
  type: SyncJobType;
  status: 'success' | 'failed' | 'skipped';
  startTime: Date;
  endTime: Date;
  duration: number;
  error?: string;
  stats?: Record<string, number>;
}

export interface JobContext {
  jobId: string;
  name: string;
  type: SyncJobType;
  startTime: Date;
}

// Track running jobs to prevent overlaps
const runningJobs = new Set<string>();

// Job execution history for metrics
const jobHistory: JobResult[] = [];
const MAX_HISTORY_SIZE = 100;

/**
 * Run a job with proper lifecycle management
 */
export async function runJob(
  name: string,
  type: SyncJobType,
  executor: () => Promise<Record<string, number> | void>
): Promise<JobResult> {
  const jobId = `${name}-${Date.now()}`;
  const startTime = new Date();

  // Check if job is already running
  if (runningJobs.has(name)) {
    logger.warn(`Job ${name} is already running, skipping`);
    return {
      jobId,
      name,
      type,
      status: 'skipped',
      startTime,
      endTime: new Date(),
      duration: 0,
    };
  }

  runningJobs.add(name);
  logger.info(`Starting job: ${name}`, { jobId, type });

  try {
    const stats = await executor();
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const result: JobResult = {
      jobId,
      name,
      type,
      status: 'success',
      startTime,
      endTime,
      duration,
      stats: stats ?? undefined,
    };

    addToHistory(result);
    logger.info(`Job completed: ${name}`, { jobId, duration, stats });

    return result;
  } catch (error) {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const result: JobResult = {
      jobId,
      name,
      type,
      status: 'failed',
      startTime,
      endTime,
      duration,
      error: (error as Error).message,
    };

    addToHistory(result);
    logger.error(`Job failed: ${name}`, { jobId, error: (error as Error).message });

    return result;
  } finally {
    runningJobs.delete(name);
  }
}

/**
 * Add result to history with size limit
 */
function addToHistory(result: JobResult): void {
  jobHistory.unshift(result);
  if (jobHistory.length > MAX_HISTORY_SIZE) {
    jobHistory.pop();
  }
}

/**
 * Get job history
 */
export function getJobHistory(limit: number = 20): JobResult[] {
  return jobHistory.slice(0, limit);
}

/**
 * Get the last result for a job name
 */
export function getLastJobResult(name: string): JobResult | undefined {
  return jobHistory.find(j => j.name === name);
}

/**
 * Check if a job is currently running
 */
export function isJobRunning(name: string): boolean {
  return runningJobs.has(name);
}

/**
 * Get all running job names
 */
export function getRunningJobs(): string[] {
  return Array.from(runningJobs);
}

/**
 * Calculate job metrics
 */
export function getJobMetrics(name?: string): {
  totalRuns: number;
  successRate: number;
  avgDuration: number;
  lastRun: Date | null;
} {
  const jobs = name ? jobHistory.filter(j => j.name === name) : jobHistory;

  if (jobs.length === 0) {
    return {
      totalRuns: 0,
      successRate: 0,
      avgDuration: 0,
      lastRun: null,
    };
  }

  const successful = jobs.filter(j => j.status === 'success').length;
  const totalDuration = jobs.reduce((sum, j) => sum + j.duration, 0);

  return {
    totalRuns: jobs.length,
    successRate: successful / jobs.length,
    avgDuration: totalDuration / jobs.length,
    lastRun: jobs[0]?.startTime || null,
  };
}

export default {
  runJob,
  getJobHistory,
  getLastJobResult,
  isJobRunning,
  getRunningJobs,
  getJobMetrics,
};
