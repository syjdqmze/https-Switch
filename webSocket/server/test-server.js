const WebSocket = require('ws');

async function testWebSocket() {
  console.log('=== WebSocket 协议测试 ===');
  
  const ws1 = new WebSocket('ws://localhost:8081');
  const ws2 = new WebSocket('ws://localhost:8081');
  
  return new Promise((resolve) => {
    let connected = 0;
    let roomCreated = false;
    let messageReceived = false;
    
    const sendAuth = (ws, userId) => {
      ws.send(JSON.stringify({
        id: Math.random().toString(36).substr(2, 9),
        type: 'auth',
        payload: { userId },
        from: userId,
        timestamp: Date.now()
      }));
    };
    
    const sendCreateRoom = (ws, userId) => {
      ws.send(JSON.stringify({
        id: Math.random().toString(36).substr(2, 9),
        type: 'create_room',
        payload: { name: '测试房间', topic: '测试主题', maxMembers: 10 },
        from: userId,
        timestamp: Date.now()
      }));
    };
    
    const sendJoinRoom = (ws, userId, roomId) => {
      ws.send(JSON.stringify({
        id: Math.random().toString(36).substr(2, 9),
        type: 'join_room',
        payload: { roomId },
        from: userId,
        timestamp: Date.now()
      }));
    };
    
    const sendMessage = (ws, userId, roomId, content) => {
      ws.send(JSON.stringify({
        id: Math.random().toString(36).substr(2, 9),
        type: 'send_message',
        payload: { roomId, content },
        from: userId,
        timestamp: Date.now()
      }));
    };
    
    ws1.on('open', () => {
      console.log('[OK] 客户端1连接成功');
      sendAuth(ws1, 'user1');
    });
    
    ws2.on('open', () => {
      console.log('[OK] 客户端2连接成功');
      sendAuth(ws2, 'user2');
    });
    
    let roomId = '';
    
    ws1.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log(`[客户端1收到] 类型: ${msg.type}`);
      
      if (msg.type === 'auth_success') {
        connected++;
        console.log('[OK] 用户1认证成功');
        sendCreateRoom(ws1, 'user1');
      } else if (msg.type === 'room_created') {
        roomId = msg.payload.room.id;
        console.log(`[OK] 房间创建成功: ${roomId}`);
        roomCreated = true;
        sendJoinRoom(ws1, 'user1', roomId);
      } else if (msg.type === 'joined_room') {
        console.log('[OK] 用户1加入房间');
        if (connected === 2) {
          sendJoinRoom(ws2, 'user2', roomId);
        }
      }
    });
    
    ws2.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log(`[客户端2收到] 类型: ${msg.type}`);
      
      if (msg.type === 'auth_success') {
        connected++;
        console.log('[OK] 用户2认证成功');
        if (roomCreated && roomId) {
          sendJoinRoom(ws2, 'user2', roomId);
        }
      } else if (msg.type === 'joined_room') {
        console.log('[OK] 用户2加入房间');
        console.log('=== 开始发送消息测试 ===');
        sendMessage(ws1, 'user1', roomId, '你好，这是一条测试消息！');
      } else if (msg.type === 'room_message') {
        console.log(`[OK] 收到消息: ${msg.payload.content}`);
        console.log(`[OK] 发送者: ${msg.payload.senderId}`);
        messageReceived = true;
        
        setTimeout(() => {
          ws1.close();
          ws2.close();
          resolve();
        }, 1000);
      }
    });
    
    ws1.on('error', (err) => {
      console.error('[ERROR] 客户端1错误:', err);
    });
    
    ws2.on('error', (err) => {
      console.error('[ERROR] 客户端2错误:', err);
    });
  });
}

testWebSocket().then(() => {
  console.log('\n=== 所有测试通过！ ===');
  process.exit(0);
}).catch((err) => {
  console.error('[ERROR] 测试失败:', err);
  process.exit(1);
});
