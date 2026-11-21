// VoiceClone 本地服务
// 职责：1) 托管 VoiceClone 静态页面  2) 代理阿里百炼(DashScope) CosyVoice 声音复刻与语音合成
// 说明：浏览器直连 DashScope 存在跨域限制，故由本服务转发；仅依赖 ws 库（npm install ws）
// 启动：node server.js  →  http://localhost:8930

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');

const PORT = 8930;
const ROOT = __dirname;
// 参考音频暂存目录：注册时生成公网可访问 URL 供 DashScope 下载
const UPLOAD_DIR = path.join(ROOT, 'uploads');
try { fs.mkdirSync(UPLOAD_DIR); } catch (e) {}

// 业务空间 ID（百炼新版接口架构必需）
const WORKSPACE_ID = 'ws-88ow1set49zqbp4g';

// DashScope 接口（新版 MaaS 工作空间域名）
const ENROLL_URL = 'https://' + WORKSPACE_ID + '.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/customization';
const WS_URL = 'wss://' + WORKSPACE_ID + '.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference';
const TTS_MODEL = 'cosyvoice-v2';

// 默认阿里百炼 API Key（前端留空时使用；页面设置入口可覆盖）
// 优先读环境变量 DASHSCOPE_API_KEY，其次读本地 config.local.json（已在 .gitignore 中忽略）
function loadDefaultApiKey() {
  if (process.env.DASHSCOPE_API_KEY) return process.env.DASHSCOPE_API_KEY.trim();
  try {
    const local = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.local.json'), 'utf8'));
    if (local && local.apiKey) return String(local.apiKey).trim();
  } catch (e) {}
  return '';
}
const DEFAULT_API_KEY = loadDefaultApiKey();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req, limitBytes) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on('data', function (c) {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', function () {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ---------- 音色注册：上传参考音频，返回克隆音色 voiceId ----------
async function handleEnroll(req, body) {
  const apiKey = body.apiKey || DEFAULT_API_KEY;
  if (!apiKey) {
    return { status: 400, out: { error: '未配置 API Key：请设置环境变量 DASHSCOPE_API_KEY 或创建 config.local.json' } };
  }
  if (!body.audioDataUrl || body.audioDataUrl.indexOf('base64,') === -1) {
    return { status: 400, out: { error: '缺少音频数据 audioDataUrl' } };
  }
  // 保存音频并生成公网可访问 URL（CosyVoice 注册只接受 URL，不支持 data URI）
  const b64 = body.audioDataUrl.slice(body.audioDataUrl.indexOf(',') + 1);
  const fname = 'ref-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.wav';
  const fpath = path.join(UPLOAD_DIR, fname);
  try {
    fs.writeFileSync(fpath, Buffer.from(b64, 'base64'));
  } catch (e) {
    return { status: 500, out: { error: '音频保存失败：' + e.message } };
  }
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const audioUrl = proto + '://' + req.headers.host + '/uploads/' + fname;
  // prefix 规则：仅小写字母和数字
  const prefix = 'vc' + Math.random().toString(36).slice(2, 6).replace(/[^a-z0-9]/g, 'a');
  let resp, data;
  try {
    resp = await fetch(ENROLL_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'voice-enrollment',
        input: {
          action: 'create_voice',
          target_model: TTS_MODEL,
          prefix: prefix,
          url: audioUrl
        }
      })
    });
    data = await resp.json().catch(function () { return {}; });
  } catch (e) {
    return { status: 502, out: { error: '无法连接 DashScope：' + e.message } };
  }
  // 注册完成（无论成败）10 分钟后清理暂存音频
  setTimeout(function () { fs.unlink(fpath, function () {}); }, 10 * 60 * 1000);
  if (!resp.ok) {
    const msg = (data && (data.message || data.code)) || ('HTTP ' + resp.status);
    return { status: resp.status, out: { error: '音色注册失败：' + msg } };
  }
  const voiceId = data && data.output && data.output.voice_id;
  if (!voiceId) {
    return { status: 502, out: { error: '音色注册未返回 voice_id：' + JSON.stringify(data).slice(0, 300) } };
  }
  return { status: 200, out: { voiceId: voiceId } };
}

// ---------- 语音合成：CosyVoice v2 WebSocket，收集 mp3 音频帧 ----------
function synthesize(apiKey, voiceId, text) {
  return new Promise(function (resolve, reject) {
    const taskId = crypto.randomUUID();
    let ws;
    try {
      // 新版接口要求 Authorization 头认证（不支持 api-key 查询参数）
      ws = new WebSocket(WS_URL, { headers: { 'Authorization': 'bearer ' + apiKey } });
    } catch (e) {
      reject(new Error('无法创建 WebSocket：' + e.message));
      return;
    }

    const chunks = [];
    let done = false;
    const timer = setTimeout(function () { finish(new Error('合成超时（180s）')); }, 180000);

    function finish(err) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch (e) { /* 忽略 */ }
      if (err) reject(err);
      else resolve(Buffer.concat(chunks));
    }

    function send(obj) { ws.send(JSON.stringify(obj)); }

    ws.on('open', function () {
      send({
        header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
        payload: {
          task_group: 'audio',
          task: 'tts',
          function: 'SpeechSynthesizer',
          model: TTS_MODEL,
          parameters: {
            text_type: 'PlainText',
            voice: voiceId,
            format: 'mp3',
            sample_rate: 22050,
            volume: 50,
            rate: 1,
            pitch: 1
          },
          input: {}
        }
      });
    });

    ws.on('message', function (data, isBinary) {
      if (isBinary) {
        chunks.push(Buffer.from(data));
        return;
      }
      let msg;
      try { msg = JSON.parse(data.toString('utf8')); } catch (e) { return; }
      const header = (msg && msg.header) || {};
      if (header.event === 'task-started') {
        send({
          header: { action: 'continue-task', task_id: taskId, streaming: 'duplex' },
          payload: { input: { text: text } }
        });
        send({
          header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
          payload: { input: {} }
        });
      } else if (header.event === 'task-finished') {
        finish(null);
      } else if (header.event === 'task-failed') {
        finish(new Error('合成失败：' + (header.error_message || header.error_code || '') + ' | 详情：' + JSON.stringify(msg).slice(0, 600)));
      }
      // 其他事件（result-generated 等）忽略
    });

    ws.on('error', function (err) {
      finish(new Error('WebSocket 连接失败：' + ((err && err.message) || '请检查 API Key 与网络')));
    });

    ws.on('close', function () {
      if (!done) finish(new Error('连接提前关闭'));
    });
  });
}

// ---------- HTTP 服务 ----------
const server = http.createServer(async function (req, res) {
  // 允许跨域：便于部署时页面与 API 分离（如 nginx 静态 + node API）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 音色注册代理
  if (req.method === 'POST' && req.url === '/api/enroll') {
    try {
      const body = await readBody(req, 50 * 1024 * 1024);
      const out = await handleEnroll(req, body);
      sendJSON(res, out.status, out.out);
    } catch (e) {
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  // 语音合成代理
  if (req.method === 'POST' && req.url === '/api/synthesize') {
    try {
      const body = await readBody(req, 1024 * 1024);
      if (!body.voiceId || !body.text) {
        sendJSON(res, 400, { error: '缺少 voiceId / text' });
        return;
      }
      const apiKey = body.apiKey || DEFAULT_API_KEY;
      if (!apiKey) {
        sendJSON(res, 400, { error: '未配置 API Key：请设置环境变量 DASHSCOPE_API_KEY 或创建 config.local.json' });
        return;
      }
      const audio = await synthesize(apiKey, body.voiceId, body.text);
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': audio.length });
      res.end(audio);
    } catch (e) {
      sendJSON(res, 502, { error: e.message });
    }
    return;
  }

  // 静态文件
  if (req.method === 'GET') {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    // 禁止下载服务端源码与本地密钥配置
    const blockedNames = ['server.js', 'config.local.json', 'config.example.json'];
    if (blockedNames.indexOf(path.basename(filePath)) !== -1) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.readFile(filePath, function (err, buf) {
      if (err) {
        res.writeHead(404); res.end('Not Found'); return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(buf);
    });
    return;
  }

  res.writeHead(405); res.end('Method Not Allowed');
});

server.listen(PORT, function () {
  console.log('VoiceClone server running at http://localhost:' + PORT);
});
