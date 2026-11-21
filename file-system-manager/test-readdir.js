const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../filesys');

console.log('ROOT_DIR:', ROOT_DIR);
console.log('是否存在:', fs.existsSync(ROOT_DIR));

// 尝试多种方式读取目录
console.log('\n=== 方式1: fs.readdirSync ===');
try {
    const files1 = fs.readdirSync(ROOT_DIR);
    console.log('结果:', files1);
} catch (e) {
    console.log('错误:', e.message);
}

console.log('\n=== 方式2: fs.readdirSync with withFileTypes ===');
try {
    const files2 = fs.readdirSync(ROOT_DIR, { withFileTypes: true });
    console.log('结果:', files2.map(f => f.name));
} catch (e) {
    console.log('错误:', e.message);
}

console.log('\n=== 方式3: fs.readdir (异步) ===');
fs.readdir(ROOT_DIR, (err, files) => {
    if (err) {
        console.log('错误:', err.message);
    } else {
        console.log('结果:', files);
    }
});

console.log('\n=== 方式4: 使用 buffer ===');
try {
    const files4 = fs.readdirSync(ROOT_DIR, { encoding: 'buffer' });
    console.log('结果:', files4.map(f => f.toString('utf8')));
} catch (e) {
    console.log('错误:', e.message);
}