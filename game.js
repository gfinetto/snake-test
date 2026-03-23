const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');

const finalScoreDisplay = document.getElementById('final-score');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const rankingList = document.getElementById('ranking-list');

// Buscar Cores dos Design Tokens
const rootStyles = getComputedStyle(document.documentElement);
// Fallback para as cores exatas criadas em tokens.css
const colorSnake = rootStyles.getPropertyValue('--color-accent-snake').trim() || '#00ffff';
const colorApple = rootStyles.getPropertyValue('--color-accent-item').trim() || '#ff00ff';

// Configuração do Grid
const tileCount = 20;
let gridSize = canvas.width / tileCount;

// Variáveis do Jogo
let snake = [];
let px = 10, py = 10;
let dx = 0, dy = 0;
let appleX = 15, appleY = 15;
let score = 0;
let baseSpeed = 150; // ms por frame (quanto menor, mais rápido)
let gameInterval;
let gameStatus = 'START'; // START, PLAYING, GAME_OVER

// ========================
// CONTROLES E START
// ========================
function resetGame() {
    snake = [{x: 10, y: 10}];
    px = 10;
    py = 10;
    // Inicia parado ou com leve direção
    dx = 1;
    dy = 0;
    score = 0;
    updateScoreUI();
    baseSpeed = 150; // Reseta velocidade
    
    applyDecay(score); // Reseta a corrupção visual
    
    placeApple();
    gameStatus = 'PLAYING';
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, baseSpeed);
}

function updateScoreUI() {
    scoreDisplay.innerText = score.toString().padStart(4, '0');
}

// ========================
// LÓGICA DE CORRUPÇÃO
// ========================

const glitchChars = '!<>-_\\/[]{}—=+*^?#_@&$%';
let glitchInterval;

function applyDecay(currentScore) {
    // Remove todas as classes de decay
    document.body.classList.remove('decay-1', 'decay-2', 'decay-3');
    
    // Adiciona conforme a progressão cumulativa
    if (currentScore >= 15) {
        document.body.classList.add('decay-1', 'decay-2', 'decay-3');
    } else if (currentScore >= 10) {
        document.body.classList.add('decay-1', 'decay-2');
    } else if (currentScore >= 5) {
        document.body.classList.add('decay-1');
    }
    
    // Efeitos passivos em certos elementos
    const elementsToGlitch = document.querySelectorAll('.pulse-text, .score-container h2');
    
    if (currentScore > 15) {
        elementsToGlitch.forEach(el => {
            if (Math.random() > 0.4) {
                el.classList.add('text-corrupted');
                el.style.opacity = (Math.random() * 0.7 + 0.1).toFixed(2);
            } else {
                el.classList.remove('text-corrupted');
                el.style.opacity = '1';
            }
        });
    } else {
        elementsToGlitch.forEach(el => {
            el.classList.remove('text-corrupted');
            el.style.opacity = '1';
        });
    }

    // Configura o Efeito de Glitch de Texto Ativo na Landing Page
    manageTextGlitch(currentScore);
}

function manageTextGlitch(currentScore) {
    if (glitchInterval) clearInterval(glitchInterval);
    
    const glitchTargets = document.querySelectorAll('.hero-subtitle, .hero-title .accent');
    
    // Restaura e salva os originais
    glitchTargets.forEach(el => {
        if (!el.dataset.originalText) el.dataset.originalText = el.innerText;
        el.innerText = el.dataset.originalText; 
    });

    if (currentScore < 5) return; // Dispara após os primeiros 5 pontos
    
    const intensity = Math.min(currentScore, 30);
    const speed = Math.max(80, 500 - (intensity * 12)); // Fica mais rápido com o score

    glitchInterval = setInterval(() => {
        glitchTargets.forEach(el => {
            let original = el.dataset.originalText;
            
            // Intensidade da chance de bugar o texto ativo
            if (Math.random() < (intensity * 0.025)) {
                let glitched = original.split('').map(char => {
                    // Troca caracteres não vazios por símbolos aleatórios ($ % @ #)
                    if (char.trim() !== '' && Math.random() < 0.35) {
                        return glitchChars[Math.floor(Math.random() * glitchChars.length)];
                    }
                    return char;
                }).join('');
                el.innerText = glitched;
            } else {
                el.innerText = original; // Retorna rápido piscando
            }
        });
    }, speed);
}

// ========================
// LOOP E LÓGICA
// ========================
function gameLoop() {
    px += dx;
    py += dy;
    
    // Efeito Paredes Falsas (Atravessa bordas estilo Pac-Man nostálgico)
    if (px < 0) px = tileCount - 1;
    if (px > tileCount - 1) px = 0;
    if (py < 0) py = tileCount - 1;
    if (py > tileCount - 1) py = 0;
    
    // Cria nova cabeça a partir do movimento
    let newHead = {x: px, y: py};
    
    // Verifica colisão apenas se estiver em movimento de fato
    if (dx !== 0 || dy !== 0) {
        for (let i = 0; i < snake.length; i++) {
            if (snake[i].x === px && snake[i].y === py) {
                gameOver();
                return;
            }
        }
    }
    
    snake.push(newHead);
    
    // Lógica da Maçã (Item / Dado)
    if (px === appleX && py === appleY) {
        score += 5; // Ajustado para 5 por maçã pra encaixar perfeitamente com os leveis
        updateScoreUI();
        applyDecay(score); // Avalia a corrupção visual
        placeApple();
        
        // CRESCE e AUMENTA DIFICULDADE
        baseSpeed = Math.max(50, baseSpeed - 2); 
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, baseSpeed);
    } else {
        // Remover a cauda pra andar (se comeu, cauda não é removida, efetuando o crescimento)
        if (dx !== 0 || dy !== 0) {
            snake.shift(); 
        } else {
            snake.shift(); 
        }
    }
    
    draw();
}

function gameOver() {
    gameStatus = 'GAME_OVER';
    clearInterval(gameInterval);
    
    // Configura UI do Modal
    finalScoreDisplay.innerText = score.toString().padStart(4, '0');
    playerNameInput.value = ''; // Reset input
    renderRanking();
    
    gameOverScreen.style.display = 'flex';
    // Coloca o foco no input logo em seguida
    setTimeout(() => playerNameInput.focus(), 50);
}

// ==== RANKING & LOCAL STORAGE ====
function renderRanking() {
    let logs = JSON.parse(localStorage.getItem('neural_decay_logs') || '[]');
    rankingList.innerHTML = logs.map(log => `<li><span>${log.name}</span><span style="color: var(--color-accent-snake);">${log.score}</span></li>`).join('');
}

saveScoreBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim().toUpperCase() || 'ANON';
    let logs = JSON.parse(localStorage.getItem('neural_decay_logs') || '[]');
    
    logs.push({ name: name, score: score.toString().padStart(4, '0') });
    
    // Sort descendente por score
    logs.sort((a, b) => parseInt(b.score) - parseInt(a.score));
    logs = logs.slice(0, 5); // Limita em Top 5
    
    localStorage.setItem('neural_decay_logs', JSON.stringify(logs));
    renderRanking();
    
    saveScoreBtn.innerText = 'SALVO!';
    playerNameInput.blur(); // Perde o foco para o user dar espaço/enter de novo e dar play
    setTimeout(() => { saveScoreBtn.innerText = 'SALVAR LOG'; }, 2000);
});

function placeApple() {
    let valid = false;
    while (!valid) {
        appleX = Math.floor(Math.random() * tileCount);
        appleY = Math.floor(Math.random() * tileCount);
        valid = true;
        // Evita spawna em cima do próprio corpo
        for (let segment of snake) {
            if (segment.x === appleX && segment.y === appleY) {
                valid = false;
                break;
            }
        }
    }
}

// ========================
// RENDERIZAÇÃO NO CANVAS
// ========================
function draw() {
    // Limpa a tela deixando um rastro de luz (Motion Trail)
    ctx.fillStyle = 'rgba(5, 5, 5, 0.2)'; // Fundo translúcido substituindo clearRect
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid Visual (efeito Cyber-Retro Hack)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let i = 0; i <= tileCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, canvas.height);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(canvas.width, i * gridSize);
        ctx.stroke();
    }

    // ITEM = MAÇÃ = DADOS
    ctx.fillStyle = colorApple;
    ctx.shadowBlur = 25; // Apple Glow intenso
    ctx.shadowColor = colorApple; // Rosa Neon
    // O item é um pouco menor que o grid pra dar o aspecto quadradinho legal
    ctx.fillRect(appleX * gridSize + 2, appleY * gridSize + 2, gridSize - 4, gridSize - 4);
    
    // COBRA = NEON CYAN
    ctx.fillStyle = colorSnake;
    ctx.shadowColor = colorSnake; // Neon Cyan
    
    // Crescimento visual agressivo do Shadow Blur com base no score!
    let dynamicBaseBlur = 20 + (score * 3.5); // Multiplicador ampliado severamente
    let dynamicHeadBlur = 35 + (score * 5);   // Cabeça estoura ainda mais

    for (let i = 0; i < snake.length; i++) {
        // A luz vaza fortemente, borrando a tela de tanta luz
        if (i === snake.length - 1) {
            ctx.shadowBlur = dynamicHeadBlur;
        } else {
            ctx.shadowBlur = dynamicBaseBlur;
        }
        ctx.fillRect(snake[i].x * gridSize + 1, snake[i].y * gridSize + 1, gridSize - 2, gridSize - 2);
    }
    
    // Reseta o glow para não bugar o resto do ctx
    ctx.shadowBlur = 0;
}

// ========================
// INPUTS DO TECLADO
// ========================
window.addEventListener('keydown', e => {
    // Tratamento especial quando game over e input focado (permite digitar espaço se quiser, ou enter pra salvar)
    if (gameStatus === 'GAME_OVER' && document.activeElement === playerNameInput) {
        if (e.code === 'Enter') {
            saveScoreBtn.click();
        }
        return; // Retorna imediatamente para não dar bind/prevent nas teclas nativas
    }

    // Impede o scroll indesejado do navegador ao jogar e menu restrito
    if(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.code)) {
        e.preventDefault();
    }
    
    if (gameStatus !== 'PLAYING') {
        // Enter / Espaço iniciam o jogo/reiniciam
        if (e.code === 'Space' || e.code === 'Enter') {
            resetGame();
        }
        return;
    }
    
    const key = e.key.toLowerCase();
    
    // Setinhas ou WASD, prevenindo se matar indo imediatamente pro lado inverso
    if ((key === 'arrowup' || key === 'w') && dy === 0) {
        dx = 0; dy = -1;
    } else if ((key === 'arrowdown' || key === 's') && dy === 0) {
        dx = 0; dy = 1;
    } else if ((key === 'arrowleft' || key === 'a') && dx === 0) {
        dx = -1; dy = 0;
    } else if ((key === 'arrowright' || key === 'd') && dx === 0) {
        dx = 1; dy = 0;
    }
});

// Timeout sutil pra computar os computadores (variáveis css) e fazer o primeiro frame manual
setTimeout(() => {
    // Inicia parado no meio para a tela de start
    snake = [{x: 10, y: 10}];
    placeApple();
    draw();
}, 100);
