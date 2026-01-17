/**
 * Structured logger for sync operations
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel = 'info';
  private prefix: string = '';

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private format(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    const prefixStr = this.prefix ? `[${this.prefix}] ` : '';

    let output = `${timestamp} ${levelStr} ${prefixStr}${message}`;

    if (context && Object.keys(context).length > 0) {
      output += ` ${JSON.stringify(context)}`;
    }

    return output;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.format(level, message, context);

    switch (level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  // Create a child logger with a prefix
  child(prefix: string): Logger {
    const child = new Logger(this.prefix ? `${this.prefix}:${prefix}` : prefix);
    child.setLevel(this.level);
    return child;
  }

  // Log a sync operation start
  syncStart(operation: string, context?: Record<string, unknown>): void {
    this.info(`Starting ${operation}`, { operation, ...context });
  }

  // Log a sync operation completion
  syncComplete(operation: string, stats: Record<string, number>, duration: number): void {
    this.info(`Completed ${operation}`, { operation, duration: `${duration}ms`, ...stats });
  }

  // Log a sync operation failure
  syncFailed(operation: string, error: Error, context?: Record<string, unknown>): void {
    this.error(`Failed ${operation}: ${error.message}`, {
      operation,
      error: error.message,
      stack: error.stack,
      ...context,
    });
  }

  // Log record processing
  recordProcessed(type: string, id: string, action: 'created' | 'updated' | 'skipped'): void {
    this.debug(`${action} ${type}`, { type, id, action });
  }

  // Log a batch operation
  batchProgress(current: number, total: number, message?: string): void {
    const percent = Math.round((current / total) * 100);
    this.info(`Progress: ${current}/${total} (${percent}%)${message ? ` - ${message}` : ''}`);
  }
}

// Create loggers for different sync components
export const syncLogger = new Logger('sync');
export const houseLogger = syncLogger.child('house');
export const senateLogger = syncLogger.child('senate');
export const fiscalLogger = syncLogger.child('fiscal');
export const dbLogger = syncLogger.child('database');

export default Logger;
