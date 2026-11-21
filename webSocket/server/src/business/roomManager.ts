import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface Room {
  id: string;
  name: string;
  topic?: string;
  createdAt: Date;
  maxMembers: number;
  isPrivate: boolean;
  password?: string;
  members: Set<string>;
  metadata: Map<string, any>;
}

export interface RoomOptions {
  name: string;
  topic?: string;
  maxMembers?: number;
  isPrivate?: boolean;
  password?: string;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private userIdToRoomIds: Map<string, Set<string>> = new Map();
  private persistencePath: string;

  constructor(persistencePath?: string) {
    this.persistencePath = persistencePath || path.join(process.cwd(), 'rooms-data.json');
    this.loadRooms();
  }

  private loadRooms(): void {
    try {
      if (fs.existsSync(this.persistencePath)) {
        const data = JSON.parse(fs.readFileSync(this.persistencePath, 'utf-8'));
        for (const roomData of data.rooms || []) {
          const room: Room = {
            ...roomData,
            createdAt: new Date(roomData.createdAt),
            members: new Set(roomData.members || []),
            metadata: new Map(Object.entries(roomData.metadata || {}))
          };
          this.rooms.set(room.id, room);
          for (const memberId of room.members) {
            let set = this.userIdToRoomIds.get(memberId);
            if (!set) {
              set = new Set();
              this.userIdToRoomIds.set(memberId, set);
            }
            set.add(room.id);
          }
        }
        console.log(`[RoomManager] Loaded ${this.rooms.size} rooms from disk`);
      }
    } catch (error) {
      console.error('[RoomManager] Failed to load rooms:', error);
    }
  }

  private saveRooms(): void {
    try {
      const data = {
        rooms: Array.from(this.rooms.values()).map(room => ({
          ...room,
          members: Array.from(room.members),
          metadata: Object.fromEntries(room.metadata)
        }))
      };
      fs.writeFileSync(this.persistencePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[RoomManager] Failed to save rooms:', error);
    }
  }

  create(options: RoomOptions): Room | null {
    const existingRoom = Array.from(this.rooms.values()).find(r => r.name === options.name);
    if (existingRoom) {
      return existingRoom;
    }

    const room: Room = {
      id: uuidv4(),
      name: options.name,
      topic: options.topic,
      createdAt: new Date(),
      maxMembers: options.maxMembers || 100,
      isPrivate: options.isPrivate || false,
      password: options.password,
      members: new Set(),
      metadata: new Map()
    };

    this.rooms.set(room.id, room);
    this.saveRooms();
    return room;
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  getAll(): Room[] {
    return Array.from(this.rooms.values());
  }

  getPublicRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(r => !r.isPrivate);
  }

  join(roomId: string, userId: string, password?: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    if (room.password && room.password !== password) {
      return false;
    }

    if (room.members.size >= room.maxMembers) {
      return false;
    }

    if (room.members.has(userId)) {
      return true;
    }

    room.members.add(userId);

    let set = this.userIdToRoomIds.get(userId);
    if (!set) {
      set = new Set();
      this.userIdToRoomIds.set(userId, set);
    }
    set.add(roomId);
    
    this.saveRooms();
    return true;
  }

  leave(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.members.delete(userId);
    this.saveRooms();

    const set = this.userIdToRoomIds.get(userId);
    if (set) {
      set.delete(roomId);
      if (set.size === 0) {
        this.userIdToRoomIds.delete(userId);
      }
    }

    if (room.members.size === 0 && !room.isPrivate) {
      this.rooms.delete(roomId);
      this.saveRooms();
    }

    return true;
  }

  getRoomsByUserId(userId: string): Room[] {
    const roomIds = this.userIdToRoomIds.get(userId);
    if (!roomIds) return [];

    const result: Room[] = [];
    for (const id of roomIds) {
      const room = this.rooms.get(id);
      if (room) result.push(room);
    }
    return result;
  }

  removeRoom(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    for (const userId of room.members) {
      const set = this.userIdToRoomIds.get(userId);
      if (set) {
        set.delete(roomId);
        if (set.size === 0) {
          this.userIdToRoomIds.delete(userId);
        }
      }
    }

    this.rooms.delete(roomId);
    return true;
  }

  update(roomId: string, updates: Partial<Room>): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    if (updates.name !== undefined) room.name = updates.name;
    if (updates.topic !== undefined) room.topic = updates.topic;
    if (updates.maxMembers !== undefined) room.maxMembers = updates.maxMembers;
    if (updates.isPrivate !== undefined) room.isPrivate = updates.isPrivate;
    if (updates.password !== undefined) room.password = updates.password;
    if (updates.metadata !== undefined) room.metadata = updates.metadata;

    return true;
  }

  getMemberCount(roomId: string): number {
    const room = this.rooms.get(roomId);
    return room ? room.members.size : 0;
  }

  getCount(): number {
    return this.rooms.size;
  }

  clear(): void {
    this.rooms.clear();
    this.userIdToRoomIds.clear();
  }
}