const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const submitPanel = document.getElementById('submitPanel');
const submitScoreBtn = document.getElementById('submitScoreBtn');
const submitStatus = document.getElementById('submitStatus');
const playerIdInput = document.getElementById('playerIdInput');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const controlButtons = document.querySelectorAll('.control-btn');

const gridSize = 20;
const tileCount = canvas.width / gridSize;
const initialSpeed = 140;
const minSpeed = 70;
const speedStep = 4;
const AudioContextClass = window.AudioContext || window.webkitAudioContext;

let audioContext = null;
let backgroundMusic = null;
let isMusicPlaying = false;
let snake = [];
let food = { x: 10, y: 10 };
let direction = { x: 1, y: 0 };
let queuedDirection = { x: 1, y: 0 };
let score = 0;
let best = Number(localStorage.getItem('snake-best-score') || 0);
let gameTimer = null;
let gameSpeed = initialSpeed;
let isRunning = false;
let isPaused = false;
let isGameOver = false;

bestEl.textContent = String(best);

backgroundMusic = document.getElementById('backgroundMusic');

const storedPlayerId = localStorage.getItem('snake-player-id');
if (storedPlayerId) {
  playerIdInput.value = storedPlayerId;
}

function ensureAudioContext() {
  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function playTone({ startFrequency, endFrequency, duration, volume }) {
  const context = ensureAudioContext();
  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const now = context.currentTime;

  oscillator.type = 'triangle';
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);

  gainNode.gain.setValueAtTime(volume, now);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playTurnSound() {
  playTone({
    startFrequency: 300,
    endFrequency: 400,
    duration: 0.1,
    volume: 0.05
  });
}

function playDeathSound() {
  playTone({
    startFrequency: 420,
    endFrequency: 120,
    duration: 0.3,
    volume: 0.08
  });
}

function resetGame() {
  snake = [
    { x: 6, y: 10 },
    { x: 5, y: 10 },
    { x: 4, y: 10 }
  ];
  direction = { x: 1, y: 0 };
  queuedDirection = { x: 1, y: 0 };
  score = 0;
  gameSpeed = initialSpeed;
  scoreEl.textContent = '0';
  isGameOver = false;
  placeFood();
  draw();
}

function placeFood() {
  let nextFood;
  do {
    nextFood = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount)
    };
  } while (snake.some((segment) => segment.x === nextFood.x && segment.y === nextFood.y));
  food = nextFood;
}

function startGame() {
  clearInterval(gameTimer);
  resetGame();
  isRunning = true;
  isPaused = false;
  pauseBtn.textContent = '暂停';
  hideOverlay();

  if (backgroundMusic && !isMusicPlaying) {
    backgroundMusic.volume = 0.1;
    backgroundMusic.play().catch(() => {});
    isMusicPlaying = true;
  }

  gameTimer = setInterval(gameLoop, gameSpeed);
}

function restartTimer() {
  clearInterval(gameTimer);
  gameTimer = setInterval(gameLoop, gameSpeed);
}

function togglePause() {
  if (!isRunning) {
    return;
  }

  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? '继续' : '暂停';

  if (isPaused) {
    showOverlay('游戏暂停', '按空格继续，或点击“继续”恢复游戏。');
  } else {
    hideOverlay();
  }
}

function gameOver() {
  isRunning = false;
  isPaused = false;
  isGameOver = true;
  clearInterval(gameTimer);
  pauseBtn.textContent = '暂停';

  if (score > best) {
    best = score;
    localStorage.setItem('snake-best-score', String(best));
    bestEl.textContent = String(best);
  }

  submitPanel.classList.remove('hidden');
  setSubmitStatus('');

  if (score > 0) {
    showOverlay('游戏结束', `本局得分 ${score}。你可以提交成绩到排行榜。`);
  } else {
    showOverlay('游戏结束', `本局得分 ${score}，按 Enter 或点击“开始游戏”再来一局。`);
    submitPanel.classList.add('hidden');
  }
}

function setSubmitStatus(message, tone = 'default') {
  submitStatus.textContent = message;
  submitStatus.classList.remove('text-rose-400', 'text-emerald-400', 'text-amber-400');

  if (tone === 'error') {
    submitStatus.classList.add('text-rose-400');
  } else if (tone === 'success') {
    submitStatus.classList.add('text-emerald-400');
  } else if (tone === 'warning') {
    submitStatus.classList.add('text-amber-400');
  }
}

async function handleScoreSubmit() {
  const playerName = playerIdInput.value.trim();

  if (!playerName) {
    setSubmitStatus('请先在左侧输入你的 ID。', 'error');
    return;
  }

  if (playerName.length < 1 || playerName.length > 20) {
    setSubmitStatus('ID 长度需为 1–20 个字符。', 'error');
    return;
  }

  if (score <= 0) {
    setSubmitStatus('本局得分为 0，无法提交。', 'error');
    return;
  }

  submitScoreBtn.disabled = true;
  setSubmitStatus('正在提交...');

  try {
    localStorage.setItem('snake-player-id', playerName);

    if (window.submitScoreToSupabase) {
      await window.submitScoreToSupabase(playerName, score);
      setSubmitStatus('提交成功！排行榜已更新。', 'success');

      if (window.loadLeaderboard) {
        await window.loadLeaderboard();
      }
    } else {
      setSubmitStatus('Supabase 配置未完成，无法提交。请先配置 config.js。', 'warning');
    }
  } catch (err) {
    console.error(err);
    setSubmitStatus('提交失败：' + (err.message || '网络或配置错误'), 'error');
  } finally {
    submitScoreBtn.disabled = false;
  }
}

function updateDirection(next) {
  if (!isRunning) {
    return;
  }

  const opposite = direction.x + next.x === 0 && direction.y + next.y === 0;
  if (!opposite) {
    queuedDirection = next;
    playTurnSound();
  }
}

function gameLoop() {
  if (isPaused) {
    return;
  }

  direction = queuedDirection;
  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y
  };

  const hitsWall = head.x < 0 || head.y < 0 || head.x >= tileCount || head.y >= tileCount;
  const hitsSelf = snake.some((segment) => segment.x === head.x && segment.y === head.y);

  if (hitsWall || hitsSelf) {
    playDeathSound();
    gameOver();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.textContent = String(score);
    placeFood();

    if (gameSpeed > minSpeed) {
      gameSpeed = Math.max(minSpeed, gameSpeed - speedStep);
      restartTimer();
    }
  } else {
    snake.pop();
  }

  draw();
}

function drawBoard() {
  ctx.fillStyle = '#071422';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < tileCount; x += 1) {
    for (let y = 0; y < tileCount; y += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#0b1b2b' : '#0e2133';
      ctx.fillRect(x * gridSize, y * gridSize, gridSize - 1, gridSize - 1);
    }
  }
}

function drawSnake() {
  snake.forEach((segment, index) => {
    const isHead = index === 0;
    ctx.fillStyle = isHead ? '#34d399' : '#10b981';
    roundRect(segment.x * gridSize + 1, segment.y * gridSize + 1, gridSize - 3, gridSize - 3, 6);
    ctx.fill();

    if (isHead) {
      ctx.fillStyle = '#052e16';
      ctx.beginPath();
      ctx.arc(segment.x * gridSize + 7, segment.y * gridSize + 8, 1.8, 0, Math.PI * 2);
      ctx.arc(segment.x * gridSize + 13, segment.y * gridSize + 8, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawFood() {
  ctx.fillStyle = '#f43f5e';
  roundRect(food.x * gridSize + 2, food.y * gridSize + 2, gridSize - 4, gridSize - 4, 8);
  ctx.fill();

  ctx.fillStyle = '#fecdd3';
  ctx.beginPath();
  ctx.arc(food.x * gridSize + 10, food.y * gridSize + 10, 3, 0, Math.PI * 2);
  ctx.fill();
}

function draw() {
  drawBoard();
  drawFood();
  drawSnake();
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
  submitPanel.classList.add('hidden');
  setSubmitStatus('');
}

function handleDirectionInput(name) {
  const map = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  if (map[name]) {
    updateDirection(map[name]);
  }
}

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
  }

  if (key === 'arrowup' || key === 'w') {
    handleDirectionInput('up');
  } else if (key === 'arrowdown' || key === 's') {
    handleDirectionInput('down');
  } else if (key === 'arrowleft' || key === 'a') {
    handleDirectionInput('left');
  } else if (key === 'arrowright' || key === 'd') {
    handleDirectionInput('right');
  } else if (key === ' ') {
    togglePause();
  } else if (key === 'enter') {
    if (isGameOver && !submitPanel.classList.contains('hidden')) {
      handleScoreSubmit();
    } else {
      startGame();
    }
  }
});

controlButtons.forEach((button) => {
  button.addEventListener('click', () => {
    handleDirectionInput(button.dataset.dir);
  });
});

startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
submitScoreBtn.addEventListener('click', handleScoreSubmit);

resetGame();
showOverlay('准备开始', '点击“开始游戏”或按 Enter，冲击排行榜。');
