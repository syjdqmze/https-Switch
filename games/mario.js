class MarioGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.canvas.width = 500;
        this.canvas.height = 500;
        
        this.player = {
            x: 50,
            y: 380,
            width: 30,
            height: 40,
            velocityX: 0,
            velocityY: 0,
            isJumping: false,
            isFacingRight: true,
            color: '#FF0000'
        };
        
        this.gravity = 0.5;
        this.jumpForce = -12;
        this.speed = 5;
        
        this.enemies = [
            { x: 200, y: 380, width: 30, height: 30, velocityX: -2, type: 'turtle' },
            { x: 400, y: 380, width: 30, height: 30, velocityX: -1.5, type: 'turtle' }
        ];
        
        this.bricks = [
            { x: 150, y: 300, width: 40, height: 20, color: '#8B4513', hasCoin: true },
            { x: 200, y: 300, width: 40, height: 20, color: '#8B4513', hasCoin: true },
            { x: 250, y: 300, width: 40, height: 20, color: '#8B4513', hasCoin: false },
            { x: 350, y: 250, width: 40, height: 20, color: '#8B4513', hasCoin: true },
            { x: 400, y: 250, width: 40, height: 20, color: '#8B4513', hasCoin: true }
        ];
        
        this.coins = [
            { x: 170, y: 270, radius: 10, collected: false },
            { x: 220, y: 270, radius: 10, collected: false },
            { x: 370, y: 220, radius: 10, collected: false },
            { x: 420, y: 220, radius: 10, collected: false }
        ];
        
        this.platforms = [
            { x: 0, y: 420, width: 500, height: 80, color: '#228B22' },
            { x: 300, y: 320, width: 100, height: 20, color: '#228B22' }
        ];
        
        this.score = 0;
        this.lives = 3;
        this.gameOver = false;
        this.levelComplete = false;
        this.gameStarted = false;
        
        this.keys = {
            left: false,
            right: false,
            up: false
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.gameLoop();
    }
    
    bindEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = true;
            if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = true;
            
            if (e.key === 'Escape') {
                this.gameOver = true;
                this.gameStarted = false;
                return;
            }
            
            if (e.key === ' ') {
                e.preventDefault();
                if (!this.gameStarted) {
                    this.gameStarted = true;
                    return;
                }
                if (this.gameOver) {
                    this.reset();
                    return;
                }
                if (!this.player.isJumping) {
                    this.player.velocityY = this.jumpForce;
                    this.player.isJumping = true;
                }
            }
            
            if ((e.key === 'ArrowUp' || e.key === 'w') && !this.player.isJumping && this.gameStarted) {
                this.player.velocityY = this.jumpForce;
                this.player.isJumping = true;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = false;
            if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = false;
        });
    }
    
    update() {
        if (!this.gameStarted || this.gameOver || this.levelComplete) return;
        
        this.player.velocityX = 0;
        
        if (this.keys.left) {
            this.player.velocityX = -this.speed;
            this.player.isFacingRight = false;
        }
        if (this.keys.right) {
            this.player.velocityX = this.speed;
            this.player.isFacingRight = true;
        }
        
        this.player.velocityY += this.gravity;
        this.player.x += this.player.velocityX;
        this.player.y += this.player.velocityY;
        
        if (this.player.x < 0) this.player.x = 0;
        if (this.player.x + this.player.width > this.canvas.width) this.player.x = this.canvas.width - this.player.width;
        
        this.checkPlatformCollision();
        this.checkBrickCollision();
        this.checkCoinCollision();
        this.checkEnemyCollision();
        
        this.enemies.forEach(enemy => {
            enemy.x += enemy.velocityX;
            if (enemy.x <= 0 || enemy.x + enemy.width >= this.canvas.width) {
                enemy.velocityX *= -1;
            }
        });
        
        if (this.score >= 400) {
            this.levelComplete = true;
        }
    }
    
    checkPlatformCollision() {
        this.platforms.forEach(platform => {
            if (this.isColliding(this.player, platform)) {
                if (this.player.velocityY > 0 && this.player.y + this.player.height <= platform.y + 20) {
                    this.player.y = platform.y - this.player.height;
                    this.player.velocityY = 0;
                    this.player.isJumping = false;
                }
            }
        });
    }
    
    checkBrickCollision() {
        this.bricks.forEach(brick => {
            if (this.isColliding(this.player, brick)) {
                if (this.player.velocityY > 0) {
                    this.player.y = brick.y - this.player.height;
                    this.player.velocityY = 0;
                    this.player.isJumping = false;
                } else if (this.player.velocityY < 0) {
                    this.player.y = brick.y + brick.height;
                    this.player.velocityY = 0;
                }
            }
        });
    }
    
    checkCoinCollision() {
        this.coins.forEach(coin => {
            if (!coin.collected) {
                const dx = (this.player.x + this.player.width / 2) - coin.x;
                const dy = (this.player.y + this.player.height / 2) - coin.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < coin.radius + Math.min(this.player.width, this.player.height) / 2) {
                    coin.collected = true;
                    this.score += 100;
                }
            }
        });
    }
    
    checkEnemyCollision() {
        this.enemies.forEach(enemy => {
            if (this.isColliding(this.player, enemy)) {
                if (this.player.velocityY > 0 && this.player.y + this.player.height <= enemy.y + 15) {
                    enemy.velocityX = 0;
                    enemy.y = 1000;
                    this.score += 200;
                } else {
                    this.lives--;
                    if (this.lives <= 0) {
                        this.gameOver = true;
                    } else {
                        this.player.x = 50;
                        this.player.y = 380;
                        this.player.velocityX = 0;
                        this.player.velocityY = 0;
                        this.player.isJumping = false;
                    }
                }
            }
        });
    }
    
    isColliding(obj1, obj2) {
        return obj1.x < obj2.x + obj2.width &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y < obj2.y + obj2.height &&
               obj1.y + obj1.height > obj2.y;
    }
    
    draw() {
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.platforms.forEach(platform => {
            this.ctx.fillStyle = platform.color;
            this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            this.ctx.fillStyle = '#32CD32';
            this.ctx.fillRect(platform.x, platform.y, platform.width, 5);
        });
        
        this.bricks.forEach(brick => {
            this.ctx.fillStyle = brick.color;
            this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            this.ctx.fillStyle = '#CD853F';
            this.ctx.fillRect(brick.x, brick.y + brick.height - 5, brick.width, 5);
        });
        
        this.coins.forEach(coin => {
            if (!coin.collected) {
                this.ctx.beginPath();
                this.ctx.fillStyle = '#FFD700';
                this.ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.strokeStyle = '#FFA500';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                this.ctx.fillStyle = '#FFA500';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('$', coin.x, coin.y + 4);
            }
        });
        
        this.enemies.forEach(enemy => {
            this.ctx.fillStyle = '#00008B';
            this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            this.ctx.fillStyle = '#87CEEB';
            this.ctx.fillRect(enemy.x + 5, enemy.y + 5, enemy.width - 10, 10);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(enemy.x + 20, enemy.y + 10, 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.ctx.fillStyle = this.player.color;
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillRect(this.player.x + 5, this.player.y - 10, 20, 10);
        
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(this.player.x + 22, this.player.y + 10, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`分数: ${this.score}`, 10, 30);
        this.ctx.fillText(`生命: ${this.lives}`, 10, 50);
        
        if (!this.gameStarted && !this.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = '40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('超级玛丽', this.canvas.width / 2, this.canvas.height / 2 - 40);
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = '24px Arial';
            this.ctx.fillText('按空格键开始游戏', this.canvas.width / 2, this.canvas.height / 2 + 20);
            this.ctx.font = '16px Arial';
            this.ctx.fillStyle = '#AAA';
            this.ctx.fillText('←→移动 ↑/空格跳跃', this.canvas.width / 2, this.canvas.height / 2 + 60);
        }
        
        if (this.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#FF0000';
            this.ctx.font = '40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('游戏结束', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.font = '20px Arial';
            this.ctx.fillText('按空格键重新开始', this.canvas.width / 2, this.canvas.height / 2 + 40);
        }
        
        if (this.levelComplete) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#00FF00';
            this.ctx.font = '40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('关卡完成!', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.font = '20px Arial';
            this.ctx.fillText(`最终分数: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 40);
        }
    }
    
    gameLoop() {
        if (this.stopped) return;
        this.animationId = requestAnimationFrame(() => this.gameLoop());
        this.update();
        this.draw();
    }
    
    stop() {
        this.stopped = true;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
    
    reset() {
        this.player.x = 50;
        this.player.y = 380;
        this.player.velocityX = 0;
        this.player.velocityY = 0;
        this.player.isJumping = false;
        this.score = 0;
        this.lives = 3;
        this.gameOver = false;
        this.levelComplete = false;
        this.gameStarted = false;
        
        this.enemies = [
            { x: 200, y: 380, width: 30, height: 30, velocityX: -2, type: 'turtle' },
            { x: 400, y: 380, width: 30, height: 30, velocityX: -1.5, type: 'turtle' }
        ];
        
        this.coins.forEach(coin => coin.collected = false);
    }
}

function startMarioGame() {
    if (window.marioGameInstance) {
        stopMarioGame();
    }
    
    const canvas = document.getElementById('gameCanvas');
    window.marioGameInstance = new MarioGame(canvas);
    
    document.getElementById('gameTitle').textContent = '超级玛丽';
    document.getElementById('score').textContent = '0';
    document.getElementById('gamePrompt').style.display = 'none';
    
    document.getElementById('gameCanvas').style.display = 'block';
    document.getElementById('controls').style.display = 'block';
    
    document.getElementById('tetrisContainer').style.display = 'none';
    document.getElementById('flappyContainer').style.display = 'none';
    
    if (typeof updateScoreInterval !== 'undefined' && updateScoreInterval) {
        clearInterval(updateScoreInterval);
    }
    updateScoreInterval = setInterval(() => {
        if (window.marioGameInstance) {
            document.getElementById('score').textContent = window.marioGameInstance.score;
        }
    }, 100);
}

function stopMarioGame() {
    if (window.marioGameInstance) {
        window.marioGameInstance.stop();
        window.marioGameInstance = null;
    }
    if (typeof updateScoreInterval !== 'undefined' && updateScoreInterval) {
        clearInterval(updateScoreInterval);
        updateScoreInterval = null;
    }
}