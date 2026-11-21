export interface Extension {
  name: string;
  parameters: Map<string, string>;
}

export interface ExtensionProcessor {
  name: string;
  encode: (data: Buffer) => Buffer;
  decode: (data: Buffer) => Buffer;
  getOffer: () => string;
  acceptOffer: (offer: string) => boolean;
}

export class PerMessageDeflate implements ExtensionProcessor {
  name = 'permessage-deflate';
  private clientMaxWindowBits: number = 15;
  private serverMaxWindowBits: number = 15;
  private clientNoContextTakeover: boolean = false;
  private serverNoContextTakeover: boolean = false;

  getOffer(): string {
    const params: string[] = [];
    params.push(`client_max_window_bits=${this.clientMaxWindowBits}`);
    params.push(`server_max_window_bits=${this.serverMaxWindowBits}`);
    if (this.clientNoContextTakeover) {
      params.push('client_no_context_takeover');
    }
    if (this.serverNoContextTakeover) {
      params.push('server_no_context_takeover');
    }
    return `${this.name}; ${params.join('; ')}`;
  }

  acceptOffer(offer: string): boolean {
    const parts = offer.toLowerCase().split(';');
    const extensionName = parts[0].trim();
    
    if (extensionName !== this.name) return false;
    
    for (let i = 1; i < parts.length; i++) {
      const param = parts[i].trim();
      if (param.startsWith('client_max_window_bits=')) {
        const value = parseInt(param.split('=')[1], 10);
        if (!isNaN(value)) this.clientMaxWindowBits = value;
      } else if (param.startsWith('server_max_window_bits=')) {
        const value = parseInt(param.split('=')[1], 10);
        if (!isNaN(value)) this.serverMaxWindowBits = value;
      } else if (param === 'client_no_context_takeover') {
        this.clientNoContextTakeover = true;
      } else if (param === 'server_no_context_takeover') {
        this.serverNoContextTakeover = true;
      }
    }
    
    return true;
  }

  encode(data: Buffer): Buffer {
    return data;
  }

  decode(data: Buffer): Buffer {
    return data;
  }
}

export class ExtensionManager {
  private extensions: Map<string, ExtensionProcessor> = new Map();

  register(processor: ExtensionProcessor): void {
    this.extensions.set(processor.name, processor);
  }

  getProcessor(name: string): ExtensionProcessor | undefined {
    return this.extensions.get(name);
  }

  parseExtensions(header: string): Extension[] {
    const result: Extension[] = [];
    const parts = header.split(',');
    
    for (const part of parts) {
      const extensionParts = part.split(';');
      const name = extensionParts[0].trim();
      const parameters = new Map<string, string>();
      
      for (let i = 1; i < extensionParts.length; i++) {
        const param = extensionParts[i].trim();
        const eqIndex = param.indexOf('=');
        if (eqIndex !== -1) {
          const key = param.substring(0, eqIndex);
          const value = param.substring(eqIndex + 1);
          parameters.set(key, value);
        }
      }
      
      result.push({ name, parameters });
    }
    
    return result;
  }

  negotiate(offers: Extension[]): string {
    const enabled: string[] = [];
    
    for (const offer of offers) {
      const processor = this.getProcessor(offer.name);
      if (processor && processor.acceptOffer(offer.name + ';' + 
        Array.from(offer.parameters.entries())
          .map(([k, v]) => `${k}=${v}`).join(';'))) {
        enabled.push(processor.getOffer());
      }
    }
    
    return enabled.join(', ');
  }
}
