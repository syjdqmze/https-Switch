const FLAPPY_GRAVITY = 0.2;
const FLAPPY_JUMP = -4;
const FLAPPY_PIPE_WIDTH = 60;
const FLAPPY_PIPE_GAP = 150;
const FLAPPY_PIPE_SPEED = 2;
const FLAPPY_BIRD_SIZE = 30;

let flappyCanvas, flappyCtx;
let flappyBird;
let flappyPipes = [];
let flappyScore = 0;
let flappyGameLoop;
let flappyGameRunning = false;
let flappyGameOver = false;
let flappyGameStarted = false;

function initFlappy() {
    flappyCanvas = document.getElementById('flappyCanvas') || createFlappyCanvas();
    const container = document.getElementById('flappyContainer');
    if (!document.getElementById('flappyCanvas')) {
        document.getElementById('gameCanvas').style.display = 'none';
        if (container) {
            container.appendChild(flappyCanvas);
        }
    }
    flappyCtx = flappyCanvas.getContext('2d');
    resetFlappyGame();
    setupFlappyControls();
}

function createFlappyCanvas() {
    const canvas = document.createElement('canvas');
    canvas.id = 'flappyCanvas';
    canvas.width = 500;
    canvas.height = 500;
    canvas.style.border = '2px solid #333';
    canvas.style.borderRadius = '5px';
    canvas.style.backgroundColor = '#70c5ce';
    return canvas;
}

function resetFlappyGame() {
    flappyBird = {
        x: 80,
        y: 250,
        velocity: 0,
        rotation: 0
    };
    flappyPipes = [];
    flappyScore = 0;
    flappyGameOver = false;
    flappyGameStarted = false;
    updateFlappyScore();
}

function spawnFlappyPipe() {
    const minHeight = 50;
    const maxHeight = flappyCanvas.height - FLAPPY_PIPE_GAP - minHeight;
    const topHeight = Math.floor(Math.random() * (maxHeight - minHeight)) + minHeight;

    flappyPipes.push({
        x: flappyCanvas.width,
        topHeight: topHeight,
        passed: false
    });
}

function updateFlappy() {
    if (flappyGameOver) return;

    flappyBird.velocity += FLAPPY_GRAVITY;
    flappyBird.y += flappyBird.velocity;

    if (flappyBird.velocity < 0) {
        flappyBird.rotation = -25;
    } else if (flappyBird.velocity > 0) {
        flappyBird.rotation = Math.min(flappyBird.velocity * 5, 90);
    }

    if (flappyBird.y + FLAPPY_BIRD_SIZE > flappyCanvas.height || flappyBird.y < 0) {
        flappyGameOver = true;
        flappyGameRunning = false;
        cancelAnimationFrame(flappyGameLoop);
        drawFlappy();
        showFlappyGameOver();
        return;
    }

    if (flappyPipes.length === 0 || flappyPipes[flappyPipes.length - 1].x < flappyCanvas.width - 200) {
        spawnFlappyPipe();
    }

    for (let i = flappyPipes.length - 1; i >= 0; i--) {
        flappyPipes[i].x -= FLAPPY_PIPE_SPEED;

        if (flappyPipes[i].x + FLAPPY_PIPE_WIDTH < 0) {
            flappyPipes.splice(i, 1);
            continue;
        }

        const pipe = flappyPipes[i];

        if (flappyBird.x + FLAPPY_BIRD_SIZE > pipe.x && flappyBird.x < pipe.x + FLAPPY_PIPE_WIDTH) {
            if (flappyBird.y < pipe.topHeight || flappyBird.y + FLAPPY_BIRD_SIZE > pipe.topHeight + FLAPPY_PIPE_GAP) {
                flappyGameOver = true;
                flappyGameRunning = false;
                cancelAnimationFrame(flappyGameLoop);
                drawFlappy();
                showFlappyGameOver();
                return;
            }
        }

        if (!pipe.passed && pipe.x + FLAPPY_PIPE_WIDTH < flappyBird.x) {
            pipe.passed = true;
            flappyScore++;
            updateFlappyScore();
        }
    }
}

function drawFlappy() {
    flappyCtx.fillStyle = '#70c5ce';
    flappyCtx.fillRect(0, 0, flappyCanvas.width, flappyCanvas.height);

    flappyCtx.fillStyle = '#6bbf2e';
    flappyCtx.fillRect(0, flappyCanvas.height - 50, flappyCanvas.width, 50);

    for (let pipe of flappyPipes) {
        drawFlappyPipe(pipe);
    }

    drawFlappyBird();

    if (flappyGameOver && !flappyGameRunning) {
        flappyCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        flappyCtx.fillRect(0, 0, flappyCanvas.width, flappyCanvas.height);
        flappyCtx.fillStyle = '#fff';
        flappyCtx.font = 'bold 24px Microsoft YaHei';
        flappyCtx.textAlign = 'center';
        flappyCtx.fillText('按空格键开始游戏', flappyCanvas.width / 2, flappyCanvas.height / 2);
    }
}

function drawFlappyPipe(pipe) {
    flappyCtx.fillStyle = '#2e8b2e';

    flappyCtx.fillRect(pipe.x, 0, FLAPPY_PIPE_WIDTH, pipe.topHeight);
    flappyCtx.fillStyle = '#3cb043';
    flappyCtx.fillRect(pipe.x + 5, 0, FLAPPY_PIPE_WIDTH - 10, pipe.topHeight);

    const bottomY = pipe.topHeight + FLAPPY_PIPE_GAP;
    flappyCtx.fillStyle = '#2e8b2e';
    flappyCtx.fillRect(pipe.x, bottomY, FLAPPY_PIPE_WIDTH, flappyCanvas.height - bottomY);
    flappyCtx.fillStyle = '#3cb043';
    flappyCtx.fillRect(pipe.x + 5, bottomY, FLAPPY_PIPE_WIDTH - 10, flappyCanvas.height - bottomY);
}

function drawFlappyBird() {
    flappyCtx.save();
    flappyCtx.translate(flappyBird.x + FLAPPY_BIRD_SIZE / 2, flappyBird.y + FLAPPY_BIRD_SIZE / 2);
    flappyCtx.rotate(flappyBird.rotation * Math.PI / 180);

    flappyCtx.fillStyle = '#f7dc6f';
    flappyCtx.beginPath();
    flappyCtx.ellipse(0, 0, FLAPPY_BIRD_SIZE / 2, FLAPPY_BIRD_SIZE / 2 - 5, 0, 0, Math.PI * 2);
    flappyCtx.fill();

    flappyCtx.fillStyle = '#e74c3c';
    flappyCtx.beginPath();
    flappyCtx.moveTo(FLAPPY_BIRD_SIZE / 2 - 5, -5);
    flappyCtx.lineTo(FLAPPY_BIRD_SIZE / 2 + 5, 0);
    flappyCtx.lineTo(FLAPPY_BIRD_SIZE / 2 - 5, 5);
    flappyCtx.closePath();
    flappyCtx.fill();

    flappyCtx.fillStyle = '#000';
    flappyCtx.beginPath();
    flappyCtx.arc(-5, -5, 4, 0, Math.PI * 2);
    flappyCtx.fill();

    flappyCtx.fillStyle = '#fff';
    flappyCtx.beginPath();
    flappyCtx.arc(-4, -6, 2, 0, Math.PI * 2);
    flappyCtx.fill();

    flappyCtx.restore();
}

function showFlappyGameOver() {
    flappyCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    flappyCtx.fillRect(0, 0, flappyCanvas.width, flappyCanvas.height);

    flappyCtx.fillStyle = '#fff';
    flappyCtx.font = 'bold 36px Arial';
    flappyCtx.textAlign = 'center';
    flappyCtx.fillText('游戏结束!', flappyCanvas.width / 2, flappyCanvas.height / 2 - 30);

    flappyCtx.font = 'bold 24px Arial';
    flappyCtx.fillText('得分: ' + flappyScore, flappyCanvas.width / 2, flappyCanvas.height / 2 + 20);

    flappyCtx.font = '18px Arial';
    flappyCtx.fillText('点击屏幕或按空格键重新开始', flappyCanvas.width / 2, flappyCanvas.height / 2 + 60);
}

function updateFlappyScore() {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.textContent = flappyScore;
    }
}

function flapFlappy() {
    if (flappyGameOver && !flappyGameRunning) {
        resetFlappyGame();
        flappyGameStarted = true;
        startFlappy();
        return;
    }

    if (!flappyGameStarted) {
        flappyGameStarted = true;
        startFlappy();
    }

    flappyBird.velocity = FLAPPY_JUMP;
}

function setupFlappyControls() {
    document.onkeydown = function(e) {
        if (window.currentGame !== 'flappy') return;
        if (e.key === ' ' || e.key === 'ArrowUp') {
            flapFlappy();
            e.preventDefault();
        }
    };
}

function startFlappy() {
    flappyGameRunning = true;

    function gameLoop() {
        if (!flappyGameRunning) return;
        updateFlappy();
        drawFlappy();
        flappyGameLoop = requestAnimationFrame(gameLoop);
    }

    gameLoop();
}

function stopFlappy() {
    flappyGameRunning = false;
    if (flappyGameLoop) {
        cancelAnimationFrame(flappyGameLoop);
    }
}

window.switchGame = function(gameName) {
    const gameSelect = document.querySelector('.game-select');
    if (gameSelect) {
        gameSelect.value = gameName;
    }

    const gameTitle = document.getElementById('gameTitle');
    const gamePrompt = document.getElementById('gamePrompt');
    const gameCanvas = document.getElementById('gameCanvas');
    const flappyCanvas = document.getElementById('flappyCanvas');
    const tetrisCanvas = document.getElementById('tetrisCanvas');
    const flappyContainer = document.getElementById('flappyContainer');
    const tetrisContainer = document.getElementById('tetrisContainer');
    const controls = document.getElementById('controls');

    if (gameName === '') {
        location.reload();
        return;
    }

    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) gameContainer.classList.remove('game-select-prompt');

    if (gameName === 'snake') {
        if (window.currentGame === 'flappy') {
            stopFlappy();
        } else if (window.currentGame === 'tetris') {
            stopTetris();
        }
        window.currentGame = 'snake';
        window.gameStarted = false;
        if (gameTitle) gameTitle.textContent = '贪吃蛇游戏';
        if (gamePrompt) gamePrompt.style.display = 'none';
        if (gameCanvas) gameCanvas.style.display = 'block';
        if (flappyContainer) flappyContainer.style.display = 'none';
        if (tetrisContainer) tetrisContainer.style.display = 'none';
        if (controls) {
            controls.style.display = 'block';
            controls.innerHTML = `
                <p>使用方向键控制蛇的移动</p>
                <p>按空格键开始游戏</p>
                <p>按Esc键退出游戏</p>
            `;
        }
        if (typeof drawMessage === 'function') {
            drawMessage('按下空格键开始游戏');
        } else {
            console.log('drawMessage not found');
            if (canvas && ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#2c3e50';
                ctx.font = 'bold 22px Microsoft YaHei';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('按下空格键开始游戏', canvas.width / 2, canvas.height / 2);
            }
        }
    } else if (gameName === 'flappy') {
        if (window.currentGame === 'snake') {
            stopSnakeGame();
        } else if (window.currentGame === 'flappy' && flappyGameRunning) {
            stopFlappy();
        } else if (window.currentGame === 'tetris') {
            stopTetris();
        }
        window.currentGame = 'flappy';
        if (gameTitle) gameTitle.textContent = '飞翔鸟游戏';
        if (gamePrompt) gamePrompt.style.display = 'none';
        if (gameCanvas) gameCanvas.style.display = 'none';
        if (flappyContainer) flappyContainer.style.display = 'block';
        if (tetrisContainer) tetrisContainer.style.display = 'none';
        if (controls) {
            controls.style.display = 'block';
            controls.innerHTML = `
                <p>按空格键开始游戏</p>
                <p>按Esc键退出游戏</p>
            `;
        }
        initFlappy();
        flappyGameOver = true;
        flappyGameRunning = false;
        flappyGameStarted = false;
        drawFlappy();
    } else if (gameName === 'tetris') {
        if (window.currentGame === 'snake') {
            stopSnakeGame();
        } else if (window.currentGame === 'flappy') {
            stopFlappy();
        } else if (window.currentGame === 'tetris' && tetrisGameRunning) {
            stopTetris();
        }
        window.currentGame = 'tetris';
        if (gameTitle) gameTitle.textContent = '俄罗斯方块游戏';
        if (gamePrompt) gamePrompt.style.display = 'none';
        if (gameCanvas) gameCanvas.style.display = 'none';
        if (flappyContainer) flappyContainer.style.display = 'none';
        if (tetrisContainer) tetrisContainer.style.display = 'block';
        if (controls) {
            controls.style.display = 'block';
            controls.innerHTML = `
                <p>←→左右移动 ↑旋转 ↓下降</p>
                <p>按空格键开始游戏</p>
                <p>按Esc键退出游戏</p>
            `;
        }
        initTetris();
        tetrisGameOver = true;
        drawTetris();
    }
};