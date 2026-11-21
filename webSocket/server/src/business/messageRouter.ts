export interface Message {
  id: string;
  type: string;
  payload: any;
  from: string;
  to?: string;
  timestamp: number;
}

export interface MessageHandler {
  (message: Message, context: HandlerContext): void;
}

export interface HandlerContext {
  connectionId: string;
  userId?: string;
  send: (message: Message) => void;
  broadcast: (message: Message, exclude?: string[]) => void;
}

export class MessageRouter {
  private routes: Map<string, MessageHandler> = new Map();
  private wildcardHandler?: MessageHandler;

  register(type: string, handler: MessageHandler): void {
    this.routes.set(type, handler);
  }

  registerWildcard(handler: MessageHandler): void {
    this.wildcardHandler = handler;
  }

  route(message: Message, context: HandlerContext): void {
    const handler = this.routes.get(message.type);
    
    if (handler) {
      handler(message, context);
    } else if (this.wildcardHandler) {
      this.wildcardHandler(message, context);
    }
  }

  unregister(type: string): void {
    this.routes.delete(type);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.routes.keys());
  }
}
