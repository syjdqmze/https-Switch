# 文件管理器启动脚本 (PowerShell)
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  文件管理器服务启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 获取脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) {
    $ScriptDir = Get-Location
}
Set-Location $ScriptDir

Write-Host "工作目录: $ScriptDir" -ForegroundColor Green

# 检查 Node.js 是否安装
Write-Host "检查 Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node -v
    Write-Host "Node.js 版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: Node.js 未安装或不在 PATH 中" -ForegroundColor Red
    exit 1
}

# 检查依赖
Write-Host "检查依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "安装依赖..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: 依赖安装失败" -ForegroundColor Red
        exit 1
    }
}

# 检查端口占用
Write-Host "检查端口 8080..." -ForegroundColor Yellow
$portInUse = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "警告: 端口 8080 已被占用" -ForegroundColor Yellow
    Write-Host "PID: $($portInUse.OwningProcess)" -ForegroundColor Yellow
}

# 启动服务器
Write-Host ""
Write-Host "启动服务器..." -ForegroundColor Cyan
$nodeProcess = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $ScriptDir -PassThru -WindowStyle Hidden

# 等待服务器启动
Start-Sleep -Seconds 3

# 检查进程是否还在运行
if ($nodeProcess.HasExited) {
    Write-Host "错误: 服务器启动失败" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "服务器已成功启动!" -ForegroundColor Green
Write-Host "  进程 ID: $($nodeProcess.Id)" -ForegroundColor Green
Write-Host "  访问地址: http://localhost:8080" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  登录凭据" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  用户名: admin" -ForegroundColor Yellow
Write-Host "  密码: password123" -ForegroundColor Yellow
Write-Host ""

# 测试登录
Write-Host "测试登录功能..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/login" -Method POST -Body '{"username":"admin","password":"password123"}' -ContentType "application/json" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        $result = $response.Content | ConvertFrom-Json
        if ($result.success) {
            Write-Host "登录测试成功!" -ForegroundColor Green
            Write-Host "  Token: $($result.token)" -ForegroundColor Gray
        } else {
            Write-Host "登录测试失败: $($result.message)" -ForegroundColor Red
        }
    } else {
        Write-Host "登录测试失败: HTTP $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "登录测试失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "提示：要停止服务器，请运行以下命令：" -ForegroundColor Gray
$stopCommand = "Stop-Process -Id $($nodeProcess.Id) -Force"
Write-Host "  $stopCommand" -ForegroundColor Gray
Write-Host ""
