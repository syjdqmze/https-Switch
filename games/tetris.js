const TETRIS_ROWS = 20;
const TETRIS_COLS = 20;
const TETRIS_BLOCK_SIZE = 25;

const TETRIS_SHAPES = [
    [[1, 1, 1, 1]],
    [[1, 1], [1, 1]],
    [[1, 1, 1], [0, 1, 0]],
    [[1, 1, 1], [1, 0, 0]],
    [[1, 1, 1], [0, 0, 1]],
    [[1, 1, 0], [0, 1, 1]],
    [[0, 1, 1], [1, 1, 0]]
];

const TETRIS_COLORS = ['#00f', '#f90', '#0f0', '#f0f', '#0ff', '#ff0', '#f00'];

let tetrisCanvas, tetrisCtx;
let tetrisBoard = [];
let tetrisCurrentPiece;
let tetrisCurrentX, tetrisCurrentY;
let tetrisScore = 0;
let tetrisGameLoop;
let tetrisDropInterval;
let tetrisGameRunning = false;
let tetrisGameOver = false;

function initTetris() {
    tetrisCanvas = document.getElementById('tetrisCanvas') || createTetrisCanvas();
    const container = document.getElementById('tetrisContainer');
    if (!document.getElementById('tetrisCanvas')) {
        document.getElementById('gameCanvas').style.display = 'none';
        if (container) {
            container.appendChild(tetrisCanvas);
        }
    }
    tetrisCtx = tetrisCanvas.getContext('2d');
    resetTetrisBoard();
    setupTetrisControls();
}

function createTetrisCanvas() {
    const canvas = document.createElement('canvas');
    canvas.id = 'tetrisCanvas';
    canvas.width = TETRIS_COLS * TETRIS_BLOCK_SIZE;
    canvas.height = TETRIS_ROWS * TETRIS_BLOCK_SIZE;
    canvas.style.border = '2px solid #333';
    canvas.style.borderRadius = '5px';
    canvas.style.backgroundImage = "url('草原.png')";
    canvas.style.backgroundSize = 'cover';
    return canvas;
}

function resetTetrisBoard() {
    tetrisBoard = [];
    for (let r = 0; r < TETRIS_ROWS; r++) {
        tetrisBoard[r] = [];
        for (let c = 0; c < TETRIS_COLS; c++) {
            tetrisBoard[r][c] = 0;
        }
    }
}

function spawnTetrisPiece() {
    const shapeIndex = Math.floor(Math.random() * TETRIS_SHAPES.length);
    tetrisCurrentPiece = {
        shape: TETRIS_SHAPES[shapeIndex].map(row => [...row]),
        color: TETRIS_COLORS[shapeIndex]
    };
    tetrisCurrentX = Math.floor((TETRIS_COLS - tetrisCurrentPiece.shape[0].length) / 2);
    tetrisCurrentY = 0;

    if (checkTetrisCollision(0, 0)) {
        tetrisGameOver = true;
        cancelAnimationFrame(tetrisGameLoop);
        tetrisCtx.fillStyle = '#000';
        tetrisCtx.font = 'bold 30px Arial';
        tetrisCtx.textAlign = 'center';
        tetrisCtx.fillText('游戏结束!', tetrisCanvas.width / 2, tetrisCanvas.height / 2);
        return false;
    }
    return true;
}

function checkTetrisCollision(offsetX, offsetY, newShape) {
    const shape = newShape || tetrisCurrentPiece.shape;
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) {
                const newX = tetrisCurrentX + c + offsetX;
                const newY = tetrisCurrentY + r + offsetY;
                if (newX < 0 || newX >= TETRIS_COLS || newY >= TETRIS_ROWS) {
                    return true;
                }
                if (newY >= 0 && tetrisBoard[newY][newX]) {
                    return true;
                }
            }
        }
    }
    return false;
}

function lockTetrisPiece() {
    for (let r = 0; r < tetrisCurrentPiece.shape.length; r++) {
        for (let c = 0; c < tetrisCurrentPiece.shape[r].length; c++) {
            if (tetrisCurrentPiece.shape[r][c]) {
                const boardY = tetrisCurrentY + r;
                const boardX = tetrisCurrentX + c;
                if (boardY >= 0) {
                    tetrisBoard[boardY][boardX] = tetrisCurrentPiece.color;
                }
            }
        }
    }
    clearTetrisLines();
    spawnTetrisPiece();
}

function clearTetrisLines() {
    for (let r = TETRIS_ROWS - 1; r >= 0; r--) {
        if (tetrisBoard[r].every(cell => cell !== 0)) {
            tetrisBoard.splice(r, 1);
            tetrisBoard.unshift(new Array(TETRIS_COLS).fill(0));
            tetrisScore += 10;
            updateTetrisScore();
            r++;
        }
    }
}

function updateTetrisScore() {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.textContent = tetrisScore;
    }
}

function moveTetrisPiece(dir) {
    if (!tetrisGameRunning || tetrisGameOver) return;
    if (!checkTetrisCollision(dir, 0)) {
        tetrisCurrentX += dir;
    }
}

function rotateTetrisPiece() {
    if (!tetrisGameRunning || tetrisGameOver) return;
    const rotated = [];
    const rows = tetrisCurrentPiece.shape.length;
    const cols = tetrisCurrentPiece.shape[0].length;
    for (let c = 0; c < cols; c++) {
        rotated[c] = [];
        for (let r = rows - 1; r >= 0; r--) {
            rotated[c][rows - 1 - r] = tetrisCurrentPiece.shape[r][c];
        }
    }
    if (!checkTetrisCollision(0, 0, rotated)) {
        tetrisCurrentPiece.shape = rotated;
    }
}

function dropTetrisPiece() {
    if (!tetrisGameRunning || tetrisGameOver) return;
    if (!checkTetrisCollision(0, 1)) {
        tetrisCurrentY++;
    } else {
        lockTetrisPiece();
    }
}

function hardDropTetris() {
    if (!tetrisGameRunning || tetrisGameOver) return;
    while (!checkTetrisCollision(0, 1)) {
        tetrisCurrentY++;
        tetrisScore += 1;
    }
    lockTetrisPiece();
    updateTetrisScore();
}

function drawTetris() {
    tetrisCtx.clearRect(0, 0, tetrisCanvas.width, tetrisCanvas.height);

    if (!tetrisGameRunning) {
        tetrisCtx.fillStyle = '#2c3e50';
        tetrisCtx.font = 'bold 20px Microsoft YaHei';
        tetrisCtx.textAlign = 'center';
        tetrisCtx.fillText('按下空格键开始游戏', tetrisCanvas.width / 2, tetrisCanvas.height / 2);
        if (tetrisScore > 0) {
            tetrisCtx.font = 'bold 18px Microsoft YaHei';
            tetrisCtx.fillText(`上次得分：${tetrisScore}`, tetrisCanvas.width / 2, tetrisCanvas.height / 2 + 35);
        }
        return;
    }

    for (let r = 0; r < TETRIS_ROWS; r++) {
        for (let c = 0; c < TETRIS_COLS; c++) {
            if (tetrisBoard[r][c]) {
                drawTetrisBlock(c, r, tetrisBoard[r][c]);
            }
        }
    }

    if (tetrisCurrentPiece && !tetrisGameOver) {
        for (let r = 0; r < tetrisCurrentPiece.shape.length; r++) {
            for (let c = 0; c < tetrisCurrentPiece.shape[r].length; c++) {
                if (tetrisCurrentPiece.shape[r][c]) {
                    drawTetrisBlock(tetrisCurrentX + c, tetrisCurrentY + r, tetrisCurrentPiece.color);
                }
            }
        }
    }

    tetrisCtx.strokeStyle = '#ddd';
    tetrisCtx.lineWidth = 0.5;
    for (let r = 0; r <= TETRIS_ROWS; r++) {
        tetrisCtx.beginPath();
        tetrisCtx.moveTo(0, r * TETRIS_BLOCK_SIZE);
        tetrisCtx.lineTo(tetrisCanvas.width, r * TETRIS_BLOCK_SIZE);
        tetrisCtx.stroke();
    }
    for (let c = 0; c <= TETRIS_COLS; c++) {
        tetrisCtx.beginPath();
        tetrisCtx.moveTo(c * TETRIS_BLOCK_SIZE, 0);
        tetrisCtx.lineTo(c * TETRIS_BLOCK_SIZE, tetrisCanvas.height);
        tetrisCtx.stroke();
    }
}

function drawTetrisBlock(x, y, color) {
    const padding = 1;
    tetrisCtx.fillStyle = color;
    tetrisCtx.fillRect(
        x * TETRIS_BLOCK_SIZE + padding,
        y * TETRIS_BLOCK_SIZE + padding,
        TETRIS_BLOCK_SIZE - padding * 2,
        TETRIS_BLOCK_SIZE - padding * 2
    );
    tetrisCtx.strokeStyle = '#fff';
    tetrisCtx.lineWidth = 2;
    tetrisCtx.strokeRect(
        x * TETRIS_BLOCK_SIZE + padding,
        y * TETRIS_BLOCK_SIZE + padding,
        TETRIS_BLOCK_SIZE - padding * 2,
        TETRIS_BLOCK_SIZE - padding * 2
    );
}

function setupTetrisControls() {
    document.onkeydown = function(e) {
        if (window.currentGame !== 'tetris') return;
        if (!tetrisGameRunning) {
            if (e.key === ' ') {
                startTetris();
                e.preventDefault();
            }
            return;
        }
        switch(e.key) {
            case 'ArrowLeft':
                moveTetrisPiece(-1);
                break;
            case 'ArrowRight':
                moveTetrisPiece(1);
                break;
            case 'ArrowDown':
                dropTetrisPiece();
                break;
            case 'ArrowUp':
                rotateTetrisPiece();
                break;
            case ' ':
                if (tetrisGameOver) {
                    startTetris();
                } else {
                    hardDropTetris();
                }
                break;
            case 'Escape':
                stopTetris();
                tetrisGameOver = true;
                tetrisCtx.fillStyle = '#2c3e50';
                tetrisCtx.font = 'bold 20px Microsoft YaHei';
                tetrisCtx.textAlign = 'center';
                tetrisCtx.fillText('游戏结束', tetrisCanvas.width / 2, tetrisCanvas.height / 2);
                break;
        }
        e.preventDefault();
    };
}

function startTetris() {
    resetTetrisBoard();
    tetrisScore = 0;
    tetrisGameOver = false;
    updateTetrisScore();
    spawnTetrisPiece();
    tetrisGameRunning = true;

    function gameLoop() {
        if (tetrisGameOver) return;
        drawTetris();
        tetrisGameLoop = requestAnimationFrame(gameLoop);
    }

    gameLoop();

    if (tetrisDropInterval) {
        clearInterval(tetrisDropInterval);
    }
    tetrisDropInterval = setInterval(function() {
        if (tetrisGameRunning && !tetrisGameOver) {
            if (checkTetrisCollision(0, 1)) {
                lockTetrisPiece();
            } else {
                tetrisCurrentY++;
            }
        }
    }, 350);
}

function stopTetris() {
    tetrisGameRunning = false;
    if (tetrisGameLoop) {
        cancelAnimationFrame(tetrisGameLoop);
    }
    if (tetrisDropInterval) {
        clearInterval(tetrisDropInterval);
    }
}