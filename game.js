const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');

const finalScoreDisplay = document.getElementById('final-score');
const rankingList = document.getElementById('ranking-list');
const restartBtn = document.getElementById('restart-btn');
const homeBtn = document.getElementById('home-btn');
const noiseTexture = document.querySelector('.noise-texture');

const overlayInicial = document.getElementById('overlay-inicial');
const startPlayerNameInput = document.getElementById('start-player-name');
const btnModoEstavel = document.getElementById('btn-modo-estavel');
const btnModoChaos = document.getElementById('btn-modo-chaos');

let gameMode = 'easy';
let currentPlayerName = 'ANON';

// ========================
// SÍNTESE DE ÁUDIO
// ========================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let bgHumOsc = null;

function playSystemSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'pickup') {
        osc.type = 'square'; // Som de 8-bit
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    } else if (type === 'crash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(10, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    }
    
    osc.start();
    osc.stop(audioCtx.currentTime + (type === 'pickup' ? 0.1 : 0.5));
}

function startBgHum() {
    if (bgHumOsc) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    bgHumOsc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    bgHumOsc.type = 'sine';
    bgHumOsc.frequency.setValueAtTime(60, audioCtx.currentTime); // Zumbido de 60Hz 
    
    bgHumOsc.connect(gain);
    gain.connect(audioCtx.destination);
    
    gain.gain.value = 0.05; // Intensidade baixa do zumbido
    
    bgHumOsc.start();
}

function stopBgHum() {
    if (bgHumOsc) {
        bgHumOsc.stop();
        bgHumOsc = null;
    }
}

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
let gameStatus = 'MENU'; // MENU, PLAYING, GAME_OVER

// ========================
// CONTROLES E START
// ========================

// Listeners do menu inicial
btnModoEstavel.addEventListener('click', () => startConfig('easy'));
btnModoChaos.addEventListener('click', () => startConfig('chaos'));

function startConfig(mode) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    gameMode = mode;
    
    currentPlayerName = startPlayerNameInput.value.trim().toUpperCase() || 'ANON';
    
    overlayInicial.style.display = 'none';
    resetGame();
}

function showMenu() {
    gameStatus = 'MENU';
    stopBgHum();
    gameOverScreen.style.display = 'none';
    overlayInicial.style.display = 'flex';
    document.body.classList.remove('dead-system', 'impact-effect', 'decay-critical');
    noiseTexture.style.opacity = 0.08;
    setTimeout(() => startPlayerNameInput.focus(), 50);
}

function resetGame() {
    const textTargets = document.querySelectorAll('.hero-title, .hero-subtitle');
    textTargets.forEach(el => {
        if (!el.dataset.originalHtml) el.dataset.originalHtml = el.innerHTML;
        else el.innerHTML = el.dataset.originalHtml;
    });

    snake = [{x: 10, y: 10}];
    px = 10;
    py = 10;
    dx = 1;
    dy = 0;
    score = 0;
    updateScoreUI();
    baseSpeed = 150; // Reseta velocidade
    
    document.body.classList.remove('dead-system');
    updatePassiveDecay(0); // Reseta a corrupção visual e passiva com currentScore 0
    
    if (gameMode === 'chaos') {
        startBgHum();
    } else {
        stopBgHum();
    }
    
    placeApple();
    gameStatus = 'PLAYING';
    document.body.classList.add('game-active');
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

function triggerAppleGlitch() {
    if (gameMode !== 'chaos') return;

    // Efeito de impacto ao comer (200ms)
    document.body.classList.add('impact-effect');
    setTimeout(() => {
        document.body.classList.remove('impact-effect');
    }, 200);
}

function updatePassiveDecay(currentScore) {
    if (gameMode !== 'chaos') {
        noiseTexture.style.opacity = 0.08;
        return;
    }

    // Aumento de opacidade progressiva (+5% a cada 5 pontos)
    let extraOpacity = Math.floor(currentScore / 5) * 0.05;
    noiseTexture.style.opacity = (0.08 + extraOpacity).toFixed(2);
    
    // Apenas acima de 20 pontos ativamos alterações radicais de core/cor
    if (currentScore >= 20) {
        document.body.classList.add('decay-critical');
    } else {
        document.body.classList.remove('decay-critical');
    }
    
    // Efeitos passivos opacidade/glitch (Também restrito a >= 20)
    const elementsToGlitch = document.querySelectorAll('.pulse-text, .score-container h2');
    if (currentScore >= 20) {
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
        playSystemSound('pickup');
        triggerAppleGlitch(); // O Efeito de batida de 200ms
        updatePassiveDecay(score); // Avalia mudanças graduais e radicais
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

function systemShutdown() {
    stopBgHum();
    playSystemSound('crash');

    // Congele o canvas (pare o movimento)
    clearInterval(gameInterval);
    if (glitchInterval) clearInterval(glitchInterval);
    
    // Aplique um filtro de grayscale(100%) em toda a Landing Page
    document.body.classList.remove('impact-effect', 'decay-critical', 'game-active');
    document.body.classList.add('dead-system');
    
    // UI do Modal
    finalScoreDisplay.innerText = score.toString().padStart(4, '0');
    
    saveScore(currentPlayerName, score);
    renderRanking();
    
    gameOverScreen.style.display = 'flex';
    setTimeout(() => restartBtn.focus(), 50);
}

function gameOver() {
    gameStatus = 'GAME_OVER';
    systemShutdown();
}

// ==== RANKING & LOCAL STORAGE ====
function renderRanking() {
    let logs = JSON.parse(localStorage.getItem('neural_decay_logs') || '[]');
    rankingList.innerHTML = logs.map(log => `<li><span style="color: #ccc;">${log.name}</span><span style="color: #39ff14; text-shadow: 0 0 10px rgba(57,255,20,0.6);">${log.score}% Recuperado</span></li>`).join('');
}

function saveScore(playerName, currentScore) {
    let logs = JSON.parse(localStorage.getItem('neural_decay_logs') || '[]');
    logs.push({ name: playerName, score: currentScore.toString().padStart(4, '0') });
    
    // Sort descendente por score
    logs.sort((a, b) => parseInt(b.score) - parseInt(a.score));
    logs = logs.slice(0, 5); // Limita em Top 5
    
    localStorage.setItem('neural_decay_logs', JSON.stringify(logs));
}

restartBtn.addEventListener('click', resetGame);
homeBtn.addEventListener('click', showMenu);

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
    // No loop de desenho, use um valor de alpha menor para o rastro ser mais "fantasmagórico"
    ctx.fillStyle = 'rgba(10, 10, 10, 0.05)'; // 0.05 em vez de 0.1 torna o rastro mais sutil
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
    
    // Crescimento visual agressivo do Shadow Blur com base no score apenas se CHAOS ativo!
    let dynamicBaseBlur = (gameMode === 'chaos') ? 20 + (score * 3.5) : 5; 
    let dynamicHeadBlur = (gameMode === 'chaos') ? 35 + (score * 5) : 10;

    for (let i = 0; i < snake.length; i++) {
        // A luz vaza fortemente se no modo Decay
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
    if (gameStatus === 'MENU') {
        // Foca no input do menu ou dá start pelo botão Chaos se dar Enter no input vazando...
        if (e.code === 'Enter' && document.activeElement !== startPlayerNameInput) {
            btnModoChaos.click();
        }
        return;
    }

    // Tratamento especial quando game over
    if (gameStatus === 'GAME_OVER') {
        if (e.code === 'Space' || e.code === 'Enter') {
            resetGame();
        }
        return;
    }

    // Impede o scroll indesejado do navegador ao jogar e menu restrito
    if(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.code)) {
        e.preventDefault();
    }
    
    if (gameStatus !== 'PLAYING') {
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

// ========================
// SUPORTE MOBILE & TOUCH
// ========================

// Auto Resize do Canvas (mantém proporção 1:1 matemática pro grid interno tbm)
function resizeCanvas() {
    const wrapper = document.querySelector('.game-wrapper');
    if (wrapper) {
        let size = wrapper.clientWidth; // aspect-ratio já bloqueia 1:1 no css
        if (size > 800) size = 800; // max resolution bound
        
        canvas.width = size;
        canvas.height = size;
        gridSize = canvas.width / tileCount;
        
        if (gameStatus !== 'PLAYING') {
            // Garante preview visivel no menu ou game_over ao escalar
            requestAnimationFrame(draw); 
        }
    }
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 50);

// Swipe Controls no Canvas e Prevenção de Scroll indesejado
let touchStartX = 0, touchStartY = 0;

canvas.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, {passive: false});

// Ao desenhar sobre o canvas no touch (Swipe), previne a rolagem da pagina
canvas.addEventListener('touchmove', e => {
    if (e.target === canvas) {
        e.preventDefault(); 
    }
}, {passive: false});

canvas.addEventListener('touchend', e => {
    if (gameStatus !== 'PLAYING') return;

    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;
    
    let diffX = touchEndX - touchStartX;
    let diffY = touchEndY - touchStartY;
    
    // Treshold de 30px (evita pulos por toques mínimos de suor dos dedos)
    if (Math.abs(diffX) > 30 || Math.abs(diffY) > 30) {
        if (Math.abs(diffX) > Math.abs(diffY)) {
            // Movimentos horizontais
            if (diffX > 0 && dx === 0) { dx = 1; dy = 0; } // Swipe Direita
            else if (diffX < 0 && dx === 0) { dx = -1; dy = 0; } // Swipe Esquerda
        } else {
            // Movimentos verticais
            if (diffY > 0 && dy === 0) { dx = 0; dy = 1; } // Swipe Baixo
            else if (diffY < 0 && dy === 0) { dx = 0; dy = -1; } // Swipe Cima
        }
    }
});

// Lógica Visual do D-Pad Custom (Touch)
const dpadButtons = document.querySelectorAll('.dpad-btn');
dpadButtons.forEach(btn => {
    // touchstart para tempo de resposta 0 na tela mobile! Evita delays do input
    btn.addEventListener('touchstart', e => {
        e.preventDefault(); // Impede selects ou pseudo-scrolls
        triggerDpad(btn.dataset.key);
    }, {passive: false});
    
    // Para cliques com Mouse auxiliado no DevTool (Inspect Responsivo)
    btn.addEventListener('mousedown', e => {
        e.preventDefault();
        triggerDpad(btn.dataset.key);
    });
});

function triggerDpad(keyName) {
    if (gameStatus === 'MENU') {
        btnModoChaos.click();
        return;
    }
    
    if (gameStatus === 'GAME_OVER') {
        showMenu();
        return;
    }

    if (gameStatus !== 'PLAYING') return;

    const key = keyName.toLowerCase();
    
    if (key === 'arrowup' && dy === 0) { dx = 0; dy = -1; }
    else if (key === 'arrowdown' && dy === 0) { dx = 0; dy = 1; }
    else if (key === 'arrowleft' && dx === 0) { dx = -1; dy = 0; }
    else if (key === 'arrowright' && dx === 0) { dx = 1; dy = 0; }
}

window.addEventListener("keydown", function(e) {
    if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
        e.preventDefault();
    }
}, false);
