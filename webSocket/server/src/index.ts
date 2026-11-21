import { TCPServer, ServerConfig } from './transport/tcpServer';
import { Handshake } from './protocol/handshake';
import { FrameCodec, OpCode, WebSocketFrame } from './protocol/frame';
import { ExtensionManager, PerMessageDeflate } from './protocol/extensions';
import { ConnectionPool, ConnectionStatus } from './connection/connectionPool';
import { HeartbeatManager } from './connection/heartbeat';
import { StateMachineManager } from './connection/stateMachine';
import { MessageRouter, Message, HandlerContext } from './business/messageRouter';
import { SessionManager } from './business/sessionManager';
import { RoomManager, RoomOptions } from './business/roomManager';
import { Logger, LogLevel } from './utils/logger';

const logger = new Logger({ level: LogLevel.DEBUG });

const config: ServerConfig = {
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || '8081', 10),
  maxConnections: parseInt(process.env.MAX_CONNECTIONS || '1000', 10),
  backlog: parseInt(process.env.BACKLOG || '511', 10),
  tls: process.env.WSS_ENABLED === 'true',
  certPath: process.env.WSS_CERT_PATH || './certs/cert.pem',
  keyPath: process.env.WSS_KEY_PATH || './certs/cert.key'
};

console.log(`[Config] Server will listen on ${config.host}:${config.port}`);
console.log(`[Config] TLS: ${config.tls ? 'enabled' : 'disabled'}`);

const connectionPool = new ConnectionPool();
const stateMachineManager = new StateMachineManager();
const sessionManager = new SessionManager(connectionPool);
const roomManager = new RoomManager();
const messageRouter = new MessageRouter();
const extensionManager = new ExtensionManager();

extensionManager.register(new PerMessageDeflate());

const heartbeatManager = new HeartbeatManager(
  connectionPool,
  {
    interval: 30000,
    timeout: 10000,
    maxMissedPings: 3
  },
  sendFrame
);

const server = new TCPServer(config);

function sendFrame(connectionId: string, frame: Buffer): void {
  try {
    server.send(connectionId, frame);
  } catch (error) {
    logger.error('Failed to send frame', { connectionId, error });
  }
}

function sendMessage(connectionId: string, type: string, payload: any): void {
  try {
    const message: Message = {
      id: generateMessageId(),
      type,
      payload,
      from: 'server',
      timestamp: Date.now()
    };

    const json = JSON.stringify(message);
    const frame = FrameCodec.encode(FrameCodec.createTextFrame(json));
    server.send(connectionId, frame);
  } catch (error) {
    logger.error('Failed to send message', { connectionId, type, error });
  }
}

function generateMessageId(): string {
  return Math.random().toString(36).substr(2, 9);
}



function broadcastToRoom(roomId: string, message: Message, excludeUserId?: string): void {
  const room = roomManager.get(roomId);
  if (!room) {
    console.log(`[Broadcast] Room ${roomId} not found`);
    return;
  }

  console.log(`[Broadcast] Room ${roomId} has ${room.members.size} members, excluding: ${excludeUserId}`);

  const json = JSON.stringify(message);
  const frame = FrameCodec.encode(FrameCodec.createTextFrame(json));

  for (const memberId of room.members) {
    if (excludeUserId && memberId === excludeUserId) {
      console.log(`[Broadcast] Skipping sender ${memberId}`);
      continue;
    }

    console.log(`[Broadcast] Looking for sessions of user ${memberId}`);
    const sessions = sessionManager.getByUserId(memberId);
    console.log(`[Broadcast] Found ${sessions.length} sessions for user ${memberId}`);

    for (const session of sessions) {
      try {
        console.log(`[Broadcast] Sending message to connection ${session.connectionId}`);
        server.send(session.connectionId, frame);
        console.log(`[Broadcast] Message sent successfully to ${session.connectionId}`);
      } catch (error) {
        console.error(`[Broadcast] Failed to send to session ${session.connectionId}:`, error);
        logger.error('Failed to broadcast to session', { memberId, connectionId: session.connectionId, error });
      }
    }
  }
}

messageRouter.register('auth', (message: Message, context: HandlerContext) => {
  const { userId } = message.payload;

  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    sendMessage(context.connectionId, 'auth_error', { error: 'User ID is required' });
    return;
  }

  const trimmedUserId = userId.trim();

  const wsConn = connectionPool.getByConnectionId(context.connectionId);
  if (!wsConn) {
    sendMessage(context.connectionId, 'auth_error', { error: 'Connection not found' });
    return;
  }

  sessionManager.create(trimmedUserId, context.connectionId, wsConn.id);
  connectionPool.update(wsConn.id, { userId: trimmedUserId });

  sendMessage(context.connectionId, 'auth_success', { userId: trimmedUserId });
  console.log(`[Auth] User ${trimmedUserId} authenticated on connection ${context.connectionId}`);
  logger.info(`User authenticated: ${trimmedUserId}`, { connectionId: context.connectionId });
});

messageRouter.register('join_room', (message: Message, context: HandlerContext) => {
  const { roomId, password } = message.payload;

  if (!roomId || typeof roomId !== 'string') {
    sendMessage(context.connectionId, 'error', { error: 'Room ID is required' });
    return;
  }

  const wsConn = connectionPool.getByConnectionId(context.connectionId);
  if (!wsConn || !wsConn.userId) {
    sendMessage(context.connectionId, 'error', { error: 'Not authenticated' });
    return;
  }

  console.log(`[JoinRoom] User ${wsConn.userId} joining room ${roomId}`);
  const success = roomManager.join(roomId, wsConn.userId, password);
  console.log(`[JoinRoom] Join result: ${success}`);

  if (success) {
    const room = roomManager.get(roomId);
    if (room) {
      console.log(`[JoinRoom] Room ${roomId} now has ${room.members.size} members`);
      // Send current members list to the joining user
      sendMessage(context.connectionId, 'joined_room', {
        roomId,
        members: Array.from(room.members)
      });
      // Broadcast members update to all room members
      broadcastRoomMembersUpdate(roomId);
    } else {
      sendMessage(context.connectionId, 'joined_room', { roomId });
    }
    logger.info(`User ${wsConn.userId} joined room ${roomId}`);
  } else {
    sendMessage(context.connectionId, 'error', { error: 'Failed to join room' });
  }
});

messageRouter.register('create_room', (message: Message, context: HandlerContext) => {
  const options: RoomOptions = message.payload;

  if (!options.name || typeof options.name !== 'string' || options.name.trim().length === 0) {
    sendMessage(context.connectionId, 'error', { error: 'Room name is required' });
    return;
  }

  options.name = options.name.trim();

  const room = roomManager.create(options);
  if (!room) {
    sendMessage(context.connectionId, 'error', { error: 'Failed to create room' });
    return;
  }

  const roomForClient = {
    ...room,
    members: Array.from(room.members)
  };
  sendMessage(context.connectionId, 'room_created', { room: roomForClient });
  console.log(`[CreateRoom] Room ${room.id} created: ${room.name}`);
  logger.info(`Room created: ${room.id} - ${room.name}`);
});

messageRouter.register('send_message', (message: Message, context: HandlerContext) => {
  const { roomId, content } = message.payload;

  if (!roomId || typeof roomId !== 'string') {
    sendMessage(context.connectionId, 'error', { error: 'Room ID is required' });
    return;
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    sendMessage(context.connectionId, 'error', { error: 'Message content is required' });
    return;
  }

  const wsConn = connectionPool.getByConnectionId(context.connectionId);
  if (!wsConn || !wsConn.userId) {
    sendMessage(context.connectionId, 'error', { error: 'Not authenticated' });
    return;
  }

  const room = roomManager.get(roomId);
  if (!room) {
    sendMessage(context.connectionId, 'error', { error: 'Room not found' });
    return;
  }

  if (!room.members.has(wsConn.userId)) {
    sendMessage(context.connectionId, 'error', { error: 'Not a member of this room' });
    return;
  }

  const broadcastMessage: Message = {
    id: message.id || generateMessageId(),
    type: 'room_message',
    payload: { roomId, content: content.trim(), senderId: wsConn.userId },
    from: wsConn.userId,
    timestamp: Date.now()
  };

  console.log(`[SendMessage] User ${wsConn.userId} sending message to room ${roomId}`);
  broadcastToRoom(roomId, broadcastMessage, wsConn.userId);
  logger.info(`Message sent to room ${roomId} by ${wsConn.userId}`);
});

messageRouter.register('list_rooms', (_message: Message, context: HandlerContext) => {
  const rooms = roomManager.getAll();
  const roomsForClient = rooms.map(room => ({
    ...room,
    members: Array.from(room.members)
  }));
  console.log(`[ListRooms] Returning ${rooms.length} rooms`);
  sendMessage(context.connectionId, 'rooms_list', { rooms: roomsForClient });
});

messageRouter.register('leave_room', (message: Message, context: HandlerContext) => {
  const { roomId } = message.payload;

  if (!roomId || typeof roomId !== 'string') {
    sendMessage(context.connectionId, 'error', { error: 'Room ID is required' });
    return;
  }

  const wsConn = connectionPool.getByConnectionId(context.connectionId);
  if (!wsConn || !wsConn.userId) {
    sendMessage(context.connectionId, 'error', { error: 'Not authenticated' });
    return;
  }

  const success = roomManager.leave(roomId, wsConn.userId);

  if (success) {
    sendMessage(context.connectionId, 'left_room', { roomId });
    // Broadcast members update to remaining room members
    broadcastRoomMembersUpdate(roomId);
    console.log(`[LeaveRoom] User ${wsConn.userId} left room ${roomId}`);
    logger.info(`User ${wsConn.userId} left room ${roomId}`);
  } else {
    sendMessage(context.connectionId, 'error', { error: 'Failed to leave room' });
  }
});

// Screen stop handler - for UI cleanup when screen sharing ends
messageRouter.register('screen_stop', (message: Message, context: HandlerContext) => {
  const { roomId } = message.payload;
  
  if (!roomId || typeof roomId !== 'string') {
    sendMessage(context.connectionId, 'error', { error: 'Room ID is required' });
    return;
  }
  
  const wsConn = connectionPool.getByConnectionId(context.connectionId);
  if (!wsConn || !wsConn.userId) {
    sendMessage(context.connectionId, 'error', { error: 'Not authenticated' });
    return;
  }
  
  const room = roomManager.get(roomId);
  if (!room || !room.members.has(wsConn.userId)) {
    return;
  }
  
  const broadcastMessage: Message = {
    id: generateMessageId(),
    type: 'screen_stop',
    payload: { roomId },
    from: wsConn.userId,
    timestamp: Date.now()
  };
  
  broadcastToRoom(roomId, broadcastMessage, wsConn.userId);
  logger.info(`Screen sharing stopped in room ${roomId} by ${wsConn.userId}`);
});

// ==================== WebRTC Signaling Handlers ====================

// RTC offer handler - forward SDP offer to target user
messageRouter.register('rtc_offer', (message: Message, context: HandlerContext) => {
  const { roomId, targetUserId, offer, isScreenShare, isVideoCall, isAudioCall } = message.payload;

  console.log(`[RTCOffer] Received offer from ${message.from} to ${targetUserId} in room ${roomId}, isScreenShare=${isScreenShare}, isVideoCall=${isVideoCall}`);

  if (!roomId || !targetUserId || !offer) {
    sendMessage(context.connectionId, 'error', { error: 'roomId, targetUserId, and offer are required' });
    return;
  }

  const wsConn = connectionPool.getByConnectionId(context.connectionId);
  if (!wsConn || !wsConn.userId) {
    sendMessage(context.connectionId, 'error', { error: 'Not authenticated' });
    return;
  }

  const room = roomManager.get(roomId);
  if (!room || !room.members.has(wsConn.userId)) {
    sendMessage(context.connectionId, 'error', { error: 'Not a member of this room' });
    return;
  }

  if (!room.members.has(targetUserId)) {
    sendMessage(context.connectionId, 'error', { error: 'Target user not in room' });
    return;
  }

  // Forward offer to target user with media type flags
  const forwardMessage: Message = {
    id: generateMessageId(),
    type: 'rtc_offer',
    payload: {
      roomId,
      fromUserId: wsConn.userId,
      offer,
      isScreenShare: isScreenShare || false,
      isVideoCall: isVideoCall || false,
      isAudioCall: isAudioCall || false
    },
    from: wsConn.userId,
    timestamp: Date.now()
  };

  const targetSessions = sessionManager.getByUserId(targetUserId);
  for (const session of targetSessions) {
    try {
      const json = JSON.stringify(forwardMessage);
      const frame = FrameCodec.encode(FrameCodec.createTextFrame(json));
      server.send(session.connectionId, frame);
      console.log(`[RTCOffer] Forwarded offer to ${targetUserId} on connection ${session.connectionId}`);
    } catch (error) {
      console.error(`[RTCOffer] Failed to forward offer to ${targetUserId}:`, error);
      logger.error('Failed to forward RTC offer', { targetUserId, connectionId: session.connectionId, error });
    }
  }
});

// RTC answer handler - forward SDP answer to target user
messageRouter.register('rtc_answer', (message: Message, context: HandlerContext) => {
  const { roomId, targetUserId, answer } = message.payload;

  console.log(`[RTCAnswer] Received answer from ${message.from} to ${targetUserId}`);

  if (!roomId || !targetUserId || !answer) {
    sendMessage(context.connectionId, 'error', { error: 'roomId, targetUserId, and answer are required' });
    return;
  }

  const wsConn = connectionPool.getByConnectionId(context.connectionId);
  if (!wsConn || !wsConn.userId) {
    sendMessage(context.connectionId, 'error', { error: 'Not authenticated' });
    return;
  }

  const room = roomManager.get(roomId);
  if (!room || !room.members.has(wsConn.userId)) {
    sendMessage(context.connectionId, 'error', { error: 'Not a member of this room' });
    return;
  }

  // Forward answer to target user
  const forwardMessage: Message = {
    id: generateMessageId(),
    type: 'rtc_answer',
    payload: {
      roomId,
      fromUserId: wsConn.userId,
      answer
    },
    from: wsConn.userId,
    timestamp: Date.now()
  };

  const targetSessions = sessionManager.getByUserId(targetUserId);
  for (const session of targetSessions) {
    try {
      const json = JSON.stringify(forwardMessage);
      const frame = FrameCodec.encode(FrameCodec.createTextFrame(json));
      server.send(session.connectionId, frame);
      console.log(`[RTCAnswer] Forwarded answer to ${targetUserId}`);
    } catch (error) {
      console.error(`[RTCAnswer] Failed to forward answer:`, error);
      logger.error('Failed to forward RTC answer', { targetUserId, connectionId: session.connectionId, error });
    }
  }
});

// RTC ICE candidate handler - forward ICE candidate to target user
messageRouter.register('rtc_ice_candidate', (message: Message, context: HandlerContext) => {
  const { roomId, targetUserId, candidate } = message.payload;

  console.log(`[RTCIce] Received ICE candidate from ${message.from} to ${targetUserId}`);

  if (!roomId || !targetUserId || !candidate) {
    sendMessage(context.connectionId, 'error', { error: 'roomId, targetUserId, and candidate are required' });
    return;
  }

  const wsConn = connectionPool.getByConnectionId(context.connectionId);
  if (!wsConn || !wsConn.userId) {
    sendMessage(context.connectionId, 'error', { error: 'Not authenticated' });
    return;
  }

  const room = roomManager.get(roomId);
  if (!room || !room.members.has(wsConn.userId)) {
    sendMessage(context.connectionId, 'error', { error: 'Not a member of this room' });
    return;
  }

  // Forward ICE candidate to target user
  const forwardMessage: Message = {
    id: generateMessageId(),
    type: 'rtc_ice_candidate',
    payload: {
      roomId,
      fromUserId: wsConn.userId,
      candidate
    },
    from: wsConn.userId,
    timestamp: Date.now()
  };

  const targetSessions = sessionManager.getByUserId(targetUserId);
  for (const session of targetSessions) {
    try {
      const json = JSON.stringify(forwardMessage);
      const frame = FrameCodec.encode(FrameCodec.createTextFrame(json));
      server.send(session.connectionId, frame);
      console.log(`[RTCIce] Forwarded ICE candidate to ${targetUserId}`);
    } catch (error) {
      console.error(`[RTCIce] Failed to forward ICE candidate:`, error);
      logger.error('Failed to forward RTC ICE candidate', { targetUserId, connectionId: session.connectionId, error });
    }
  }
});

// RTC video off notification handler - notify room members that video is off
messageRouter.register('rtc_video_off', (message: Message, context: HandlerContext) => {
  const { roomId } = message.payload;

  console.log(`[RTCVideoOff] User ${message.from} turned off video in room ${roomId}`);

  if (!roomId) {
    sendMessage(context.connectionId, 'error', { error: 'roomId is required' });
    return;
  }

  const wsConn = connectionPool.getByConnectionId(context.connectionId);
  if (!wsConn || !wsConn.userId) {
    sendMessage(context.connectionId, 'error', { error: 'Not authenticated' });
    return;
  }

  const room = roomManager.get(roomId);
  if (!room || !room.members.has(wsConn.userId)) {
    sendMessage(context.connectionId, 'error', { error: 'Not a member of this room' });
    return;
  }

  // Broadcast video off notification to all room members except sender
  const forwardMessage: Message = {
    id: generateMessageId(),
    type: 'rtc_video_off',
    payload: {
      roomId,
      fromUserId: wsConn.userId
    },
    from: wsConn.userId,
    timestamp: Date.now()
  };

  for (const memberId of room.members) {
    if (memberId === wsConn.userId) continue;
    const sessions = sessionManager.getByUserId(memberId);
    for (const session of sessions) {
      try {
        const json = JSON.stringify(forwardMessage);
        const frame = FrameCodec.encode(FrameCodec.createTextFrame(json));
        server.send(session.connectionId, frame);
        console.log(`[RTCVideoOff] Notified ${memberId} that ${wsConn.userId} turned off video`);
      } catch (error) {
        console.error(`[RTCVideoOff] Failed to notify ${memberId}:`, error);
      }
    }
  }
});

// RTC connect request handler - request WebRTC connection with target user
messageRouter.register('rtc_connect_request', (message: Message, context: HandlerContext) => {
  const { roomId, targetUserId, mediaTypes } = message.payload;

  console.log(`[RTCConnect] ${message.from} requesting connection with ${targetUserId} for ${JSON.stringify(mediaTypes)}`);

  if (!roomId || !targetUserId) {
    sendMessage(context.connectionId, 'error', { error: 'roomId and targetUserId are required' });
    return;
  }

  const wsConn = connectionPool.getByConnectionId(context.connectionId);
  if (!wsConn || !wsConn.userId) {
    sendMessage(context.connectionId, 'error', { error: 'Not authenticated' });
    return;
  }

  const room = roomManager.get(roomId);
  if (!room || !room.members.has(wsConn.userId)) {
    sendMessage(context.connectionId, 'error', { error: 'Not a member of this room' });
    return;
  }

  if (!room.members.has(targetUserId)) {
    sendMessage(context.connectionId, 'error', { error: 'Target user not in room' });
    return;
  }

  // Forward connection request to target user
  const forwardMessage: Message = {
    id: generateMessageId(),
    type: 'rtc_connect_request',
    payload: {
      roomId,
      fromUserId: wsConn.userId,
      mediaTypes: mediaTypes || { audio: false, video: false, screen: false }
    },
    from: wsConn.userId,
    timestamp: Date.now()
  };

  const targetSessions = sessionManager.getByUserId(targetUserId);
  for (const session of targetSessions) {
    try {
      const json = JSON.stringify(forwardMessage);
      const frame = FrameCodec.encode(FrameCodec.createTextFrame(json));
      server.send(session.connectionId, frame);
      console.log(`[RTCConnect] Forwarded connection request to ${targetUserId}`);
    } catch (error) {
      console.error(`[RTCConnect] Failed to forward connection request:`, error);
      logger.error('Failed to forward RTC connect request', { targetUserId, connectionId: session.connectionId, error });
    }
  }
});

// RTC disconnect handler - notify target user about disconnection
messageRouter.register('rtc_disconnect', (message: Message, context: HandlerContext) => {
  const { roomId, targetUserId } = message.payload;

  console.log(`[RTCDisconnect] ${message.from} disconnecting from ${targetUserId}`);

  if (!roomId || !targetUserId) {
    sendMessage(context.connectionId, 'error', { error: 'roomId and targetUserId are required' });
    return;
  }

  const wsConn = connectionPool.getByConnectionId(context.connectionId);
  if (!wsConn || !wsConn.userId) {
    sendMessage(context.connectionId, 'error', { error: 'Not authenticated' });
    return;
  }

  const room = roomManager.get(roomId);
  if (!room) {
    return; // Room might have been deleted, just ignore
  }

  // Notify target user about disconnection
  const forwardMessage: Message = {
    id: generateMessageId(),
    type: 'rtc_disconnect',
    payload: {
      roomId,
      fromUserId: wsConn.userId
    },
    from: wsConn.userId,
    timestamp: Date.now()
  };

  const targetSessions = sessionManager.getByUserId(targetUserId);
  for (const session of targetSessions) {
    try {
      const json = JSON.stringify(forwardMessage);
      const frame = FrameCodec.encode(FrameCodec.createTextFrame(json));
      server.send(session.connectionId, frame);
      console.log(`[RTCDisconnect] Notified ${targetUserId} about disconnection`);
    } catch (error) {
      logger.error('Failed to forward RTC disconnect', { targetUserId, connectionId: session.connectionId, error });
    }
  }
});

// Broadcast room members update when user joins/leaves
function broadcastRoomMembersUpdate(roomId: string): void {
  const room = roomManager.get(roomId);
  if (!room) return;

  const membersList = Array.from(room.members);
  const updateMessage: Message = {
    id: generateMessageId(),
    type: 'room_members_update',
    payload: {
      roomId,
      members: membersList
    },
    from: 'server',
    timestamp: Date.now()
  };

  for (const memberId of membersList) {
    const sessions = sessionManager.getByUserId(memberId);
    for (const session of sessions) {
      try {
        const json = JSON.stringify(updateMessage);
        const frame = FrameCodec.encode(FrameCodec.createTextFrame(json));
        server.send(session.connectionId, frame);
      } catch (error) {
        logger.error('Failed to send room members update', { memberId, connectionId: session.connectionId, error });
      }
    }
  }
}

messageRouter.registerWildcard((message: Message, context: HandlerContext) => {
  logger.warn(`Unknown message type: ${message.type}`, { connectionId: context.connectionId });
});

server.on('connection', (connection) => {
  logger.info(`New connection: ${connection.id} from ${connection.remoteAddress}:${connection.remotePort}`);
  console.log(`[Server] New connection: ${connection.id}`);

  try {
    const wsConn = connectionPool.add(connection.id);
    stateMachineManager.create(connection.id);
    stateMachineManager.transition(connection.id, ConnectionStatus.CONNECTING);
    console.log(`[Server] WSConnection created for ${connection.id}`);
  } catch (error) {
    logger.error('Failed to handle new connection', { connectionId: connection.id, error });
    server.closeConnection(connection.id);
  }
});

server.on('data', (_connection, _data) => {
  const connection = _connection;

  try {
    const wsConn = connectionPool.getByConnectionId(connection.id);

    if (!wsConn) {
      console.log(`[Server] No WSConnection for ${connection.id}`);
      server.closeConnection(connection.id);
      return;
    }

    logger.debug(`Received data: ${connection.buffer.length} bytes`, { connectionId: connection.id });

    if (wsConn.status === ConnectionStatus.CONNECTING) {
      processHandshake(connection, wsConn);
      return;
    }

    if (wsConn.status !== ConnectionStatus.OPEN) {
      return;
    }

    processFrames(connection.id, connection);
  } catch (error) {
    logger.error('Error processing data', { connectionId: connection.id, error });
    server.closeConnection(connection.id);
  }
});

function processHandshake(connection: any, wsConn: any): void {
  const headerEnd = connection.buffer.indexOf('\r\n\r\n');

  if (headerEnd === -1) {
    if (connection.buffer.length > 8192) {
      server.closeConnection(connection.id);
    }
    return;
  }

  const request = Handshake.parseRequest(connection.buffer);

  if (!request || !Handshake.isWebSocketUpgrade(request)) {
    server.closeConnection(connection.id);
    return;
  }

  const response = Handshake.createResponse(request);
  const responseBuffer = Handshake.serializeResponse(response);

  server.send(connection.id, responseBuffer);

  stateMachineManager.transition(connection.id, ConnectionStatus.OPEN);
  connectionPool.update(wsConn.id, { status: ConnectionStatus.OPEN });

  heartbeatManager.start(connection.id);

  const remainingData = connection.buffer.slice(headerEnd + 4);
  connection.buffer = remainingData;

  logger.info(`WebSocket handshake complete: ${connection.id}`);
  console.log(`[Handshake] Complete for ${connection.id}`);

  if (remainingData.length > 0) {
    processFrames(connection.id, connection);
  }
}

// Maximum buffer size to prevent memory attacks (1MB)
const MAX_BUFFER_SIZE = 1024 * 1024;

// Fragmented message buffer for handling continuation frames
const fragmentedMessages: Map<string, { 
  opcode: OpCode; 
  buffer: Buffer[]; 
  totalLength: number 
}> = new Map();

function processFrames(connectionId: string, connection: any): void {
  try {
    // Protect against memory attacks
    if (connection.buffer.length > MAX_BUFFER_SIZE) {
      logger.error('Buffer overflow detected', { 
        connectionId, 
        bufferSize: connection.buffer.length 
      });
      server.closeConnection(connectionId);
      return;
    }

    while (connection.buffer.length > 0) {
      const result = FrameCodec.decode(connection.buffer);

      if (!result) {
        logger.debug(`Frame decode returned null, buffer length: ${connection.buffer.length}`, { connectionId });
        break;
      }

      const { frame, consumed } = result;
      
      // Validate frame
      if (!validateFrame(frame, connectionId)) {
        logger.error('Invalid frame detected', { 
          connectionId, 
          opcode: frame.opcode,
          payloadLength: frame.payloadLength 
        });
        server.closeConnection(connectionId);
        return;
      }

      logger.debug(`Decoded frame: opcode=${frame.opcode}, fin=${frame.fin}, mask=${frame.mask}, length=${frame.payloadLength}`, { connectionId });

      connection.buffer = connection.buffer.slice(consumed);

      handleFrame(connectionId, frame, connection);
    }
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error processing frames', { 
      connectionId, 
      error: err.message,
      stack: err.stack,
      bufferLength: connection.buffer?.length || 0
    });
    
    try {
      server.closeConnection(connectionId);
    } catch (closeError: unknown) {
      const closeErr = closeError as Error;
      logger.error('Failed to close connection after error', { connectionId, error: closeErr.message });
    }
  }
}

function validateFrame(frame: WebSocketFrame, connectionId: string): boolean {
  // Check for reserved bits (should be 0 for standard WebSocket)
  if (frame.rsv1 || frame.rsv2 || frame.rsv3) {
    logger.warn('Reserved bits set in frame', { rsv1: frame.rsv1, rsv2: frame.rsv2, rsv3: frame.rsv3 });
    // Allow reserved bits if extensions are negotiated
    return true;
  }

  // Check for valid opcode
  const validOpcodes = [
    OpCode.CONTINUATION,
    OpCode.TEXT,
    OpCode.BINARY,
    OpCode.CLOSE,
    OpCode.PING,
    OpCode.PONG
  ];
  
  if (!validOpcodes.includes(frame.opcode)) {
    logger.error(`Invalid opcode: ${frame.opcode}`, { });
    return false;
  }

  // Check for maximum payload size (10MB)
  if (frame.payloadLength > 10 * 1024 * 1024) {
    logger.error('Payload too large', { payloadLength: frame.payloadLength });
    return false;
  }

  // Validate continuation frame sequence
  if (frame.opcode === OpCode.CONTINUATION) {
    const fragmented = fragmentedMessages.get(connectionId);
    if (!fragmented) {
      logger.error('Received continuation frame without starting frame', { connectionId });
      return false;
    }
    
    // Check total accumulated size
    if (fragmented.totalLength + frame.payloadLength > MAX_BUFFER_SIZE) {
      logger.error('Fragmented message too large', { 
        connectionId,
        totalLength: fragmented.totalLength + frame.payloadLength 
      });
      return false;
    }
  }

  // Client frames must be masked
  if (!frame.mask) {
    logger.warn('Unmasked frame received from client', { });
    // For now, allow it but log a warning
  }

  return true;
}

function handleFrame(connectionId: string, frame: WebSocketFrame, connection: any): void {
  connectionPool.updateActivity(connectionId);

  try {
    // Handle continuation frames for fragmented messages
    if (frame.opcode === OpCode.CONTINUATION) {
      const fragmented = fragmentedMessages.get(connectionId);
      if (!fragmented) {
        logger.error('Received continuation frame without starting frame', { connectionId });
        return;
      }

      // Accumulate payload data
      fragmented.buffer.push(frame.payloadData);
      fragmented.totalLength += frame.payloadLength;

      logger.debug(`Continuation frame accumulated, total length: ${fragmented.totalLength}`, { connectionId });

      // If this is the final frame (fin=true), process the complete message
      if (frame.fin) {
        const completePayload = Buffer.concat(fragmented.buffer);
        logger.info(`Fragmented message complete, total length: ${completePayload.length}`, { connectionId });

        // Create a synthetic frame with the complete payload
        const completeFrame: WebSocketFrame = {
          fin: true,
          rsv1: false,
          rsv2: false,
          rsv3: false,
          opcode: fragmented.opcode,
          mask: false,
          payloadLength: completePayload.length,
          payloadData: completePayload
        };

        // Clean up fragmented message buffer
        fragmentedMessages.delete(connectionId);

        // Process the complete message
        processCompleteFrame(connectionId, completeFrame);
      }
      return;
    }

    // Handle non-fragmented frames or start of fragmented message
    if (!frame.fin) {
      // This is the start of a fragmented message
      if (frame.opcode === OpCode.TEXT || frame.opcode === OpCode.BINARY) {
        logger.info(`Starting fragmented message, opcode: ${frame.opcode}`, { connectionId });
        
        fragmentedMessages.set(connectionId, {
          opcode: frame.opcode,
          buffer: [frame.payloadData],
          totalLength: frame.payloadLength
        });
        return;
      } else {
        logger.error('Non-final frame with invalid opcode', { 
          connectionId, 
          opcode: frame.opcode 
        });
        return;
      }
    }

    // Process complete non-fragmented frame
    processCompleteFrame(connectionId, frame);

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error handling frame', { 
      connectionId, 
      opcode: frame.opcode, 
      error: err.message,
      stack: err.stack 
    });
    
    try {
      server.send(connectionId, FrameCodec.encode(FrameCodec.createCloseFrame(1008, 'Invalid frame')));
    } catch (sendError: unknown) {
      const sendErr = sendError as Error;
      logger.error('Failed to send close frame', { connectionId, error: sendErr.message });
    }
    
    setTimeout(() => {
      try {
        server.closeConnection(connectionId);
      } catch (closeError: unknown) {
        const closeErr = closeError as Error;
        logger.error('Failed to close connection', { connectionId, error: closeErr.message });
      }
    }, 1000);
  }
}

function processCompleteFrame(connectionId: string, frame: WebSocketFrame): void {
  switch (frame.opcode) {
    case OpCode.TEXT: {
      const text = frame.payloadData.toString('utf8');
      logger.debug(`Received text message: ${text.length} chars`, { connectionId });

      if (!text || text.trim().length === 0) {
        logger.warn('Received empty text message', { connectionId });
        return;
      }

      let message: Message;
      try {
        message = JSON.parse(text);
      } catch (parseError: unknown) {
        const parseErr = parseError as Error;
        logger.error('Failed to parse JSON message', { 
          connectionId, 
          error: parseErr.message,
          textLength: text.length,
          sampleText: text.length > 100 ? text.substring(0, 100) + '...' : text
        });
        return;
      }

      if (!message.type) {
        logger.warn('Received message without type field', { connectionId });
        return;
      }

      console.log(`[HandleFrame] Message type: ${message.type} from ${message.from}`);

      const wsConn = connectionPool.getByConnectionId(connectionId);

      const context: HandlerContext = {
        connectionId,
        userId: wsConn?.userId,
        send: (msg) => {
          const json = JSON.stringify(msg);
          const responseFrame = FrameCodec.encode(FrameCodec.createTextFrame(json));
          server.send(connectionId, responseFrame);
        },
        broadcast: (_msg, _exclude) => {}
      };

      messageRouter.route(message, context);
      break;
    }

    case OpCode.BINARY:
      logger.info('Binary frame received', { connectionId, length: frame.payloadLength });
      break;

    case OpCode.PING: {
      const pongFrame = FrameCodec.encode(FrameCodec.createPongFrame(frame.payloadData));
      server.send(connectionId, pongFrame);
      break;
    }

    case OpCode.PONG:
      heartbeatManager.receivePong(connectionId);
      break;

    case OpCode.CLOSE: {
      handleCloseFrame(connectionId, frame);
      break;
    }

    case OpCode.CONTINUATION:
      // Already handled in handleFrame, should not reach here
      logger.warn('Unexpected continuation frame in processCompleteFrame', { connectionId });
      break;

    default:
      logger.warn(`Unknown opcode: ${frame.opcode}`, { connectionId });
      break;
  }
}

function handleCloseFrame(connectionId: string, frame: WebSocketFrame): void {
  const code = frame.payloadLength >= 2
    ? frame.payloadData.readUInt16BE(0)
    : 1000;
  const reason = frame.payloadLength > 2
    ? frame.payloadData.slice(2).toString('utf8')
    : '';

  logger.info(`Close frame received: ${code} - ${reason}`, { connectionId });

  const closeFrame = FrameCodec.encode(FrameCodec.createCloseFrame(code, reason));
  server.send(connectionId, closeFrame);

  stateMachineManager.transition(connectionId, ConnectionStatus.CLOSING);
  connectionPool.update(connectionId, { status: ConnectionStatus.CLOSING });

  setTimeout(() => {
    server.closeConnection(connectionId);
  }, 1000);
}

server.on('close', (connection, error) => {
  logger.info(`Connection closed: ${connection.id}`, { error: error?.message });

  try {
    heartbeatManager.stop(connection.id);
    stateMachineManager.remove(connection.id);
    sessionManager.removeByConnectionId(connection.id);
    connectionPool.removeByConnectionId(connection.id);
    
    // Clean up fragmented message buffer
    fragmentedMessages.delete(connection.id);
  } catch (error) {
    logger.error('Error cleaning up connection', { connectionId: connection.id, error });
  }
});

server.on('error', (error) => {
  logger.error('Server error', { error });
});

server.on('listening', () => {
  const protocol = config.tls ? 'wss' : 'ws';
  logger.info(`WebSocket server started on ${protocol}://${config.host}:${config.port}`);
});

async function startServer(): Promise<void> {
  try {
    await server.listen();
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  try {
    await server.close();
  } catch (error) {
    logger.error('Error during server shutdown', { error });
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection', { error });
});

startServer();