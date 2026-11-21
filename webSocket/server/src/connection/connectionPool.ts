import { v4 as uuidv4 } from 'uuid';

export enum ConnectionStatus {
  CONNECTING = 'connecting',
  OPEN = 'open',
  CLOSING = 'closing',
  CLOSED = 'closed'
}

export interface WSConnection {
  id: string;
  connectionId: string;
  userId?: string;
  status: ConnectionStatus;
  connectedAt: Date;
  lastActivity: Date;
  protocol?: string;
  extensions?: string[];
  metadata: Map<string, any>;
}

export class ConnectionPool {
  private connections: Map<string, WSConnection> = new Map();
  private userIdToConnectionIds: Map<string, Set<string>> = new Map();

  add(connectionId: string): WSConnection {
    const wsConnection: WSConnection = {
      id: uuidv4(),
      connectionId,
      status: ConnectionStatus.CONNECTING,
      connectedAt: new Date(),
      lastActivity: new Date(),
      metadata: new Map()
    };
    
    this.connections.set(wsConnection.id, wsConnection);
    return wsConnection;
  }

  get(id: string): WSConnection | undefined {
    return this.connections.get(id);
  }

  getByConnectionId(connectionId: string): WSConnection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.connectionId === connectionId) {
        return conn;
      }
    }
    return undefined;
  }

  getAll(): WSConnection[] {
    return Array.from(this.connections.values());
  }

  getByUserId(userId: string): WSConnection[] {
    const connectionIds = this.userIdToConnectionIds.get(userId);
    if (!connectionIds) return [];
    
    const result: WSConnection[] = [];
    for (const connId of connectionIds) {
      const conn = this.connections.get(connId);
      if (conn) result.push(conn);
    }
    return result;
  }

  update(id: string, updates: Partial<WSConnection>): boolean {
    const conn = this.connections.get(id);
    if (!conn) return false;

    if (updates.userId !== undefined) {
      if (conn.userId) {
        const oldSet = this.userIdToConnectionIds.get(conn.userId);
        if (oldSet) {
          oldSet.delete(id);
          if (oldSet.size === 0) {
            this.userIdToConnectionIds.delete(conn.userId);
          }
        }
      }
      
      if (updates.userId) {
        let newSet = this.userIdToConnectionIds.get(updates.userId);
        if (!newSet) {
          newSet = new Set();
          this.userIdToConnectionIds.set(updates.userId, newSet);
        }
        newSet.add(id);
      }
      
      conn.userId = updates.userId;
    }

    if (updates.status !== undefined) conn.status = updates.status;
    if (updates.protocol !== undefined) conn.protocol = updates.protocol;
    if (updates.extensions !== undefined) conn.extensions = updates.extensions;
    if (updates.metadata !== undefined) conn.metadata = updates.metadata;
    
    return true;
  }

  updateActivity(id: string): void {
    const conn = this.connections.get(id);
    if (conn) {
      conn.lastActivity = new Date();
    }
  }

  remove(id: string): boolean {
    const conn = this.connections.get(id);
    if (!conn) return false;

    if (conn.userId) {
      const set = this.userIdToConnectionIds.get(conn.userId);
      if (set) {
        set.delete(id);
        if (set.size === 0) {
          this.userIdToConnectionIds.delete(conn.userId);
        }
      }
    }

    this.connections.delete(id);
    return true;
  }

  removeByConnectionId(connectionId: string): boolean {
    const conn = this.getByConnectionId(connectionId);
    if (!conn) return false;
    return this.remove(conn.id);
  }

  getCount(): number {
    return this.connections.size;
  }

  getCountByStatus(status: ConnectionStatus): number {
    let count = 0;
    for (const conn of this.connections.values()) {
      if (conn.status === status) count++;
    }
    return count;
  }

  getCountByUserId(userId: string): number {
    const ids = this.userIdToConnectionIds.get(userId);
    return ids ? ids.size : 0;
  }

  clear(): void {
    this.connections.clear();
    this.userIdToConnectionIds.clear();
  }
}
