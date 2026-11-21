const fs = require('fs');
const path = require('path');
const config = require('./config.json');

console.log('=== 路径测试 ===');
console.log('__dirname:', __dirname);
console.log('config.rootDirectory:', config.rootDirectory);
console.log('ROOT_DIR:', path.resolve(__dirname, config.rootDirectory));
console.log('');

const ROOT_DIR = path.resolve(__dirname, config.rootDirectory);
console.log('目录是否存在:', fs.existsSync(ROOT_DIR));
console.log('');

if (fs.existsSync(ROOT_DIR)) {
    console.log('目录内容:');
    const files = fs.readdirSync(ROOT_DIR, { withFileTypes: true });
    files.forEach(file => {
        console.log(`  ${file.isDirectory() ? '📁' : '📄'} ${file.name}`);
    });
} else {
    console.log('目录不存在!');
}