import * as crypto from 'crypto';

export interface HandshakeRequest {
  method: string;
  path: string;
  headers: Map<string, string>;
  version: string;
}

export interface HandshakeResponse {
  statusCode: number;
  statusText: string;
  headers: Map<string, string>;
  body?: Buffer;
  version?: string;
}

export class Handshake {
  private static readonly MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

  static parseRequest(data: Buffer): HandshakeRequest | null {
    const str = data.toString('utf8');
    const lines = str.split('\r\n');
    
    if (lines.length < 2) return null;
    
    const requestLine = lines[0].split(' ');
    if (requestLine.length < 3) return null;
    
    const method = requestLine[0];
    const path = requestLine[1];
    const version = requestLine[2];
    
    const headers = new Map<string, string>();
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line === '') break;
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      const key = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();
      headers.set(key, value);
    }
    
    return { method, path, headers, version };
  }

  static isWebSocketUpgrade(request: HandshakeRequest): boolean {
    const upgrade = request.headers.get('upgrade');
    const connection = request.headers.get('connection');
    
    return (
      request.method === 'GET' &&
      !!(upgrade && upgrade.toLowerCase() === 'websocket') &&
      !!(connection && connection.toLowerCase().includes('upgrade'))
    );
  }

  static generateAcceptKey(key: string): string {
    const combined = key + this.MAGIC_STRING;
    const hash = crypto.createHash('sha1').update(combined).digest('base64');
    return hash;
  }

  static createResponse(request: HandshakeRequest): HandshakeResponse {
    const secKey = request.headers.get('sec-websocket-key');
    
    if (!secKey) {
      return {
        statusCode: 400,
        statusText: 'Bad Request',
        headers: new Map([['Content-Type', 'text/plain']]),
        body: Buffer.from('Missing Sec-WebSocket-Key')
      };
    }
    
    const acceptKey = this.generateAcceptKey(secKey);
    
    const headers = new Map<string, string>([
      ['Upgrade', 'websocket'],
      ['Connection', 'Upgrade'],
      ['Sec-WebSocket-Accept', acceptKey]
    ]);
    
    // 暂时不支持压缩扩展，避免消息乱码
    // const extensions = request.headers.get('sec-websocket-extensions');
    // if (extensions && extensions.includes('permessage-deflate')) {
    //   headers.set('Sec-WebSocket-Extensions', 'permessage-deflate');
    // }
    
    const protocol = request.headers.get('sec-websocket-protocol');
    if (protocol) {
      const protocols = protocol.split(',').map(p => p.trim());
      if (protocols.includes('chat')) {
        headers.set('Sec-WebSocket-Protocol', 'chat');
      }
    }
    
    return {
      statusCode: 101,
      statusText: 'Switching Protocols',
      headers
    };
  }

  static serializeResponse(response: HandshakeResponse): Buffer {
    let str = `${response.version || 'HTTP/1.1'} ${response.statusCode} ${response.statusText}\r\n`;
    
    response.headers.forEach((value, key) => {
      str += `${key}: ${value}\r\n`;
    });
    
    str += '\r\n';
    
    const headersBuffer = Buffer.from(str, 'utf8');
    
    if (response.body) {
      return Buffer.concat([headersBuffer, response.body]);
    }
    
    return headersBuffer;
  }
}
