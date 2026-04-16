/**
 * Retro Atari Space Shooter
 * Core Game Logic
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menuOverlay = document.getElementById('menu');
const gameOverOverlay = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');

// Game Constants
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAYER_SIZE = 20;
const ENEMY_SIZE = 20;
const BULLET_SIZE = 4;
const PLAYER_SPEED = 7;
const ENEMY_SPEED_MIN = 1;
const ENEMY_SPEED_MAX = 3;
const BULLET_SPEED = 8;
const FIRE_RATE = 10; // Frames between shots
const PARTICLE_COUNT = 8;

// Game State
let gameState = 'MENU'; // MENU, PLAYING, GAME_OVER
let score = 0;
let highScore = localStorage.getItem('atariHighScore') || 0;
let player = { x: WIDTH / 2 - PLAYER_SIZE / 2, y: HEIGHT - 40 };
let bullets = [];
let enemies = [];
let particles = [];
let keys = {};
let fireCooldown = 0;
let frameId;

// Handle Controls
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') {
        if (gameState === 'MENU') startGame();
        else if (gameState === 'GAME_OVER') startGame();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Mouse Movement & Click
canvas.addEventListener('mousemove', (e) => {
    if (gameState !== 'PLAYING') return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    player.x = mouseX - PLAYER_SIZE / 2;
});

canvas.addEventListener('mousedown', (e) => {
    keys['Mouse0'] = true;
    if (gameState === 'MENU') startGame();
    if (gameState === 'GAME_OVER') startGame();
});

canvas.addEventListener('mouseup', (e) => {
    keys['Mouse0'] = false;
});

function startGame() {
    gameState = 'PLAYING';
    score = 0;
    player.x = WIDTH / 2 - PLAYER_SIZE / 2;
    bullets = [];
    enemies = [];
    particles = [];
    fireCooldown = 0;
    menuOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');

    cancelAnimationFrame(frameId);
    gameLoop();
}

function gameOver() {
    gameState = 'GAME_OVER';
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('atariHighScore', highScore);
    }
    finalScoreElement.innerText = `Score: ${score} | High Score: ${highScore}`;
    gameOverOverlay.classList.remove('hidden');
}

function shoot() {
    if (gameState !== 'PLAYING') return;
    bullets.push({
        x: player.x + PLAYER_SIZE / 2 - BULLET_SIZE / 2,
        y: player.y,
        width: BULLET_SIZE,
        height: BULLET_SIZE * 2,
        color: '#fff'
    });
}

function spawnEnemy() {
    if (Math.random() < 0.02) { // Probability of spawn per frame
        const x = Math.random() * (WIDTH - ENEMY_SIZE);
        const speed = Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN) + ENEMY_SPEED_MIN;
        const colors = ['#f00', '#0f0', '#00f', '#ff0', '#f0f', '#0ff'];
        enemies.push({
            x,
            y: -ENEMY_SIZE,
            width: ENEMY_SIZE,
            height: ENEMY_SIZE,
            speed,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
}

function createParticles(x, y, color) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: x + ENEMY_SIZE / 2,
            y: y + ENEMY_SIZE / 2,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 1.0,
            color: color
        });
    }
}

function update() {
    if (gameState !== 'PLAYING') return;

    // Move Player
    if (keys['ArrowLeft'] || keys['KeyA']) {
        player.x -= PLAYER_SPEED;
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
        player.x += PLAYER_SPEED;
    }

    // Auto-fire logic
    if (keys['Space'] || keys['Mouse0']) {
        if (fireCooldown <= 0) {
            shoot();
            fireCooldown = FIRE_RATE;
        }
    }
    if (fireCooldown > 0) fireCooldown--;

    // Border Collision
    player.x = Math.max(0, Math.min(WIDTH - PLAYER_SIZE, player.x));

    // Update Bullets
    bullets.forEach((bullet, index) => {
        bullet.y -= BULLET_SPEED;
        if (bullet.y + bullet.height < 0) bullets.splice(index, 1);
    });

    // Update Enemies
    enemies.forEach((enemy, index) => {
        enemy.y += enemy.speed;

        // Collision: Enemy vs Player
        if (checkCollision(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE,
            enemy.x, enemy.y, enemy.width, enemy.height)) {
            gameOver();
        }

        // Collision: Enemy reaches bottom
        if (enemy.y > HEIGHT) {
            gameOver();
        }

        // Collision: Enemy vs Bullet
        bullets.forEach((bullet, bIndex) => {
            if (checkCollision(bullet.x, bullet.y, bullet.width, bullet.height,
                enemy.x, enemy.y, enemy.width, enemy.height)) {
                createParticles(enemy.x, enemy.y, enemy.color);
                enemies.splice(index, 1);
                bullets.splice(bIndex, 1);
                score += 10;
            }
        });
    });

    // Update Particles
    particles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) particles.splice(index, 1);
    });

    spawnEnemy();
}

function checkCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 &&
        x1 + w1 > x2 &&
        y1 < y2 + h2 &&
        y1 + h1 > y2;
}

function draw() {
    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Draw HUD
    ctx.fillStyle = '#fff';
    ctx.font = '16px "Courier New"';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${score}`, 20, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`HI: ${highScore}`, WIDTH - 20, 30);

    if (gameState === 'PLAYING' || gameState === 'GAME_OVER') {
        // Draw Player (Retro Ship Shape)
        ctx.fillStyle = '#0ff';
        ctx.fillRect(player.x, player.y + 10, PLAYER_SIZE, 10); // Base
        ctx.fillRect(player.x + PLAYER_SIZE / 2 - 5, player.y, 10, 10); // Cockpit

        // Draw Bullets
        bullets.forEach(bullet => {
            ctx.fillStyle = bullet.color;
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });

        // Draw Enemies (Pixel Monsters)
        enemies.forEach(enemy => {
            ctx.fillStyle = enemy.color;
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            // Add some "eyes" for detail
            ctx.fillStyle = '#000';
            ctx.fillRect(enemy.x + 4, enemy.y + 4, 4, 4);
            ctx.fillRect(enemy.x + 12, enemy.y + 4, 4, 4);
        });

        // Draw Particles
        particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillRect(p.x, p.y, 3, 3);
            ctx.globalAlpha = 1.0;
        });
    }
}

function gameLoop() {
    update();
    draw();
    frameId = requestAnimationFrame(gameLoop);
}

// Initial Draw for Menu
draw();
