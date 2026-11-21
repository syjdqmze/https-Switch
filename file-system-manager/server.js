const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const config = require('./config.json');

const PORT = config.port;
// 使用正斜杠路径格式，避免 Windows 反斜杠编码问题
const ROOT_DIR = path.resolve(__dirname, config.rootDirectory).replace(/\\/g, '/');
const USERNAME = config.username;
const PASSWORD = config.password;

let loggedInTokens = new Set();

function generateToken() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function isAuthenticated(req) {
    const token = req.headers['x-auth-token'];
    return token && loggedInTokens.has(token);
}

function handleLogin(req, res, body) {
    try {
        const { username, password } = JSON.parse(body);
        console.log('登录请求:', { username, password });
        console.log('配置用户名:', USERNAME);
        console.log('配置密码:', PASSWORD);
        
        if (username === USERNAME && password === PASSWORD) {
            const token = generateToken();
            loggedInTokens.add(token);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, token: token }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '用户名或密码错误' }));
        }
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '请求格式错误' }));
    }
}

function handleLogout(req, res) {
    const token = req.headers['x-auth-token'];
    if (token) {
        loggedInTokens.delete(token);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
}

function handleFiles(req, res, query) {
    if (!isAuthenticated(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '未登录' }));
        return;
    }
    
    const currentPath = query.path || '';
    // 确保路径使用正斜杠
    const fullPath = path.join(ROOT_DIR, currentPath).replace(/\\/g, '/');
    
    console.log('请求目录:', currentPath);
    console.log('完整路径:', fullPath);
    console.log('ROOT_DIR:', ROOT_DIR);
    
    // 检查路径是否存在
    if (!fs.existsSync(fullPath)) {
        console.log('目录不存在');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '目录不存在' }));
        return;
    }
    
    fs.readdir(fullPath, { withFileTypes: true, encoding: 'utf8' }, (err, files) => {
        if (err) {
            console.log('读取目录错误:', err);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '无法读取目录: ' + err.message }));
            return;
        }
        
        console.log('读取到文件数量:', files.length);
        
        const fileList = [];
        files.forEach(file => {
            try {
                const filePath = path.join(fullPath, file.name).replace(/\\/g, '/');
                const stats = fs.statSync(filePath);
                fileList.push({
                    name: file.name,
                    isDirectory: file.isDirectory(),
                    size: file.isFile() ? stats.size : 0,
                    mtime: stats.mtime.toISOString(),
                    path: currentPath ? (currentPath + '/' + file.name) : file.name
                });
                console.log('文件:', file.name, file.isDirectory() ? '(文件夹)' : '(文件)');
            } catch (e) {
                console.log('处理文件错误:', file.name, e.message);
            }
        });
        
        fileList.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            currentPath: currentPath,
            parentPath: currentPath ? path.dirname(currentPath) : null,
            files: fileList
        }));
    });
}

function handleDownload(req, res, query) {
    if (!isAuthenticated(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '未登录' }));
        return;
    }
    
    const filePath = query.path;
    // 确保路径使用正斜杠
    const fullPath = path.join(ROOT_DIR, filePath).replace(/\\/g, '/');
    
    console.log('下载请求:', filePath);
    console.log('完整路径:', fullPath);
    
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        console.log('文件不存在');
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('文件不存在');
        return;
    }
    
    const fileName = path.basename(fullPath);
    const fileSize = fs.statSync(fullPath).size;
    
    console.log('开始下载:', fileName, '大小:', fileSize);
    
    res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': fileSize
    });
    
    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
}

function handleStaticFile(req, res, pathname) {
    let filePath = path.join(__dirname, pathname);
    
    if (filePath === path.join(__dirname, '/')) {
        filePath = path.join(__dirname, 'index.html');
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            // 尝试访问父目录 (Http-Switch 根目录)
            const parentDir = path.resolve(__dirname, '..');
            let parentFilePath = path.join(parentDir, pathname);
            
            fs.readFile(parentFilePath, (err2, data2) => {
                if (err2) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                    return;
                }
                
                let contentType = 'text/plain';
                if (parentFilePath.endsWith('.html')) contentType = 'text/html';
                if (parentFilePath.endsWith('.css')) contentType = 'text/css';
                if (parentFilePath.endsWith('.js')) contentType = 'application/javascript';
                
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data2);
            });
            return;
        }
        
        let contentType = 'text/plain';
        if (filePath.endsWith('.html')) contentType = 'text/html';
        if (filePath.endsWith('.css')) contentType = 'text/css';
        if (filePath.endsWith('.js')) contentType = 'application/javascript';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;
    
    console.log(`请求: ${req.method} ${req.url}`);
    
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        if (req.method === 'POST' && pathname === '/login') {
            handleLogin(req, res, body);
        } else if (req.method === 'POST' && pathname === '/logout') {
            handleLogout(req, res);
        } else if (req.method === 'GET' && pathname === '/files') {
            handleFiles(req, res, query);
        } else if (req.method === 'GET' && pathname === '/download') {
            handleDownload(req, res, query);
        } else {
            handleStaticFile(req, res, pathname);
        }
    });
});

if (!fs.existsSync(ROOT_DIR)) {
    fs.mkdirSync(ROOT_DIR, { recursive: true });
    console.log(`创建目录: ${ROOT_DIR}`);
}

server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`管理目录: ${ROOT_DIR}`);
});
