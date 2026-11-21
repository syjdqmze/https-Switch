const express = require('express');
const sftp = require('ssh2-sftp-client');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

let sftpClient = new sftp();

app.get('/api/config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const fileContent = fs.readFileSync(configPath, 'utf8');
    console.log('[Config] Raw config file content:', fileContent);
    
    const config = JSON.parse(fileContent);
    console.log('[Config] Parsed config object:', JSON.stringify(config));
    
    const apiHost = config.apiHost;
    const defaultServerIP = config.defaultServerIP;
    const defaultPort = config.defaultPort;
    
    console.log('[Config] apiHost value:', apiHost);
    console.log('[Config] defaultServerIP value:', defaultServerIP);
    console.log('[Config] defaultPort value:', defaultPort);
    
    const responseConfig = {
      apiHost: apiHost || '',
      defaultServerIP: defaultServerIP || '',
      defaultPort: defaultPort || 22
    };
    
    console.log('[Config] Sending response config:', JSON.stringify(responseConfig));
    
    res.json({ 
      success: true, 
      config: responseConfig
    });
  } catch (error) {
    console.error('[Config] Error reading config:', error.message);
    console.error('[Config] Error stack:', error.stack);
    res.json({
      success: false,
      config: { 
        apiHost: '',
        defaultServerIP: '', 
        defaultPort: 22 
      }
    });
  }
});

app.get('/api/health', (req, res) => {
  console.log('Health check requested from:', req.ip);
  res.json({ success: true, message: 'Backend service is running' });
});

app.post('/api/connect', async (req, res) => {
  console.log('Connect request received:', { host: req.body.host, port: req.body.port, username: req.body.username });
  try {
    const { host, port, username, password, privateKey } = req.body;

    if (!host || !username) {
      return res.status(400).json({ success: false, message: '服务器地址和用户名不能为空' });
    }

    if (sftpClient.client && sftpClient.client._channel) {
      try {
        await sftpClient.end();
      } catch (e) {}
    }

    const config = {
      host: host,
      port: parseInt(port) || 22,
      username: username,
      readyTimeout: 30000,
      timeout: 30000
    };

    if (password) {
      config.password = password;
    } else if (privateKey) {
      config.privateKey = privateKey;
    }

    console.log('Attempting SFTP connection to', host + ':' + config.port);
    await sftpClient.connect(config);
    console.log('SFTP connected successfully');
    await sftpClient.list('/');
    res.json({ success: true, message: 'Connected successfully' });
  } catch (error) {
    console.error('SFTP connection error:', error.message);
    let errorMessage = error.message;
    let suggestion = '';

    if (error.message.includes('ECONNREFUSED')) {
      errorMessage = '连接被拒绝：SFTP服务未启动或端口错误';
      suggestion = '请确认SFTP服务已启动，且端口号正确';
    } else if (error.message.includes('ETIMEDOUT') || error.message.includes('Timeout')) {
      errorMessage = '连接超时：服务器不可达';
      suggestion = '请检查服务器地址是否正确，网络是否通畅';
    } else if (error.message.includes('ENOTFOUND')) {
      errorMessage = '服务器地址无效';
      suggestion = '请检查主机名是否正确';
    } else if (error.message.includes('authentication') || error.message.includes('Auth')) {
      errorMessage = '认证失败：用户名或密码错误';
      suggestion = '请检查用户名和密码是否正确';
    } else if (error.message.includes('Connection lost') || error.message.includes('handshake')) {
      errorMessage = '连接失败：SSH握手失败';
      suggestion = '请确认：1. 端口号正确(默认22) 2. 服务器SSH服务已启动 3. 防火墙已开放该端口';
    } else if (error.message.includes('getConnection')) {
      errorMessage = '获取连接失败';
      suggestion = '请稍后重试，或检查服务器负载';
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      suggestion: suggestion,
      errorCode: error.code || 'UNKNOWN'
    });
  }
});

app.get('/api/list', async (req, res) => {
  try {
    const { path: remotePath } = req.query;
    const files = await sftpClient.list(remotePath || '/');
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/download', async (req, res) => {
  try {
    const { path: remotePath } = req.query;
    const fileName = path.basename(remotePath);
    const localPath = path.join(UPLOAD_DIR, fileName);

    await sftpClient.get(remotePath, localPath);

    res.download(localPath, fileName, (err) => {
      if (err) {
        res.status(500).json({ success: false, message: err.message });
      }
      fs.unlinkSync(localPath);
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { remotePath } = req.body;
    const localPath = req.file.path;
    const fileName = req.file.originalname;
    const destPath = remotePath ? remotePath + '/' + fileName : '/' + fileName;

    await sftpClient.put(localPath, destPath);
    fs.unlinkSync(localPath);
    res.json({ success: true, message: 'File uploaded successfully', path: destPath });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/delete', async (req, res) => {
  try {
    const { path: remotePath } = req.body;
    await sftpClient.delete(remotePath);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/mkdir', async (req, res) => {
  try {
    const { path: remotePath } = req.body;
    await sftpClient.mkdir(remotePath);
    res.json({ success: true, message: 'Directory created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/rmdir', async (req, res) => {
  try {
    const { path: remotePath } = req.body;
    await sftpClient.rmdir(remotePath);
    res.json({ success: true, message: 'Directory removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/rename', async (req, res) => {
  try {
    const { oldPath, newPath } = req.body;
    await sftpClient.rename(oldPath, newPath);
    res.json({ success: true, message: 'File renamed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/disconnect', async (req, res) => {
  try {
    await sftpClient.end();
    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use((req, res, next) => {
  console.error('[404] Route not found:', req.method, req.url);
  res.status(404).json({ 
    success: false, 
    message: 'API路由不存在: ' + req.url,
    suggestion: '请确认后端服务已启动，或检查API地址配置是否正确',
    serverInfo: {
      port: PORT,
      running: true,
      timestamp: new Date().toISOString()
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('SFTP File Manager running on http://0.0.0.0:' + PORT);
});
