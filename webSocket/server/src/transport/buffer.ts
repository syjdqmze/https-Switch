export class CircularBuffer {
  private buffer: Buffer;
  private writeIndex = 0;
  private readIndex = 0;
  private count = 0;

  constructor(private capacity: number) {
    this.buffer = Buffer.alloc(capacity);
  }

  write(data: Buffer): number {
    const bytesToWrite = Math.min(data.length, this.capacity - this.count);
    
    if (bytesToWrite === 0) return 0;

    let written = 0;
    
    if (this.writeIndex + bytesToWrite <= this.capacity) {
      written = data.copy(this.buffer, this.writeIndex, 0, bytesToWrite);
      this.writeIndex += written;
    } else {
      const firstPart = this.capacity - this.writeIndex;
      written = data.copy(this.buffer, this.writeIndex, 0, firstPart);
      const secondPart = bytesToWrite - firstPart;
      written += data.copy(this.buffer, 0, firstPart, firstPart + secondPart);
      this.writeIndex = secondPart;
    }
    
    this.count += written;
    return written;
  }

  read(size: number): Buffer {
    const bytesToRead = Math.min(size, this.count);
    const result = Buffer.alloc(bytesToRead);
    
    if (bytesToRead === 0) return result;

    let read = 0;
    
    if (this.readIndex + bytesToRead <= this.capacity) {
      read = this.buffer.copy(result, 0, this.readIndex, this.readIndex + bytesToRead);
      this.readIndex += read;
    } else {
      const firstPart = this.capacity - this.readIndex;
      read = this.buffer.copy(result, 0, this.readIndex, this.readIndex + firstPart);
      const secondPart = bytesToRead - firstPart;
      read += this.buffer.copy(result, firstPart, 0, secondPart);
      this.readIndex = secondPart;
    }
    
    this.count -= read;
    return result;
  }

  peek(size: number): Buffer {
    const bytesToRead = Math.min(size, this.count);
    const result = Buffer.alloc(bytesToRead);
    
    if (bytesToRead === 0) return result;

    if (this.readIndex + bytesToRead <= this.capacity) {
      this.buffer.copy(result, 0, this.readIndex, this.readIndex + bytesToRead);
    } else {
      const firstPart = this.capacity - this.readIndex;
      this.buffer.copy(result, 0, this.readIndex, this.readIndex + firstPart);
      const secondPart = bytesToRead - firstPart;
      this.buffer.copy(result, firstPart, 0, secondPart);
    }
    
    return result;
  }

  skip(size: number): number {
    const bytesToSkip = Math.min(size, this.count);
    
    if (this.readIndex + bytesToSkip <= this.capacity) {
      this.readIndex += bytesToSkip;
    } else {
      this.readIndex = bytesToSkip - (this.capacity - this.readIndex);
    }
    
    this.count -= bytesToSkip;
    return bytesToSkip;
  }

  get length(): number {
    return this.count;
  }

  get available(): number {
    return this.capacity - this.count;
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  isFull(): boolean {
    return this.count === this.capacity;
  }

  clear(): void {
    this.writeIndex = 0;
    this.readIndex = 0;
    this.count = 0;
  }
}

export class BufferManager {
  private buffers: Map<string, CircularBuffer> = new Map();
  private defaultCapacity = 65536;

  constructor(defaultCapacity?: number) {
    if (defaultCapacity) this.defaultCapacity = defaultCapacity;
  }

  getBuffer(connectionId: string): CircularBuffer {
    let buffer = this.buffers.get(connectionId);
    if (!buffer) {
      buffer = new CircularBuffer(this.defaultCapacity);
      this.buffers.set(connectionId, buffer);
    }
    return buffer;
  }

  write(connectionId: string, data: Buffer): number {
    const buffer = this.getBuffer(connectionId);
    return buffer.write(data);
  }

  read(connectionId: string, size: number): Buffer {
    const buffer = this.getBuffer(connectionId);
    return buffer.read(size);
  }

  peek(connectionId: string, size: number): Buffer {
    const buffer = this.getBuffer(connectionId);
    return buffer.peek(size);
  }

  skip(connectionId: string, size: number): number {
    const buffer = this.getBuffer(connectionId);
    return buffer.skip(size);
  }

  getLength(connectionId: string): number {
    const buffer = this.getBuffer(connectionId);
    return buffer.length;
  }

  hasData(connectionId: string): boolean {
    const buffer = this.buffers.get(connectionId);
    return buffer ? !buffer.isEmpty() : false;
  }

  removeBuffer(connectionId: string): void {
    this.buffers.delete(connectionId);
  }

  clear(): void {
    this.buffers.clear();
  }
}
