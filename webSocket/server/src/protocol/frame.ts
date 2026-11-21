export enum OpCode {
  CONTINUATION = 0x0,
  TEXT = 0x1,
  BINARY = 0x2,
  CLOSE = 0x8,
  PING = 0x9,
  PONG = 0xA
}

export interface WebSocketFrame {
  fin: boolean;
  rsv1: boolean;
  rsv2: boolean;
  rsv3: boolean;
  opcode: OpCode;
  mask: boolean;
  payloadLength: number;
  maskingKey?: Buffer;
  payloadData: Buffer;
}

export class FrameCodec {
  static encode(frame: WebSocketFrame): Buffer {
    const buffers: Buffer[] = [];
    let firstByte = 0;
    
    if (frame.fin) firstByte |= 0x80;
    if (frame.rsv1) firstByte |= 0x40;
    if (frame.rsv2) firstByte |= 0x20;
    if (frame.rsv3) firstByte |= 0x10;
    firstByte |= frame.opcode;
    
    buffers.push(Buffer.from([firstByte]));
    
    let secondByte = frame.mask ? 0x80 : 0;
    const payloadLength = frame.payloadData.length;
    
    if (payloadLength < 126) {
      secondByte |= payloadLength;
      buffers.push(Buffer.from([secondByte]));
    } else if (payloadLength < 65536) {
      secondByte |= 126;
      buffers.push(Buffer.from([secondByte]));
      const lengthBuffer = Buffer.alloc(2);
      lengthBuffer.writeUInt16BE(payloadLength);
      buffers.push(lengthBuffer);
    } else {
      secondByte |= 127;
      buffers.push(Buffer.from([secondByte]));
      const lengthBuffer = Buffer.alloc(8);
      lengthBuffer.writeUInt32BE(Math.floor(payloadLength / 4294967296));
      lengthBuffer.writeUInt32BE(payloadLength % 4294967296, 4);
      buffers.push(lengthBuffer);
    }
    
    if (frame.mask && frame.maskingKey) {
      buffers.push(frame.maskingKey);
      const maskedPayload = this.applyMask(frame.payloadData, frame.maskingKey);
      buffers.push(maskedPayload);
    } else {
      buffers.push(frame.payloadData);
    }
    
    return Buffer.concat(buffers);
  }

  static decode(buffer: Buffer): { frame: WebSocketFrame; consumed: number } | null {
    if (buffer.length < 2) return null;
    
    let offset = 0;
    const firstByte = buffer.readUInt8(offset++);
    const secondByte = buffer.readUInt8(offset++);
    
    const fin = (firstByte & 0x80) !== 0;
    const rsv1 = (firstByte & 0x40) !== 0;
    const rsv2 = (firstByte & 0x20) !== 0;
    const rsv3 = (firstByte & 0x10) !== 0;
    const opcode = firstByte & 0x0F;
    const mask = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7F;
    
    if (payloadLength === 126) {
      if (buffer.length < offset + 2) return null;
      payloadLength = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      if (buffer.length < offset + 8) return null;
      payloadLength = buffer.readUInt32BE(offset) * 4294967296 + buffer.readUInt32BE(offset + 4);
      offset += 8;
    }
    
    let maskingKey: Buffer | undefined;
    if (mask) {
      if (buffer.length < offset + 4) return null;
      maskingKey = buffer.slice(offset, offset + 4);
      offset += 4;
    }
    
    if (buffer.length < offset + payloadLength) return null;
    let payloadData = buffer.slice(offset, offset + payloadLength);
    offset += payloadLength;
    
    if (mask && maskingKey) {
      payloadData = Buffer.from(this.applyMask(payloadData, maskingKey));
    }
    
    const frame: WebSocketFrame = {
      fin,
      rsv1,
      rsv2,
      rsv3,
      opcode: opcode as OpCode,
      mask,
      payloadLength,
      maskingKey,
      payloadData
    };
    
    return { frame, consumed: offset };
  }

  static applyMask(data: Buffer, mask: Buffer): Buffer {
    const result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ mask[i % 4];
    }
    return result;
  }

  static createTextFrame(text: string): WebSocketFrame {
    return {
      fin: true,
      rsv1: false,
      rsv2: false,
      rsv3: false,
      opcode: OpCode.TEXT,
      mask: false,
      payloadLength: Buffer.byteLength(text),
      payloadData: Buffer.from(text, 'utf8')
    };
  }

  static createPingFrame(data?: Buffer): WebSocketFrame {
    return {
      fin: true,
      rsv1: false,
      rsv2: false,
      rsv3: false,
      opcode: OpCode.PING,
      mask: false,
      payloadLength: data ? data.length : 0,
      payloadData: data || Buffer.alloc(0)
    };
  }

  static createPongFrame(data?: Buffer): WebSocketFrame {
    return {
      fin: true,
      rsv1: false,
      rsv2: false,
      rsv3: false,
      opcode: OpCode.PONG,
      mask: false,
      payloadLength: data ? data.length : 0,
      payloadData: data || Buffer.alloc(0)
    };
  }

  static createCloseFrame(code: number, reason: string = ''): WebSocketFrame {
    const codeBuffer = Buffer.alloc(2);
    codeBuffer.writeUInt16BE(code);
    const reasonBuffer = Buffer.from(reason, 'utf8');
    const payloadData = Buffer.concat([codeBuffer, reasonBuffer]);
    
    return {
      fin: true,
      rsv1: false,
      rsv2: false,
      rsv3: false,
      opcode: OpCode.CLOSE,
      mask: false,
      payloadLength: payloadData.length,
      payloadData
    };
  }
}
