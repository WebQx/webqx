/**
 * WebQX™ Telehealth - Network Monitor
 * 
 * Real-time network condition monitoring for adaptive streaming
 * and intelligent fallback mechanisms in low-bandwidth environments.
 */

import {
  NetworkConditions,
  NetworkThresholds,
  NetworkQuality,
  NetworkEvent,
  EventCallback,
  TelehealthError
} from '../types/telehealth.types';

export interface NetworkMonitorConfig {
  /** How often to check network conditions (ms) */
  monitoringIntervalMs: number;
  /** Network quality thresholds */
  thresholds: NetworkThresholds;
  /** Enable connection type detection */
  enableConnectionTypeDetection: boolean;
  /** Enable bandwidth estimation */
  enableBandwidthEstimation: boolean;
  /** Bandwidth test configuration */
  bandwidthTest: {
    /** Test file size in KB */
    testFileSizeKB: number;
    /** Test timeout in ms */
    timeoutMs: number;
    /** Test server URL */
    testServerUrl?: string;
  };
  /** RTT measurement configuration */
  rttTest: {
    /** Test URL for RTT measurement */
    testUrl: string;
    /** Number of pings for average */
    pingCount: number;
  };
}

export class NetworkMonitor {
  private config: NetworkMonitorConfig;
  private currentConditions: NetworkConditions;
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private eventListeners: Map<string, EventCallback<NetworkEvent>[]> = new Map();
  private bandwidthHistory: number[] = [];
  private rttHistory: number[] = [];
  private connectionInfo?: any; // Navigator connection API

  constructor(config: NetworkMonitorConfig) {
    this.config = config;
    this.currentConditions = this.getDefaultConditions();
    this.initializeConnectionDetection();
  }

  /**
   * Start network monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    try {
      // Perform initial network assessment
      await this.assessNetworkConditions();
      
      // Start periodic monitoring
      this.monitoringInterval = setInterval(
        () => this.periodicAssessment(),
        this.config.monitoringIntervalMs
      );

      this.isMonitoring = true;
      
      // Emit monitoring started event
      this.emitEvent({
        type: 'network-monitoring-started',
        timestamp: new Date(),
        sessionId: 'monitor',
        data: this.currentConditions
      });

    } catch (error) {
      throw new TelehealthError(
        `Failed to start network monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'NetworkMonitorError',
          code: 'MONITOR_START_FAILED',
          category: 'network',
          recoverable: true,
          context: { config: this.config }
        }
      );
    }
  }

  /**
   * Stop network monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    this.isMonitoring = false;
    
    this.emitEvent({
      type: 'network-monitoring-stopped',
      timestamp: new Date(),
      sessionId: 'monitor',
      data: this.currentConditions
    });
  }

  /**
   * Get current network conditions
   */
  getCurrentConditions(): NetworkConditions {
    return { ...this.currentConditions };
  }

  /**
   * Get network quality assessment
   */
  getNetworkQuality(): NetworkQuality {
    const bandwidth = this.currentConditions.bandwidthKbps;
    const rtt = this.currentConditions.rttMs;
    const packetLoss = this.currentConditions.packetLossPercent;
    const stability = this.currentConditions.stabilityScore;

    // Disconnected
    if (bandwidth === 0 || stability < 10) {
      return 'disconnected';
    }

    // Poor quality
    if (bandwidth < this.config.thresholds.minBitrateKbps || 
        rtt > 500 || 
        packetLoss > 5 || 
        stability < 30) {
      return 'poor';
    }

    // Fair quality
    if (bandwidth < this.config.thresholds.optimalBitrateKbps || 
        rtt > 200 || 
        packetLoss > 2 || 
        stability < 60) {
      return 'fair';
    }

    // Good quality
    if (bandwidth < this.config.thresholds.maxBitrateKbps || 
        rtt > 100 || 
        packetLoss > 1 || 
        stability < 80) {
      return 'good';
    }

    // Excellent quality
    return 'excellent';
  }

  /**
   * Test current bandwidth
   */
  async testBandwidth(): Promise<number> {
    const testConfig = this.config.bandwidthTest;
    
    try {
      const startTime = performance.now();
      
      // Create a test request to measure bandwidth
      const testUrl = testConfig.testServerUrl || this.generateTestUrl(testConfig.testFileSizeKB);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), testConfig.timeoutMs);
      
      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.arrayBuffer();
      const endTime = performance.now();
      
      const durationMs = endTime - startTime;
      const bytesTransferred = data.byteLength;
      const bitsTransferred = bytesTransferred * 8;
      const bandwidthKbps = (bitsTransferred / 1000) / (durationMs / 1000);
      
      // Update bandwidth history
      this.bandwidthHistory.push(bandwidthKbps);
      if (this.bandwidthHistory.length > 10) {
        this.bandwidthHistory.shift();
      }
      
      return Math.round(bandwidthKbps);
      
    } catch (error) {
      console.warn('Bandwidth test failed:', error);
      // Return last known bandwidth or estimate
      return this.bandwidthHistory.length > 0 
        ? this.bandwidthHistory[this.bandwidthHistory.length - 1]
        : this.estimateBandwidthFromConnection();
    }
  }

  /**
   * Test current RTT (Round Trip Time)
   */
  async testRTT(): Promise<number> {
    const rttConfig = this.config.rttTest;
    const measurements: number[] = [];
    
    try {
      for (let i = 0; i < rttConfig.pingCount; i++) {
        const startTime = performance.now();
        
        await fetch(rttConfig.testUrl, {
          method: 'HEAD',
          cache: 'no-cache',
          mode: 'no-cors'
        });
        
        const endTime = performance.now();
        measurements.push(endTime - startTime);
        
        // Small delay between pings
        if (i < rttConfig.pingCount - 1) {
          await this.delay(100);
        }
      }
      
      // Calculate average RTT
      const avgRTT = measurements.reduce((sum, rtt) => sum + rtt, 0) / measurements.length;
      
      // Update RTT history
      this.rttHistory.push(avgRTT);
      if (this.rttHistory.length > 10) {
        this.rttHistory.shift();
      }
      
      return Math.round(avgRTT);
      
    } catch (error) {
      console.warn('RTT test failed:', error);
      // Return last known RTT or estimate
      return this.rttHistory.length > 0 
        ? this.rttHistory[this.rttHistory.length - 1]
        : this.estimateRTTFromConnection();
    }
  }

  /**
   * Estimate packet loss (simplified implementation)
   */
  async estimatePacketLoss(): Promise<number> {
    // In a real implementation, this would involve more sophisticated
    // packet loss detection. For now, we'll estimate based on stability
    const stability = this.currentConditions.stabilityScore;
    
    if (stability > 90) return 0;
    if (stability > 80) return 0.5;
    if (stability > 70) return 1;
    if (stability > 60) return 2;
    if (stability > 50) return 3;
    if (stability > 40) return 5;
    if (stability > 30) return 8;
    return 10;
  }

  /**
   * Calculate connection stability score
   */
  calculateStabilityScore(): number {
    const bandwidthVariance = this.calculateVariance(this.bandwidthHistory);
    const rttVariance = this.calculateVariance(this.rttHistory);
    
    // Base score from connection type
    let baseScore = this.getConnectionTypeScore();
    
    // Adjust based on variance (lower variance = more stable)
    const bandwidthStability = Math.max(0, 100 - (bandwidthVariance / 100));
    const rttStability = Math.max(0, 100 - (rttVariance / 10));
    
    // Weighted average
    const stabilityScore = (baseScore * 0.4) + (bandwidthStability * 0.3) + (rttStability * 0.3);
    
    return Math.round(Math.max(0, Math.min(100, stabilityScore)));
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: string, callback: EventCallback<NetworkEvent>): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: string, callback: EventCallback<NetworkEvent>): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Check if network conditions support video calling
   */
  supportsVideoCall(minQuality: 'low' | 'medium' | 'high' = 'low'): boolean {
    const bandwidth = this.currentConditions.bandwidthKbps;
    const quality = this.getNetworkQuality();
    
    const thresholds = {
      low: 256,    // 256 Kbps minimum for low quality video
      medium: 512, // 512 Kbps for medium quality
      high: 1024   // 1 Mbps for high quality
    };
    
    return bandwidth >= thresholds[minQuality] && 
           quality !== 'disconnected' && 
           quality !== 'poor';
  }

  /**
   * Check if network conditions support audio calling
   */
  supportsAudioCall(): boolean {
    const bandwidth = this.currentConditions.bandwidthKbps;
    const quality = this.getNetworkQuality();
    
    return bandwidth >= 64 && // 64 Kbps minimum for audio
           quality !== 'disconnected';
  }

  /**
   * Get recommended quality settings based on current conditions
   */
  getRecommendedQualitySettings(): {
    resolution: string;
    videoBitrate: number;
    audioBitrate: number;
    framerate: number;
  } {
    const bandwidth = this.currentConditions.bandwidthKbps;
    const quality = this.getNetworkQuality();
    
    if (quality === 'excellent' && bandwidth > 2048) {
      return {
        resolution: '720p',
        videoBitrate: 1500,
        audioBitrate: 128,
        framerate: 30
      };
    } else if (quality === 'good' && bandwidth > 1024) {
      return {
        resolution: '480p',
        videoBitrate: 800,
        audioBitrate: 96,
        framerate: 24
      };
    } else if (quality === 'fair' && bandwidth > 512) {
      return {
        resolution: '360p',
        videoBitrate: 400,
        audioBitrate: 64,
        framerate: 15
      };
    } else if (bandwidth > 256) {
      return {
        resolution: '240p',
        videoBitrate: 200,
        audioBitrate: 32,
        framerate: 15
      };
    } else {
      return {
        resolution: '144p',
        videoBitrate: 100,
        audioBitrate: 24,
        framerate: 15
      };
    }
  }

  // Private methods

  private async assessNetworkConditions(): Promise<void> {
    const [bandwidth, rtt, packetLoss] = await Promise.allSettled([
      this.testBandwidth(),
      this.testRTT(),
      this.estimatePacketLoss()
    ]);

    const previousConditions = { ...this.currentConditions };
    
    this.currentConditions = {
      bandwidthKbps: bandwidth.status === 'fulfilled' ? bandwidth.value : this.currentConditions.bandwidthKbps,
      rttMs: rtt.status === 'fulfilled' ? rtt.value : this.currentConditions.rttMs,
      packetLossPercent: packetLoss.status === 'fulfilled' ? packetLoss.value : this.currentConditions.packetLossPercent,
      stabilityScore: this.calculateStabilityScore(),
      connectionType: this.detectConnectionType(),
      signalStrength: this.getSignalStrength()
    };

    // Check if conditions changed significantly
    if (this.hasSignificantChange(previousConditions, this.currentConditions)) {
      this.emitEvent({
        type: 'network-change',
        timestamp: new Date(),
        sessionId: 'monitor',
        data: this.currentConditions
      });
    }

    // Check for bandwidth changes
    if (Math.abs(previousConditions.bandwidthKbps - this.currentConditions.bandwidthKbps) > 200) {
      this.emitEvent({
        type: 'bandwidth-change',
        timestamp: new Date(),
        sessionId: 'monitor',
        data: this.currentConditions
      });
    }
  }

  private async periodicAssessment(): Promise<void> {
    try {
      await this.assessNetworkConditions();
    } catch (error) {
      console.error('Periodic network assessment failed:', error);
    }
  }

  private initializeConnectionDetection(): void {
    // Initialize Navigator Connection API if available
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      this.connectionInfo = (navigator as any).connection;
      
      // Listen for connection changes
      this.connectionInfo?.addEventListener('change', () => {
        this.assessNetworkConditions();
      });
    }
  }

  private detectConnectionType(): NetworkConditions['connectionType'] {
    if (this.connectionInfo) {
      const effectiveType = this.connectionInfo.effectiveType;
      const type = this.connectionInfo.type;
      
      if (type === 'wifi') return 'wifi';
      if (type === 'cellular') return 'cellular';
      if (type === 'ethernet') return 'ethernet';
      if (type === 'bluetooth') return 'bluetooth';
    }
    
    return 'unknown';
  }

  private getSignalStrength(): number | undefined {
    if (this.connectionInfo?.downlink) {
      // Convert downlink to signal strength percentage
      const downlink = this.connectionInfo.downlink;
      return Math.min(100, Math.round((downlink / 10) * 100));
    }
    return undefined;
  }

  private estimateBandwidthFromConnection(): number {
    if (this.connectionInfo?.downlink) {
      return Math.round(this.connectionInfo.downlink * 1000); // Convert Mbps to Kbps
    }
    
    // Fallback estimates based on connection type
    const connectionType = this.detectConnectionType();
    switch (connectionType) {
      case 'ethernet': return 10000; // 10 Mbps
      case 'wifi': return 5000;      // 5 Mbps
      case 'cellular': return 1000;  // 1 Mbps
      case 'bluetooth': return 100;  // 100 Kbps
      default: return 1000;          // 1 Mbps default
    }
  }

  private estimateRTTFromConnection(): number {
    if (this.connectionInfo?.rtt) {
      return this.connectionInfo.rtt;
    }
    
    // Fallback estimates based on connection type
    const connectionType = this.detectConnectionType();
    switch (connectionType) {
      case 'ethernet': return 10;   // 10ms
      case 'wifi': return 20;       // 20ms
      case 'cellular': return 100;  // 100ms
      case 'bluetooth': return 50;  // 50ms
      default: return 50;           // 50ms default
    }
  }

  private getConnectionTypeScore(): number {
    const connectionType = this.detectConnectionType();
    switch (connectionType) {
      case 'ethernet': return 100;
      case 'wifi': return 85;
      case 'cellular': return 60;
      case 'bluetooth': return 40;
      default: return 50;
    }
  }

  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  private hasSignificantChange(prev: NetworkConditions, current: NetworkConditions): boolean {
    const bandwidthChange = Math.abs(prev.bandwidthKbps - current.bandwidthKbps);
    const rttChange = Math.abs(prev.rttMs - current.rttMs);
    const stabilityChange = Math.abs(prev.stabilityScore - current.stabilityScore);
    
    return bandwidthChange > 200 ||    // 200 Kbps change
           rttChange > 50 ||           // 50ms change
           stabilityChange > 10 ||     // 10% stability change
           prev.connectionType !== current.connectionType;
  }

  private generateTestUrl(sizeKB: number): string {
    // Generate a data URL for bandwidth testing
    const data = new Uint8Array(sizeKB * 1024).fill(0);
    return URL.createObjectURL(new Blob([data]));
  }

  private getDefaultConditions(): NetworkConditions {
    return {
      bandwidthKbps: 1000,
      rttMs: 50,
      packetLossPercent: 0,
      stabilityScore: 80,
      connectionType: 'unknown',
      signalStrength: undefined
    };
  }

  private emitEvent(event: NetworkEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in network event listener:', error);
        }
      });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}