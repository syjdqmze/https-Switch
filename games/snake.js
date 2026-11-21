console.log('贪吃蛇游戏加载中...');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');

const GRID_SIZE = 20;
const COLS = 25;
const ROWS = 25;
const GAME_SPEED = 300;
const AUTO_CONTROL_DELAY = 5000;

let snake = [];
let food = null;
let direction = 'right';
let nextDirection = 'right';
let score = 0;
let gameOver = false;
let gameStarted = false;
let gameInterval = null;
let lastRenderTime = 0;
let lastInputTime = 0;
let isUserControl = true;
let autoControlInterval = null;

function calculateDistance(pos1, pos2) {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
}

function getAutoDirection() {
    if (snake.length === 0 || !food) return 'right';
    
    const head = snake[0];
    const possibleMoves = [];
    const oppositeDirections = { up: 'down', down: 'up', left: 'right', right: 'left' };
    
    const directions = [
        { dir: 'up', dx: 0, dy: -1 },
        { dir: 'down', dx: 0, dy: 1 },
        { dir: 'left', dx: -1, dy: 0 },
        { dir: 'right', dx: 1, dy: 0 }
    ];
    
    directions.forEach(({ dir, dx, dy }) => {
        if (dir === oppositeDirections[direction]) return;
        
        const newX = head.x + dx;
        const newY = head.y + dy;
        
        let collision = false;
        for (let i = 0; i < snake.length - 1; i++) {
            if (snake[i].x === newX && snake[i].y === newY) {
                collision = true;
                break;
            }
        }
        
        if (!collision) {
            const distanceToFood = calculateDistance({ x: newX, y: newY }, food);
            const distanceHeadToFood = calculateDistance(head, food);
            
            let score = 100 - distanceToFood * 2;
            
            if (distanceToFood < distanceHeadToFood) {
                score += 50;
            }
            
            possibleMoves.push({ dir, score });
        }
    });
    
    if (possibleMoves.length === 0) {
        const safeMoves = directions.filter(({ dir }) => dir !== oppositeDirections[direction]);
        if (safeMoves.length > 0) {
            const randomMove = safeMoves[Math.floor(Math.random() * safeMoves.length)];
            return randomMove.dir;
        }
        return direction;
    }
    
    possibleMoves.sort((a, b) => b.score - a.score);
    
    return possibleMoves[0].dir;
}

function startAutoControl() {
    if (autoControlInterval) return;
    
    autoControlInterval = setInterval(() => {
        if (!gameStarted || gameOver) {
            stopAutoControl();
            return;
        }
        
        if (Date.now() - lastInputTime >= AUTO_CONTROL_DELAY) {
            const autoDir = getAutoDirection();
            if (autoDir !== nextDirection) {
                nextDirection = autoDir;
                direction = autoDir;
            }
        }
    }, 200);
}

function stopAutoControl() {
    if (autoControlInterval) {
        clearInterval(autoControlInterval);
        autoControlInterval = null;
    }
}

function resetAutoControlTimer() {
    lastInputTime = Date.now();
    isUserControl = true;
}

function drawGrid() {
    ctx.strokeStyle = '#FFFFF0';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, canvas.height);
        ctx.stroke();
    }
    
    for (let i = 0; i <= ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(canvas.width, i * GRID_SIZE);
        ctx.stroke();
    }
    
    ctx.setLineDash([]);
}

function drawMessage(text) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 22px Microsoft YaHei';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    
    if (score > 0) {
        ctx.font = 'bold 18px Microsoft YaHei';
        ctx.fillText(`上次得分：${score}`, canvas.width / 2, canvas.height / 2 + 35);
    }
}

function initGame() {
    console.log('初始化贪吃蛇游戏...');
    snake = [{ x: 10, y: 10 }];
    food = { x: 15, y: 10 };
    direction = 'right';
    nextDirection = 'right';
    score = 0;
    gameOver = false;
    gameStarted = true;
    lastInputTime = Date.now();
    scoreEl.textContent = score;

    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(updateGame, GAME_SPEED);
    render();
    startAutoControl();
}

function generateFood() {
    let newFood;
    const occupiedPositions = new Set(snake.map(s => `${s.x},${s.y}`));
    
    do {
        newFood = {
            x: Math.floor(Math.random() * COLS),
            y: Math.floor(Math.random() * ROWS)
        };
    } while (occupiedPositions.has(`${newFood.x},${newFood.y}`));
    
    return newFood;
}

function updateGame() {
    if (gameOver || !gameStarted) return;

    direction = nextDirection;
    const head = { x: snake[0].x, y: snake[0].y };

    const moves = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 }
    };

    const move = moves[direction];
    head.x += move.x;
    head.y += move.y;

    if (head.x < 0) head.x = COLS - 1;
    else if (head.x >= COLS) head.x = 0;
    if (head.y < 0) head.y = ROWS - 1;
    else if (head.y >= ROWS) head.y = 0;

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreEl.textContent = score;
        food = generateFood();
    } else {
        snake.pop();
    }
}

function render() {
    if (!gameStarted) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(food.x * GRID_SIZE, food.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
    
    snake.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? '#1e8449' : '#27ae60';
        ctx.fillRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
    });
    
    const head = snake[0];
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(head.x * GRID_SIZE + 12, head.y * GRID_SIZE + 5, 4, 4);
    ctx.fillRect(head.x * GRID_SIZE + 12, head.y * GRID_SIZE + 11, 4, 4);
    
    if (gameStarted && !gameOver) {
        requestAnimationFrame(render);
    }
}

function endGame() {
    gameOver = true;
    gameStarted = false;
    if (gameInterval) clearInterval(gameInterval);
    stopAutoControl();
    drawMessage('游戏结束！按空格键重新开始');
}

function stopSnakeGame() {
    gameOver = false;
    gameStarted = false;
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    stopAutoControl();
}

const directionHandlers = {
    up: () => direction !== 'down' && (nextDirection = 'up'),
    down: () => direction !== 'up' && (nextDirection = 'down'),
    left: () => direction !== 'right' && (nextDirection = 'left'),
    right: () => direction !== 'left' && (nextDirection = 'right')
};

document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }

    switch (e.key) {
        case 'ArrowUp': directionHandlers.up(); resetAutoControlTimer(); break;
        case 'ArrowDown': directionHandlers.down(); resetAutoControlTimer(); break;
        case 'ArrowLeft': directionHandlers.left(); resetAutoControlTimer(); break;
        case 'ArrowRight': directionHandlers.right(); resetAutoControlTimer(); break;
        case ' ':
            console.log('空格键按下, currentGame:', window.currentGame, 'gameStarted:', gameStarted, 'gameOver:', gameOver);
            if (window.currentGame === 'snake' && (!gameStarted || gameOver)) {
                initGame();
            }
            break;
        case 'Escape':
            if (gameStarted && !gameOver) endGame();
            break;
    }
});

drawMessage('请在下方选择游戏');
window.snakeReady = true;
console.log('贪吃蛇游戏加载完成！');
