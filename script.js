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
const PLAYER_SPEED = 10;
const ENEMY_SPEED_MIN = 0.5;
const ENEMY_SPEED_MAX = 1.5;
const BULLET_SPEED = 14;
const FIRE_RATE = 10; // Frames between shots
const PARTICLE_COUNT = 8;

// Audio System
let audioCtx;
let nextNoteTime = 0;
let beatCount = 0;
const tempo = 120;
const secondsPerBeat = 60 / tempo;

// Game State
let gameState = 'MENU'; // MENU, PLAYING, GAME_OVER
let score = 0;
let highScore = localStorage.getItem('atariHighScore') || 0;
let lives = 3;
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
    
    // Prevent default behavior for game keys (scrolling, etc.)
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }

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

window.addEventListener('mousedown', (e) => {
    keys['Mouse0'] = true;
    if (gameState === 'MENU') startGame();
    if (gameState === 'GAME_OVER') startGame();
});

window.addEventListener('mouseup', (e) => {
    keys['Mouse0'] = false;
});

function startGame() {
    initAudio();
    gameState = 'PLAYING';
    score = 0;
    lives = 3;
    player.x = WIDTH / 2 - PLAYER_SIZE / 2;
    player.y = HEIGHT - 40;
    bullets = [];
    enemies = [];
    particles = [];
    fireCooldown = 0;
    menuOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');

    cancelAnimationFrame(frameId);
    gameLoop();
}

function initAudio() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } catch (e) {
        console.error("Audio failed to initialize:", e);
    }
}

function playRetroMusic() {
    if (!audioCtx || gameState !== 'PLAYING') return;
    
    // Safety check for suspended state
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const currentTime = audioCtx.currentTime;
    if (currentTime > nextNoteTime) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        // Classic arcade rhythmic bass (slightly higher for better audibility)
        const notes = [220, 164, 220, 146]; // A3, E3, A3, D3
        osc.frequency.setValueAtTime(notes[beatCount % notes.length], currentTime);
        osc.type = 'square'; // Chunky retro sound
        
        gain.gain.setValueAtTime(0.1, currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, currentTime + 0.2);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(currentTime);
        osc.stop(currentTime + 0.2);
        
        nextNoteTime = currentTime + secondsPerBeat / 2;
        beatCount++;
    }
}

function gameOver() {
    gameState = 'GAME_OVER';
    lives = 0; // Ensure lives are 0 on game over
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('atariHighScore', highScore);
    }
    finalScoreElement.innerText = `Score: ${score} | High Score: ${highScore}`;
    gameOverOverlay.classList.remove('hidden');
}

function playShootSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playExplosionSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, audioCtx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

function shoot() {
    if (gameState !== 'PLAYING') return;
    playShootSound();
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
        
        // Base speed progression: increases every 500 points
        const difficultyMultiplier = 1 + (score / 500);
        let speed = (Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN) + ENEMY_SPEED_MIN) * difficultyMultiplier;
        
        // 1/3 of enemies are 40% slower to keep the game fair
        if (Math.random() < 0.33) {
            speed *= 0.6;
        }

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

    // Move Player (Keyboard)
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
    player.y = Math.max(0, Math.min(HEIGHT - PLAYER_SIZE, player.y));

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
            playExplosionSound();
            lives--;
            enemies.splice(index, 1);
            if (lives <= 0) {
                gameOver();
            }
        }

        // Collision: Enemy reaches bottom
        if (enemy.y > HEIGHT) {
            playExplosionSound();
            lives--;
            enemies.splice(index, 1);
            if (lives <= 0) {
                gameOver();
            }
        }

        // Collision: Enemy vs Bullet
        bullets.forEach((bullet, bIndex) => {
            if (checkCollision(bullet.x, bullet.y, bullet.width, bullet.height,
                enemy.x, enemy.y, enemy.width, enemy.height)) {
                playExplosionSound();
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
    ctx.textAlign = 'center';
    ctx.fillText(`LIVES: ${lives}`, WIDTH / 2, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`HI: ${highScore}`, WIDTH - 20, 30);

    if (gameState === 'PLAYING' || gameState === 'GAME_OVER') {
        // Draw Player (Sleek Atari Fighter)
        ctx.fillStyle = '#0ff';
        const s = PLAYER_SIZE / 7; // Use 7x7 grid
        const px = player.x;
        const py = player.y;

        const shipShape = [
            [0,0,0,1,0,0,0],
            [0,0,1,1,1,0,0],
            [0,0,1,1,1,0,0],
            [0,1,1,1,1,1,0],
            [1,1,1,1,1,1,1],
            [1,1,0,0,0,1,1],
            [1,0,0,0,0,0,1]
        ];

        for(let r = 0; r < 7; r++) {
            for(let c = 0; c < 7; c++) {
                if(shipShape[r][c]) {
                    ctx.fillRect(px + c * s, py + r * s, s + 0.5, s + 0.5);
                }
            }
        }

        // Draw Bullets
        bullets.forEach(bullet => {
            ctx.fillStyle = bullet.color;
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });

        // Draw Enemies (Improved Atari Sprite)
        enemies.forEach(enemy => {
            ctx.fillStyle = enemy.color;
            const s = enemy.width / 5; // Use 5x5 grid for enemy design
            
            // Central Body
            ctx.fillRect(enemy.x + s, enemy.y + s, s * 3, s * 3);
            // Antennas/Horns
            ctx.fillRect(enemy.x, enemy.y, s, s);
            ctx.fillRect(enemy.x + s * 4, enemy.y, s, s);
            // Arms/Wings
            ctx.fillRect(enemy.x, enemy.y + s * 2, s, s * 2);
            ctx.fillRect(enemy.x + s * 4, enemy.y + s * 2, s, s * 2);
            // Bottom details
            ctx.fillRect(enemy.x + s, enemy.y + s * 4, s, s);
            ctx.fillRect(enemy.x + s * 3, enemy.y + s * 4, s, s);

            // Eyes (Atari style)
            ctx.fillStyle = '#000';
            ctx.fillRect(enemy.x + s, enemy.y + s * 2, s, s);
            ctx.fillRect(enemy.x + s * 3, enemy.y + s * 2, s, s);
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
    playRetroMusic();
    frameId = requestAnimationFrame(gameLoop);
}

// Initial Draw for Menu
draw();
