module.exports = {
  apps: [{
    name: 'websocket-server',
    script: 'dist/index.js',
    cwd: './',
    
    // 环境变量配置
    env_development: {
      NODE_ENV: 'development',
      PORT: 8081,
      HOST: '0.0.0.0',
      MAX_CONNECTIONS: 1000
    },
    
    env_production: {
      NODE_ENV: 'production',
      PORT: 8081,
      HOST: '0.0.0.0',
      MAX_CONNECTIONS: 5000,
      WSS_ENABLED: 'true',
      WSS_CERT_PATH: './certs/cert.pem',
      WSS_KEY_PATH: './certs/cert.key'
    },
    
    // 进程管理配置
    instances: 1,              // 单实例模式（WebSocket 不适合多实例）
    autorestart: true,         // 自动重启
    watch: false,              // 不监视文件变化（生产环境建议关闭）
    max_memory_restart: '500M', // 内存超过500M自动重启
    
    // 日志配置
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // 启动配置
    restart_delay: 3000,       // 重启延迟3秒
    kill_timeout: 5000         // 关闭超时5秒
  }]
};