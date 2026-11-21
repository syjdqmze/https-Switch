@echo off
echo 启动文件管理器服务...
cd /d "%~dp0"

REM 停止之前的进程
pm2 stop file-manager 2>nul

REM 启动服务器
pm2 start server.js --name file-manager

REM 等待一下
timeout /t 2 /nobreak >nul

REM 显示状态
pm2 status

echo.
echo 服务器已启动!
echo 访问地址: http://localhost:8080
echo.
echo 常用命令:
echo   pm2 logs file-manager    - 查看日志
echo   pm2 stop file-manager   - 停止服务
echo   pm2 restart file-manager - 重启服务
echo   pm2 status              - 查看状态
echo.

pause
