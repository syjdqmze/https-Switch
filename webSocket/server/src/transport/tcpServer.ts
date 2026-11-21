import * as net from 'net';
import * as tls from 'tls';
import * as fs from 'fs';

export interface ServerConfig {
  host: string;
  port: number;
  tls?: boolean;
  certPath?: string;
  keyPath?: string;
  maxConnections?: number;
  backlog?: number;
}

export interface Connection {
  id: string;
  socket: net.Socket | tls.TLSSocket;
  remoteAddress: string;
  remotePort: number;
  connectedAt: Date;
  buffer: Buffer;
}

export interface ServerEvents {
  connection: (connection: Connection) => void;
  data: (connection: Connection, data: Buffer) => void;
  close: (connection: Connection, error?: Error) => void;
  error: (error: Error) => void;
  listening: () => void;
}

export class TCPServer {
  private server: net.Server | tls.Server;
  private connections: Map<string, Connection> = new Map();
  private eventHandlers: Partial<ServerEvents> = {};
  private nextConnectionId = 0;

  constructor(private config: ServerConfig) {
    this.server = config.tls ? this.createTLSServer() : this.createTCPServer();
    this.setupEventHandlers();
  }

  private createTCPServer(): net.Server {
    return net.createServer();
  }

  private createTLSServer(): tls.Server {
    if (!this.config.certPath || !this.config.keyPath) {
      throw new Error('TLS requires certPath and keyPath');
    }

    return tls.createServer({
      cert: fs.readFileSync(this.config.certPath),
      key: fs.readFileSync(this.config.keyPath),
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3'
    });
  }

  private setupEventHandlers(): void {
    this.server.on('connection', (socket: net.Socket | tls.TLSSocket) => {
      if (this.config.maxConnections && 
          this.connections.size >= this.config.maxConnections) {
        socket.destroy(new Error('Server is full'));
        return;
      }

      const connection: Connection = {
        id: `conn-${++this.nextConnectionId}-${Date.now()}`,
        socket,
        remoteAddress: socket.remoteAddress || 'unknown',
        remotePort: socket.remotePort || 0,
        connectedAt: new Date(),
        buffer: Buffer.alloc(0)
      };

      this.connections.set(connection.id, connection);

      socket.on('data', (data: Buffer) => {
        connection.buffer = Buffer.concat([connection.buffer, data]);
        this.eventHandlers.data?.(connection, data);
      });

      socket.on('close', (hadError: boolean) => {
        this.connections.delete(connection.id);
        this.eventHandlers.close?.(connection, hadError ? new Error('Socket closed with error') : undefined);
      });

      socket.on('error', (error: Error) => {
        this.eventHandlers.close?.(connection, error);
      });

      socket.on('end', () => {
        socket.end();
      });

      this.eventHandlers.connection?.(connection);
    });

    this.server.on('error', (error: Error) => {
      this.eventHandlers.error?.(error);
    });

    this.server.on('listening', () => {
      this.eventHandlers.listening?.();
    });
  }

  on<K extends keyof ServerEvents>(event: K, handler: ServerEvents[K]): void {
    this.eventHandlers[event] = handler;
  }

  listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen({
        host: this.config.host,
        port: this.config.port,
        backlog: this.config.backlog || 511
      }, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.connections.forEach((conn) => {
            conn.socket.destroy();
          });
          this.connections.clear();
          resolve();
        }
      });
    });
  }

  send(connectionId: string, data: Buffer): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;
    
    try {
      connection.socket.write(data);
      return true;
    } catch {
      return false;
    }
  }

  closeConnection(connectionId: string, reason?: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      if (reason) {
        connection.socket.end(reason);
      } else {
        connection.socket.destroy();
      }
      this.connections.delete(connectionId);
    }
  }

  getConnection(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }

  getConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}
