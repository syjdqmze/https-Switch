import { ConnectionPool, ConnectionStatus } from './connectionPool';
import { FrameCodec } from '../protocol/frame';

export interface HeartbeatConfig {
  interval: number;
  timeout: number;
  maxMissedPings: number;
}

export class HeartbeatManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private pingCounters: Map<string, number> = new Map();

  constructor(
    private connectionPool: ConnectionPool,
    private config: HeartbeatConfig,
    private sendFrame: (connectionId: string, frame: Buffer) => void
  ) {}

  start(connectionId: string): void {
    this.stop(connectionId);
    
    const pingInterval = setInterval(() => {
      this.sendPing(connectionId);
    }, this.config.interval);
    
    this.timers.set(connectionId, pingInterval);
    this.pingCounters.set(connectionId, 0);
  }

  private sendPing(connectionId: string): void {
    const conn = this.connectionPool.getByConnectionId(connectionId);
    if (!conn || conn.status !== ConnectionStatus.OPEN) {
      this.stop(connectionId);
      return;
    }

    const counter = (this.pingCounters.get(connectionId) || 0) + 1;
    
    if (counter > this.config.maxMissedPings) {
      this.handleTimeout(connectionId);
      return;
    }
    
    this.pingCounters.set(connectionId, counter);
    
    const pingFrame = FrameCodec.encode(FrameCodec.createPingFrame());
    this.sendFrame(connectionId, pingFrame);
    
    setTimeout(() => {
      const currentCounter = this.pingCounters.get(connectionId);
      if (currentCounter && currentCounter >= counter) {
        if (currentCounter >= this.config.maxMissedPings) {
          this.handleTimeout(connectionId);
        }
      }
    }, this.config.timeout);
  }

  receivePong(connectionId: string): void {
    this.pingCounters.set(connectionId, 0);
  }

  private handleTimeout(connectionId: string): void {
    const conn = this.connectionPool.getByConnectionId(connectionId);
    if (conn) {
      this.connectionPool.update(conn.id, { status: ConnectionStatus.CLOSING });
    }
    
    this.stop(connectionId);
    
    const closeFrame = FrameCodec.encode(FrameCodec.createCloseFrame(1001, 'Connection timeout'));
    this.sendFrame(connectionId, closeFrame);
    
    setTimeout(() => {
      this.connectionPool.removeByConnectionId(connectionId);
    }, 1000);
  }

  stop(connectionId: string): void {
    const timer = this.timers.get(connectionId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(connectionId);
    }
    this.pingCounters.delete(connectionId);
  }

  stopAll(): void {
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers.clear();
    this.pingCounters.clear();
  }
}
