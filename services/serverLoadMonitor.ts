/**
 * Server Load Monitor
 * Monitors system resources like CPU, memory, and provides load metrics
 * for dynamic batch size adjustment
 */

import { EventEmitter } from 'events';
import * as os from 'os';

export interface ServerLoadMetrics {
  cpuUsage: number; // Percentage (0-100)
  memoryUsage: number; // Percentage (0-100)
  loadAverage: number; // 1-minute load average
  activeConnections?: number; // Optional external metric
  timestamp: Date;
}

export interface LoadMonitorConfig {
  pollingInterval: number; // milliseconds
  enableLogging: boolean;
  cpuSampleDuration: number; // milliseconds for CPU sampling
}

export class ServerLoadMonitor extends EventEmitter {
  private config: LoadMonitorConfig;
  private intervalId?: NodeJS.Timeout;
  private isRunning: boolean = false;
  private lastMetrics?: ServerLoadMetrics;

  constructor(config: Partial<LoadMonitorConfig> = {}) {
    super();
    this.config = {
      pollingInterval: config.pollingInterval ?? 5000, // 5 seconds default
      enableLogging: config.enableLogging ?? false,
      cpuSampleDuration: config.cpuSampleDuration ?? 1000 // 1 second default
    };
  }

  /**
   * Start monitoring server load
   */
  public start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, this.config.pollingInterval);

    // Collect initial metrics
    this.collectMetrics();

    if (this.config.enableLogging) {
      console.log('[ServerLoadMonitor] Started monitoring server load');
    }
  }

  /**
   * Stop monitoring server load
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    if (this.config.enableLogging) {
      console.log('[ServerLoadMonitor] Stopped monitoring server load');
    }
  }

  /**
   * Get current server load metrics
   */
  public getCurrentMetrics(): ServerLoadMetrics | null {
    return this.lastMetrics || null;
  }

  /**
   * Get server load as a single value (0-100)
   * Weighted average of CPU and memory usage
   */
  public getServerLoad(): number {
    if (!this.lastMetrics) {
      return 50; // Default moderate load if no metrics available
    }

    // Weighted average: 60% CPU, 40% memory
    return Math.round(
      (this.lastMetrics.cpuUsage * 0.6) + (this.lastMetrics.memoryUsage * 0.4)
    );
  }

  /**
   * Collect current system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const cpuUsage = await this.getCPUUsage();
      const memoryUsage = this.getMemoryUsage();
      const loadAverage = this.getLoadAverage();

      const metrics: ServerLoadMetrics = {
        cpuUsage,
        memoryUsage,
        loadAverage,
        timestamp: new Date()
      };

      this.lastMetrics = metrics;
      this.emit('metrics', metrics);

      if (this.config.enableLogging) {
        console.log('[ServerLoadMonitor] Metrics:', {
          cpu: `${cpuUsage.toFixed(1)}%`,
          memory: `${memoryUsage.toFixed(1)}%`,
          load: loadAverage.toFixed(2),
          serverLoad: this.getServerLoad()
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.config.enableLogging) {
        console.error('[ServerLoadMonitor] Error collecting metrics:', errorMessage);
      }
      this.emit('error', error);
    }
  }

  /**
   * Get CPU usage percentage
   */
  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startTime = process.hrtime.bigint();
      const startUsage = process.cpuUsage();

      setTimeout(() => {
        const endTime = process.hrtime.bigint();
        const endUsage = process.cpuUsage(startUsage);

        const elapsedTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        const cpuTime = (endUsage.user + endUsage.system) / 1000; // Convert to milliseconds

        const cpuUsage = Math.min(100, Math.max(0, (cpuTime / elapsedTime) * 100));
        resolve(cpuUsage);
      }, this.config.cpuSampleDuration);
    });
  }

  /**
   * Get memory usage percentage
   */
  private getMemoryUsage(): number {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    return (usedMemory / totalMemory) * 100;
  }

  /**
   * Get 1-minute load average
   */
  private getLoadAverage(): number {
    const loadAvgs = os.loadavg();
    return loadAvgs[0]; // 1-minute load average
  }

  /**
   * Set external connection count (for more accurate load calculation)
   */
  public setActiveConnections(count: number): void {
    if (this.lastMetrics) {
      this.lastMetrics.activeConnections = count;
    }
  }
}