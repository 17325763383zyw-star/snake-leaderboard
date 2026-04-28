const leaderboardStatusEl = document.getElementById('leaderboardStatus');
const leaderboardListEl = document.getElementById('leaderboardList');
const refreshLeaderboardBtn = document.getElementById('refreshLeaderboardBtn');

let supabaseClient = null;
let supabaseConfigPromise = null;

async function ensureSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!supabaseConfigPromise) {
    supabaseConfigPromise = loadSupabaseConfig();
  }

  const config = await supabaseConfigPromise;
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase || !window.supabase.createClient) {
    return null;
  }

  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  return supabaseClient;
}

async function loadSupabaseConfig() {
  if (window.SNAKE_SUPABASE_URL && window.SNAKE_SUPABASE_ANON_KEY) {
    return {
      supabaseUrl: window.SNAKE_SUPABASE_URL,
      supabaseAnonKey: window.SNAKE_SUPABASE_ANON_KEY
    };
  }

  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('无法读取部署配置');
    }

    const data = await response.json();
    if (data.supabaseUrl && data.supabaseAnonKey) {
      window.SNAKE_SUPABASE_URL = data.supabaseUrl;
      window.SNAKE_SUPABASE_ANON_KEY = data.supabaseAnonKey;
    }

    return data;
  } catch (error) {
    return {
      supabaseUrl: window.SNAKE_SUPABASE_URL || '',
      supabaseAnonKey: window.SNAKE_SUPABASE_ANON_KEY || ''
    };
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

function renderLeaderboard(rows) {
  if (!rows.length) {
    setLeaderboardStatus('暂无排行榜数据，快来成为第一个上榜的人吧。');
    return;
  }

  leaderboardStatusEl.classList.add('hidden');
  leaderboardListEl.classList.remove('hidden');

  leaderboardListEl.innerHTML = rows.map((item, index) => {
    const score = item.best_score ?? item.score ?? 0;
    const playerName = item.player_name ?? item.player_id ?? '匿名';
    const timeLabel = formatTime(item.achieved_at ?? item.created_at);

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

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function queryLeaderboard() {
  const client = await ensureSupabaseClient();
  if (!client) {
    throw new Error('Supabase 未配置');
  }

  const { data: rpcData, error: rpcError } = await client.rpc('get_leaderboard', { limit_count: 10 });

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData;
  }

  const { data, error } = await client
    .from('scores')
    .select('player_name, score, created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    throw error;
  }

  const bestByPlayer = new Map();
  data.forEach((row) => {
    const existing = bestByPlayer.get(row.player_name);
    if (!existing || row.score > existing.score || (row.score === existing.score && row.created_at < existing.created_at)) {
      bestByPlayer.set(row.player_name, row);
    }
  });

  return [...bestByPlayer.values()]
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(a.created_at) - new Date(b.created_at);
    })
    .slice(0, 10)
    .map((row) => ({
      player_name: row.player_name,
      best_score: row.score,
      achieved_at: row.created_at
    }));
}

window.loadLeaderboard = async function loadLeaderboard() {
  const client = await ensureSupabaseClient();
  if (!client) {
    setLeaderboardStatus('请先配置 Supabase，支持填写 config.js 或在 Vercel 中设置环境变量。', 'warning');
    return;
  }

  setLeaderboardStatus('正在加载排行榜...');

  const rows = await queryLeaderboard();
  renderLeaderboard(rows);
};

window.submitScoreToSupabase = async function submitScoreToSupabase(playerName, score) {
  const client = await ensureSupabaseClient();
  if (!client) {
    throw new Error('Supabase 未配置');
  }

  const cleanName = playerName.trim();
  if (!cleanName || cleanName.length > 20) {
    throw new Error('ID 长度需为 1-20 个字符');
  }

  const { error } = await client
    .from('scores')
    .insert({
      player_name: cleanName,
      score
    });

  if (error) {
    throw error;
  }
};

refreshLeaderboardBtn.addEventListener('click', async () => {
  try {
    await window.loadLeaderboard();
  } catch (error) {
    console.error(error);
    setLeaderboardStatus('刷新失败：' + (error.message || '请稍后再试'), 'error');
  }
});

(async () => {
  try {
    await window.loadLeaderboard();
  } catch (error) {
    console.error(error);
    setLeaderboardStatus('排行榜加载失败：' + (error.message || '请检查 Supabase 配置'), 'error');
  }
})();
