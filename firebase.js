const leaderboardStatusEl = document.getElementById('leaderboardStatus');
const leaderboardListEl = document.getElementById('leaderboardList');
const refreshLeaderboardBtn = document.getElementById('refreshLeaderboardBtn');
const LEADERBOARD_LIMIT = 5;

let firebaseApp = null;
let firebaseDb = null;
let firebaseConfigPromise = null;
let scoresRef = null;
let leaderboardValueHandler = null;

async function ensureFirebaseClient() {
  if (firebaseDb) {
    return firebaseDb;
  }

  if (!firebaseConfigPromise) {
    firebaseConfigPromise = loadFirebaseConfig();
  }

  const config = await firebaseConfigPromise;
  if (!isFirebaseConfigReady(config) || !window.firebase) {
    return null;
  }

  if (!firebaseApp) {
    firebaseApp = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(config);
  }

  firebaseDb = window.firebase.database(firebaseApp);
  return firebaseDb;
}

function isFirebaseConfigReady(config) {
  return Boolean(
    config &&
    config.apiKey &&
    config.authDomain &&
    config.databaseURL &&
    config.projectId &&
    config.appId
  );
}

async function loadFirebaseConfig() {
  if (isFirebaseConfigReady(window.FIREBASE_CONFIG)) {
    return window.FIREBASE_CONFIG;
  }

  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('无法读取部署配置');
    }

    const data = await response.json();
    if (isFirebaseConfigReady(data)) {
      window.FIREBASE_CONFIG = data;
    }

    return data;
  } catch (error) {
    return window.FIREBASE_CONFIG || {};
  }
}

function formatTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function setLeaderboardStatus(message, tone = 'default') {
  leaderboardListEl.classList.add('hidden');
  leaderboardStatusEl.classList.remove('hidden', 'text-rose-400', 'text-emerald-400', 'text-amber-400');
  leaderboardStatusEl.textContent = message;

  if (tone === 'error') {
    leaderboardStatusEl.classList.add('text-rose-400');
  } else if (tone === 'success') {
    leaderboardStatusEl.classList.add('text-emerald-400');
  } else if (tone === 'warning') {
    leaderboardStatusEl.classList.add('text-amber-400');
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeLeaderboardRows(scoresData) {
  if (!scoresData) {
    return [];
  }

  return Object.entries(scoresData)
    .map(([playerId, data]) => ({
      player_name: data.playerName || playerId,
      best_score: Number(data.bestScore || 0),
      achieved_at: data.achievedAt || ''
    }))
    .sort((a, b) => {
      if (b.best_score !== a.best_score) {
        return b.best_score - a.best_score;
      }
      return new Date(a.achieved_at) - new Date(b.achieved_at);
    })
    .slice(0, LEADERBOARD_LIMIT);
}

function renderLeaderboard(scoresData) {
  const rows = normalizeLeaderboardRows(scoresData);

  if (!rows.length) {
    setLeaderboardStatus('暂无排行榜数据，快来成为第一个上榜的人吧。');
    return;
  }

  leaderboardStatusEl.classList.add('hidden');
  leaderboardListEl.classList.remove('hidden');

  leaderboardListEl.innerHTML = rows.map((item, index) => {
    const score = item.best_score ?? 0;
    const playerName = item.player_name ?? '匿名';
    const timeLabel = formatTime(item.achieved_at);

    return `
      <div class="grid grid-cols-[56px_1fr_72px] gap-3 px-4 py-4 border-b border-white/5 last:border-b-0 items-center">
        <div>
          <span class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-slate-100">${index + 1}</span>
        </div>
        <div>
          <p class="font-semibold text-white break-all">${escapeHtml(playerName)}</p>
          <p class="text-xs text-slate-400">${timeLabel || '刚刚提交'}</p>
        </div>
        <div class="text-right text-lg font-bold text-emerald-400">${score}</div>
      </div>
    `;
  }).join('');
}

async function queryLeaderboard() {
  const db = await ensureFirebaseClient();
  if (!db) {
    throw new Error('Firebase 未配置');
  }

  const snapshot = await db.ref('scores').get();
  return snapshot.exists() ? snapshot.val() : {};
}

async function fetchAndRenderLeaderboard(options = {}) {
  const { silent = false } = options;
  const db = await ensureFirebaseClient();
  if (!db) {
    setLeaderboardStatus('请先配置 Firebase，可填写 config.js 或在 Vercel 中设置环境变量。', 'warning');
    return;
  }

  try {
    if (!silent) {
      setLeaderboardStatus('正在加载排行榜...');
    }

    const scoresData = await queryLeaderboard();
    renderLeaderboard(scoresData);
  } catch (error) {
    console.error(error);
    setLeaderboardStatus('排行榜加载失败：' + (error.message || '请检查 Firebase 配置'), 'error');
  }
}

async function initLeaderboardRealtime() {
  const db = await ensureFirebaseClient();
  if (!db || leaderboardValueHandler) {
    return;
  }

  scoresRef = db.ref('scores');
  leaderboardValueHandler = (snapshot) => {
    const scoresData = snapshot.exists() ? snapshot.val() : {};
    renderLeaderboard(scoresData);
  };

  scoresRef.on('value', leaderboardValueHandler, (error) => {
    console.error(error);
    setLeaderboardStatus('实时同步失败：' + (error.message || '请稍后手动刷新'), 'error');
  });
}

function cleanupLeaderboardRealtime() {
  if (scoresRef && leaderboardValueHandler) {
    scoresRef.off('value', leaderboardValueHandler);
    leaderboardValueHandler = null;
    scoresRef = null;
  }
}

window.loadLeaderboard = async function loadLeaderboard() {
  await fetchAndRenderLeaderboard({ silent: false });
};

window.submitScoreToSupabase = async function submitScoreToSupabase(playerName, score) {
  const db = await ensureFirebaseClient();
  if (!db) {
    throw new Error('Firebase 未配置');
  }

  const cleanName = playerName.trim();
  if (!cleanName || cleanName.length > 20) {
    throw new Error('ID 长度需为 1-20 个字符');
  }

  const safeKey = cleanName.replace(/[.#$\[\]/]/g, '_');
  const now = new Date().toISOString();
  const playerRef = db.ref(`scores/${safeKey}`);

  await playerRef.transaction((currentData) => {
    if (!currentData) {
      return {
        playerName: cleanName,
        bestScore: score,
        achievedAt: now
      };
    }

    if (score > Number(currentData.bestScore || 0)) {
      return {
        ...currentData,
        playerName: cleanName,
        bestScore: score,
        achievedAt: now
      };
    }

    return currentData;
  });
};

refreshLeaderboardBtn.addEventListener('click', async () => {
  await window.loadLeaderboard();
});

window.addEventListener('beforeunload', cleanupLeaderboardRealtime);

(async () => {
  await window.loadLeaderboard();
  await initLeaderboardRealtime();
})();
