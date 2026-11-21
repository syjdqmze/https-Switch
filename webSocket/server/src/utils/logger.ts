export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LoggerOptions {
  level?: LogLevel;
  timestamp?: boolean;
  colorize?: boolean;
}

export class Logger {
  private level: LogLevel;
  private timestamp: boolean;
  private colorize: boolean;

  private colors: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: '\x1b[36m',
    [LogLevel.INFO]: '\x1b[32m',
    [LogLevel.WARN]: '\x1b[33m',
    [LogLevel.ERROR]: '\x1b[31m'
  };

  private resetColor = '\x1b[0m';

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || LogLevel.INFO;
    this.timestamp = options.timestamp !== false;
    this.colorize = options.colorize !== false;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    let result = '';
    
    if (this.timestamp) {
      result += `[${new Date().toISOString()}] `;
    }
    
    const color = this.colorize ? this.colors[level] : '';
    result += `${color}[${level}]${this.colorize ? this.resetColor : ''} ${message}`;
    
    if (args.length > 0) {
      try {
        result += ' ' + JSON.stringify(args);
      } catch {
        result += ' ' + args.map(a => String(a)).join(', ');
      }
    }
    
    return result;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(LogLevel.DEBUG, message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, ...args));
    }
  }
}

export const logger = new Logger();
