import { v4 as uuidv4 } from 'uuid';
import { ConnectionPool } from '../connection/connectionPool';

export interface Session {
  id: string;
  userId: string;
  connectionId: string;
  wsConnectionId: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  data: Map<string, any>;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private userIdToSessionIds: Map<string, Set<string>> = new Map();

  constructor(private connectionPool: ConnectionPool) {}

  create(userId: string, connectionId: string, wsConnectionId: string): Session {
    const session: Session = {
      id: uuidv4(),
      userId,
      connectionId,
      wsConnectionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      data: new Map()
    };
    
    this.sessions.set(session.id, session);
    
    let set = this.userIdToSessionIds.get(userId);
    if (!set) {
      set = new Set();
      this.userIdToSessionIds.set(userId, set);
    }
    set.add(session.id);
    
    this.connectionPool.update(wsConnectionId, { userId });
    
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  getByUserId(userId: string): Session[] {
    const sessionIds = this.userIdToSessionIds.get(userId);
    if (!sessionIds) return [];
    
    const result: Session[] = [];
    for (const id of sessionIds) {
      const session = this.sessions.get(id);
      if (session) result.push(session);
    }
    return result;
  }

  getByConnectionId(connectionId: string): Session | undefined {
    for (const session of this.sessions.values()) {
      if (session.connectionId === connectionId) {
        return session;
      }
    }
    return undefined;
  }

  update(id: string, updates: Partial<Session>): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    if (updates.userId !== undefined) {
      const oldSet = this.userIdToSessionIds.get(session.userId);
      if (oldSet) {
        oldSet.delete(id);
        if (oldSet.size === 0) {
          this.userIdToSessionIds.delete(session.userId);
        }
      }
      
      let newSet = this.userIdToSessionIds.get(updates.userId);
      if (!newSet) {
        newSet = new Set();
        this.userIdToSessionIds.set(updates.userId, newSet);
      }
      newSet.add(id);
      
      session.userId = updates.userId;
    }

    if (updates.expiresAt !== undefined) session.expiresAt = updates.expiresAt;
    if (updates.data !== undefined) session.data = updates.data;
    
    return true;
  }

  touch(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    
    session.lastActivity = new Date();
    session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    return true;
  }

  remove(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    const set = this.userIdToSessionIds.get(session.userId);
    if (set) {
      set.delete(id);
      if (set.size === 0) {
        this.userIdToSessionIds.delete(session.userId);
      }
    }

    this.sessions.delete(id);
    return true;
  }

  removeByConnectionId(connectionId: string): boolean {
    const session = this.getByConnectionId(connectionId);
    if (!session) return false;
    return this.remove(session.id);
  }

  cleanupExpired(): number {
    const now = new Date();
    let removed = 0;
    
    for (const session of this.sessions.values()) {
      if (session.expiresAt < now) {
        this.remove(session.id);
        removed++;
      }
    }
    
    return removed;
  }

  getCount(): number {
    return this.sessions.size;
  }

  clear(): void {
    this.sessions.clear();
    this.userIdToSessionIds.clear();
  }
}
