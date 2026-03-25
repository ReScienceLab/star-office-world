// Star Office UI - 游戏主逻辑
// 依赖: layout.js（必须在这个之前加载）

// 检测浏览器是否支持 WebP
let supportsWebP = false;

// 方法 1: 使用 canvas 检测
function checkWebPSupport() {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      resolve(canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0);
    } else {
      resolve(false);
    }
  });
}

// 方法 2: 使用 image 检测（备用）
function checkWebPSupportFallback() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = 'data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQADADQlpAADcAD++/1QAA==';
  });
}

// 获取文件扩展名（根据 WebP 支持情况 + 布局配置的 forcePng）
function getExt(pngFile) {
  // star-working-spritesheet.png 太宽了，WebP 不支持，始终用 PNG
  if (pngFile === 'star-working-spritesheet.png') {
    return '.png';
  }
  // 如果布局配置里强制用 PNG，就用 .png
  if (LAYOUT.forcePng && LAYOUT.forcePng[pngFile.replace(/\.(png|webp)$/, '')]) {
    return '.png';
  }
  return supportsWebP ? '.webp' : '.png';
}

const config = {
  type: Phaser.AUTO,
  width: LAYOUT.game.width,
  height: LAYOUT.game.height,
  parent: 'game-container',
  pixelArt: true,
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: { preload: preload, create: create, update: update }
};

let totalAssets = 0;
let loadedAssets = 0;
let loadingProgressBar, loadingProgressContainer, loadingOverlay, loadingText;

// Memo 相关函数
async function loadMemo() {
  const memoDate = document.getElementById('memo-date');
  const memoContent = document.getElementById('memo-content');

  try {
    const response = await fetch('yesterday-memo?t=' + Date.now(), { cache: 'no-store' });
    const data = await response.json();

    if (data.success && data.memo) {
      memoDate.textContent = data.date || '';
      memoContent.innerHTML = data.memo.replace(/\n/g, '<br>');
    } else {
      memoContent.innerHTML = '<div id="memo-placeholder">暂无昨日日记</div>';
    }
  } catch (e) {
    console.error('加载 memo 失败:', e);
    memoContent.innerHTML = '<div id="memo-placeholder">加载失败</div>';
  }
}

// 更新加载进度
function updateLoadingProgress() {
  loadedAssets++;
  const percent = Math.min(100, Math.round((loadedAssets / totalAssets) * 100));
  if (loadingProgressBar) {
    loadingProgressBar.style.width = percent + '%';
  }
  if (loadingText) {
    loadingText.textContent = `正在加载 Star 的像素办公室... ${percent}%`;
  }
}

// 隐藏加载界面
function hideLoadingOverlay() {
  setTimeout(() => {
    if (loadingOverlay) {
      loadingOverlay.style.transition = 'opacity 0.5s ease';
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 500);
    }
  }, 300);
}

const STATES = {
  idle: { name: '待命', area: 'breakroom' },
  writing: { name: '整理文档', area: 'writing' },
  researching: { name: '搜索信息', area: 'researching' },
  executing: { name: '执行任务', area: 'writing' },
  syncing: { name: '同步备份', area: 'writing' },
  error: { name: '出错了', area: 'error' }
};

const BUBBLE_TEXTS = {
  idle: [
    '待命中：耳朵竖起来了',
    '我在这儿，随时可以开工',
    '先把桌面收拾干净再说',
    '呼——给大脑放个风',
    '今天也要优雅地高效',
    '等待，是为了更准确的一击',
    '咖啡还热，灵感也还在',
    '我在后台给你加 Buff',
    '状态：静心 / 充电',
    '小猫说：慢一点也没关系'
  ],
  writing: [
    '进入专注模式：勿扰',
    '先把关键路径跑通',
    '我来把复杂变简单',
    '把 bug 关进笼子里',
    '写到一半，先保存',
    '把每一步都做成可回滚',
    '今天的进度，明天的底气',
    '先收敛，再发散',
    '让系统变得更可解释',
    '稳住，我们能赢'
  ],
  researching: [
    '我在挖证据链',
    '让我把信息熬成结论',
    '找到了：关键在这里',
    '先把变量控制住',
    '我在查：它为什么会这样',
    '把直觉写成验证',
    '先定位，再优化',
    '别急，先画因果图'
  ],
  executing: [
    '执行中：不要眨眼',
    '把任务切成小块逐个击破',
    '开始跑 pipeline',
    '一键推进：走你',
    '让结果自己说话',
    '先做最小可行，再做最美版本'
  ],
  syncing: [
    '同步中：把今天锁进云里',
    '备份不是仪式，是安全感',
    '写入中…别断电',
    '把变更交给时间戳',
    '云端对齐：咔哒',
    '同步完成前先别乱动',
    '把未来的自己从灾难里救出来',
    '多一份备份，少一份后悔'
  ],
  error: [
    '警报响了：先别慌',
    '我闻到 bug 的味道了',
    '先复现，再谈修复',
    '把日志给我，我会说人话',
    '错误不是敌人，是线索',
    '把影响面圈起来',
    '先止血，再手术',
    '我在：马上定位根因',
    '别怕，这种我见多了',
    '报警中：让问题自己现形'
  ],
  cat: [
    '喵~',
    '咕噜咕噜…',
    '尾巴摇一摇',
    '晒太阳最开心',
    '有人来看我啦',
    '我是这个办公室的吉祥物',
    '伸个懒腰',
    '今天的罐罐准备好了吗',
    '呼噜呼噜',
    '这个位置视野最好'
  ]
};

let game, star, sofa, serverroom, areas = {}, currentState = 'idle', pendingDesiredState = null, statusText, lastFetch = 0, lastBlink = 0, lastBubble = 0, targetX = 660, targetY = 170, bubble = null, typewriterText = '', typewriterTarget = '', typewriterIndex = 0, lastTypewriter = 0, syncAnimSprite = null, catBubble = null;
let isMoving = false;
let waypoints = [];
let lastWanderAt = 0;
let coordsOverlay, coordsDisplay, coordsToggle;
let showCoords = false;
const FETCH_INTERVAL = 2000;
const BLINK_INTERVAL = 2500;
const BUBBLE_INTERVAL = 8000;
const CAT_BUBBLE_INTERVAL = 18000;
let lastCatBubble = 0;
const TYPEWRITER_DELAY = 50;
let agents = {}; // agentId -> sprite/container
let lastAgentsFetch = 0;
const AGENTS_FETCH_INTERVAL = 2500;
const SSE_MODE = {
  polling: 'polling',
  healthy: 'healthy',
  degraded: 'degraded'
};
const SSE_RECONNECT_DELAY = 3000;

// agent 颜色配置
const AGENT_COLORS = {
  star: 0xffd700,
  npc1: 0x00aaff,
  agent_nika: 0xff69b4,
  default: 0x94a3b8
};

// agent 名字颜色
const NAME_TAG_COLORS = {
  approved: 0x22c55e,
  pending: 0xf59e0b,
  rejected: 0xef4444,
  offline: 0x64748b,
  default: 0x1f2937
};

// breakroom / writing / error 区域的 agent 分布位置（多 agent 时错开）
const AREA_POSITIONS = {
  breakroom: [
    { x: 620, y: 180 },
    { x: 560, y: 220 },
    { x: 680, y: 210 },
    { x: 540, y: 170 },
    { x: 700, y: 240 },
    { x: 600, y: 250 },
    { x: 650, y: 160 },
    { x: 580, y: 200 }
  ],
  writing: [
    { x: 760, y: 320 },
    { x: 830, y: 280 },
    { x: 690, y: 350 },
    { x: 770, y: 260 },
    { x: 850, y: 340 },
    { x: 720, y: 300 },
    { x: 800, y: 370 },
    { x: 750, y: 240 }
  ],
  error: [
    { x: 180, y: 260 },
    { x: 120, y: 220 },
    { x: 240, y: 230 },
    { x: 160, y: 200 },
    { x: 220, y: 270 },
    { x: 140, y: 250 },
    { x: 200, y: 210 },
    { x: 260, y: 260 }
  ]
};

function createSSESyncState() {
  return {
    mode: SSE_MODE.polling,
    isHealthy: false,
    usePollingFallback: true,
    eventSource: null,
    lastEventType: null,
    eventHandlers: null,
    reconnectTimer: null,
    lifecycleBound: false
  };
}

function getSSESyncState(scene) {
  if (!scene) return createSSESyncState();
  if (!scene.sseSync) {
    scene.sseSync = createSSESyncState();
  }
  return scene.sseSync;
}

function setSSEHealthy(scene, eventSource) {
  const sseSync = getSSESyncState(scene);
  sseSync.mode = SSE_MODE.healthy;
  sseSync.isHealthy = true;
  sseSync.usePollingFallback = false;
  sseSync.eventSource = eventSource || sseSync.eventSource || null;
  return sseSync;
}

function setSSEDegraded(scene, eventSource) {
  const sseSync = getSSESyncState(scene);
  sseSync.mode = SSE_MODE.degraded;
  sseSync.isHealthy = false;
  sseSync.usePollingFallback = true;
  sseSync.eventSource = eventSource || sseSync.eventSource || null;
  return sseSync;
}

function clearSSEEventSource(scene) {
  const sseSync = getSSESyncState(scene);
  sseSync.eventSource = null;
  sseSync.eventHandlers = null;
  return sseSync;
}

function clearSSEReconnectTimer(scene) {
  const sseSync = getSSESyncState(scene);
  if (sseSync.reconnectTimer) {
    clearTimeout(sseSync.reconnectTimer);
    sseSync.reconnectTimer = null;
  }
  return sseSync;
}

function getClosedEventSourceState() {
  return (typeof EventSource === 'function' && typeof EventSource.CLOSED === 'number')
    ? EventSource.CLOSED
    : 2;
}

function isClosedEventSource(eventSource) {
  return !!eventSource && typeof eventSource.readyState === 'number' && eventSource.readyState === getClosedEventSourceState();
}

function closeOfficeEventStream(scene) {
  const sseSync = getSSESyncState(scene);
  clearSSEReconnectTimer(scene);

  if (sseSync.eventSource && sseSync.eventHandlers) {
    for (const [eventType, handler] of Object.entries(sseSync.eventHandlers)) {
      sseSync.eventSource.removeEventListener(eventType, handler);
    }
  }

  if (sseSync.eventSource && typeof sseSync.eventSource.close === 'function') {
    sseSync.eventSource.close();
  }

  clearSSEEventSource(scene);
  sseSync.mode = SSE_MODE.polling;
  sseSync.isHealthy = false;
  sseSync.usePollingFallback = true;
  sseSync.lastEventType = null;
  return sseSync;
}

function scheduleOfficeEventStreamReconnect(scene) {
  const sseSync = getSSESyncState(scene);
  if (sseSync.reconnectTimer) return sseSync.reconnectTimer;

  sseSync.reconnectTimer = setTimeout(() => {
    const nextSyncState = getSSESyncState(scene);
    nextSyncState.reconnectTimer = null;
    if (nextSyncState.eventSource) return;
    connectOfficeEventStream(scene);
  }, SSE_RECONNECT_DELAY);

  return sseSync.reconnectTimer;
}

function bindOfficeEventStreamLifecycle(scene) {
  const sseSync = getSSESyncState(scene);
  if (sseSync.lifecycleBound || !scene || !scene.events) return;

  const teardown = () => {
    closeOfficeEventStream(scene);
  };

  scene.events.once('shutdown', teardown);
  scene.events.once('destroy', teardown);
  sseSync.lifecycleBound = true;
}

function shouldUsePollingSync(scene) {
  const sseSync = getSSESyncState(scene);
  return !!sseSync.usePollingFallback;
}

function createOfficeEventSource() {
  if (typeof EventSource !== 'function') return null;
  return new EventSource('ui/events');
}

function registerOfficeEventStream(scene, eventSource) {
  if (!scene || !eventSource) return null;

  const sseSync = getSSESyncState(scene);
  clearSSEReconnectTimer(scene);
  sseSync.eventSource = eventSource;

  const handlers = {
    open: () => {
      setSSEHealthy(scene, eventSource);
    },
    error: () => {
      setSSEDegraded(scene, eventSource);

      if (isClosedEventSource(eventSource)) {
        closeOfficeEventStream(scene);
        scheduleOfficeEventStreamReconnect(scene);
      }
    },
    state: (event) => {
      const parsed = parseSSEEventPayload('state', event && event.data);
      if (!parsed) return;

      const nextSyncState = getSSESyncState(scene);
      nextSyncState.lastEventType = parsed.type;
      applySceneStateEvent(scene, parsed.payload.raw);
    }
  };

  for (const eventType of ['agent_join', 'agent_update', 'agent_leave', 'agent_offline']) {
    handlers[eventType] = (event) => {
      const parsed = parseSSEEventPayload(eventType, event && event.data);
      if (!parsed) return;

      const nextSyncState = getSSESyncState(scene);
      nextSyncState.lastEventType = parsed.type;
      applyOfficeAgentStreamEvent(parsed.type, parsed.payload);
    };
  }

  sseSync.eventHandlers = handlers;
  for (const [eventType, handler] of Object.entries(handlers)) {
    eventSource.addEventListener(eventType, handler);
  }

  return eventSource;
}

function connectOfficeEventStream(scene) {
  const sseSync = getSSESyncState(scene);
  bindOfficeEventStreamLifecycle(scene);
  if (sseSync.eventSource) return sseSync.eventSource;

  const eventSource = createOfficeEventSource();
  if (!eventSource) {
    setSSEDegraded(scene, null);
    return null;
  }

  return registerOfficeEventStream(scene, eventSource);
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function safeParseSSEJSON(rawData) {
  if (rawData === undefined || rawData === null || rawData === '') return null;
  if (isPlainObject(rawData)) return rawData;
  if (typeof rawData !== 'string') return null;

  try {
    const parsed = JSON.parse(rawData);
    return isPlainObject(parsed) ? parsed : null;
  } catch (error) {
    console.warn('忽略无法解析的 SSE payload:', error);
    return null;
  }
}

function normalizeSSEEventType(eventType) {
  if (typeof eventType !== 'string') return '';
  return eventType.trim().toLowerCase();
}

function parseSSEStatePayload(rawData) {
  const payload = safeParseSSEJSON(rawData);
  if (!payload || !isPlainObject(payload.agents)) return null;

  return {
    agents: payload.agents,
    raw: payload
  };
}

function normalizeBackendAgentPayload(rawAgent, options = {}) {
  if (!isPlainObject(rawAgent)) return null;

  const agentId = typeof rawAgent.agentId === 'string' ? rawAgent.agentId.trim() : '';
  if (!agentId) return null;

  const area = typeof rawAgent.area === 'string' ? rawAgent.area : 'breakroom';
  const alias = typeof rawAgent.alias === 'string' ? rawAgent.alias : '';
  const name = typeof options.getName === 'function'
    ? options.getName(rawAgent)
    : alias
      ? alias
      : typeof rawAgent.name === 'string'
      ? rawAgent.name
      : 'Agent';
  const authStatus = typeof options.getAuthStatus === 'function'
    ? options.getAuthStatus(rawAgent)
    : typeof rawAgent.authStatus === 'string'
      ? rawAgent.authStatus
      : typeof rawAgent.online === 'boolean'
        ? rawAgent.online ? 'approved' : 'offline'
      : 'pending';
  const updatedAt = typeof options.getUpdatedAt === 'function'
    ? options.getUpdatedAt(rawAgent)
    : rawAgent.updated_at;

  return {
    agentId,
    name: typeof name === 'string' && name ? name : 'Agent',
    isMain: !!rawAgent.isMain,
    state: normalizeState(rawAgent.state),
    detail: typeof rawAgent.detail === 'string' ? rawAgent.detail : '',
    area,
    authStatus: typeof authStatus === 'string' ? authStatus : 'pending',
    updated_at: updatedAt,
    raw: rawAgent
  };
}

function parseSSEAgentPayload(rawData) {
  const payload = safeParseSSEJSON(rawData);
  if (!payload) return null;

  // Audit note: incremental `agent_join` and `agent_update` SSE events
  // currently normalize here before reaching `applyOfficeAgentStreamEvent()`.
  return normalizeBackendAgentPayload(payload);
}

function parseSSEEventPayload(eventType, rawData) {
  const normalizedType = normalizeSSEEventType(eventType);
  let payload = null;

  if (normalizedType === 'state') {
    payload = parseSSEStatePayload(rawData);
  } else if (
    normalizedType === 'agent_join' ||
    normalizedType === 'agent_update' ||
    normalizedType === 'agent_leave' ||
    normalizedType === 'agent_offline'
  ) {
    payload = parseSSEAgentPayload(rawData);
  }

  if (!payload) return null;
  return { type: normalizedType, payload };
}

function getOfficeAgentsFromStateSnapshot(snapshotAgents) {
  if (!isPlainObject(snapshotAgents)) return [];

  const officeAgents = [];
  const areaSlots = { breakroom: 0, writing: 0, error: 0 };
  for (const agent of Object.values(snapshotAgents)) {
    const normalizedAgent = normalizeBackendAgentPayload(agent, {
      getUpdatedAt: (snapshotAgent) => typeof snapshotAgent.lastSeenAt === 'number'
        ? new Date(snapshotAgent.lastSeenAt).toISOString()
        : undefined
    });
    if (!normalizedAgent) {
      continue;
    }

    const area = normalizedAgent.area;
    const slotIndex = areaSlots[area] || 0;
    areaSlots[area] = slotIndex + 1;

    // Audit note: initial state snapshots normalize office-agent payloads here
    // before `reconcileOfficeAgentsFromPayload()` applies them to the scene.
    officeAgents.push({
      ...normalizedAgent,
      isMain: false,
      _slotIndex: slotIndex
    });
  }

  return officeAgents;
}

function getMainAgentPayloadFromStateSnapshot(snapshotAgents) {
  if (!isPlainObject(snapshotAgents)) return null;

  const availableAgents = Object.values(snapshotAgents).filter(isPlainObject);
  if (availableAgents.length === 0) return null;

  // Audit note: this helper is the current state-snapshot main-agent selector.
  const mainAgent = availableAgents.find(agent => agent.isMain === true);
  if (!mainAgent) return null;

  return {
    state: normalizeState(mainAgent.state),
    detail: typeof mainAgent.detail === 'string' ? mainAgent.detail : '...'
  };
}

function getIdleMainAgentPayload() {
  return {
    state: 'idle',
    detail: 'Waiting...'
  };
}

function getStoredOfficeAgentMeta(agentId) {
  const container = agents[agentId];
  if (!container || !container.officeAgentMeta || !isPlainObject(container.officeAgentMeta)) {
    return null;
  }
  return container.officeAgentMeta;
}

function getNextOfficeAgentSlotIndex(area, excludeAgentId) {
  const usedSlots = new Set();
  for (const agentId in agents) {
    if (agentId === excludeAgentId) continue;
    const meta = getStoredOfficeAgentMeta(agentId);
    if (!meta || meta.area !== area || typeof meta.slotIndex !== 'number') continue;
    usedSlots.add(meta.slotIndex);
  }

  let slotIndex = 0;
  while (usedSlots.has(slotIndex)) {
    slotIndex += 1;
  }
  return slotIndex;
}

function assignOfficeAgentSlot(agent) {
  if (!agent || !agent.agentId) return agent;

  const area = typeof agent.area === 'string' ? agent.area : 'breakroom';
  const existingMeta = getStoredOfficeAgentMeta(agent.agentId);
  const slotIndex = typeof agent._slotIndex === 'number'
    ? agent._slotIndex
    : existingMeta && existingMeta.area === area
      ? existingMeta.slotIndex
      : getNextOfficeAgentSlotIndex(area, agent.agentId);

  return {
    ...agent,
    area,
    _slotIndex: slotIndex
  };
}

function applyOfficeAgentStreamEvent(eventType, payload) {
  if (!payload || !payload.agentId) return;

  if (eventType === 'agent_leave') {
    removeOfficeAgent(payload.agentId);
    return;
  }

  if (eventType === 'agent_offline') {
    if (!agents[payload.agentId]) return;
    markOfficeAgentOffline(assignOfficeAgentSlot(payload));
    return;
  }

  if (eventType === 'agent_join' || eventType === 'agent_update') {
    applyOfficeAgentPayload(assignOfficeAgentSlot(payload));
  }
}

function reconcileOfficeAgentsFromPayload(agentPayloads) {
  if (!Array.isArray(agentPayloads)) return;

  for (const agent of agentPayloads) {
    applyOfficeAgentPayload(agent);
  }

  const currentIds = new Set(agentPayloads.map(agent => agent.agentId));
  for (const id in agents) {
    if (!currentIds.has(id)) {
      removeOfficeAgent(id);
    }
  }
}

function applySceneStateEvent(scene, statePayload) {
  if (!scene || !statePayload || !isPlainObject(statePayload.agents)) return;

  const mainAgentPayload = getMainAgentPayloadFromStateSnapshot(statePayload.agents) || getIdleMainAgentPayload();
  applyMainAgentPayload(mainAgentPayload);

  reconcileOfficeAgentsFromPayload(getOfficeAgentsFromStateSnapshot(statePayload.agents));
}


// 状态控制栏函数（用于测试）
function setState(state, detail) {
  fetch('set_state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, detail })
  }).then(() => fetchStatus());
}

// 初始化：先检测 WebP 支持，再启动游戏
async function initGame() {
  try {
    supportsWebP = await checkWebPSupport();
  } catch (e) {
    try {
      supportsWebP = await checkWebPSupportFallback();
    } catch (e2) {
      supportsWebP = false;
    }
  }

  console.log('WebP 支持:', supportsWebP);
  new Phaser.Game(config);
}

function preload() {
  loadingOverlay = document.getElementById('loading-overlay');
  loadingProgressBar = document.getElementById('loading-progress-bar');
  loadingText = document.getElementById('loading-text');
  loadingProgressContainer = document.getElementById('loading-progress-container');

  // 从 LAYOUT 读取总资源数量（避免 magic number）
  totalAssets = LAYOUT.totalAssets || 15;
  loadedAssets = 0;

  this.load.on('filecomplete', () => {
    updateLoadingProgress();
  });

  this.load.on('complete', () => {
    hideLoadingOverlay();
  });

  this.load.image('office_bg', 'office_bg_small' + (supportsWebP ? '.webp' : '.png') + '?v=');
  this.load.spritesheet('star_idle', 'star-idle-v5.png', { frameWidth: 256, frameHeight: 256 });

  this.load.image('sofa_idle', 'sofa-idle-v3.png');
  this.load.image('sofa_shadow', 'sofa-shadow-v1.png');

  this.load.spritesheet('plants', 'plants-spritesheet' + getExt('plants-spritesheet.png'), { frameWidth: 160, frameHeight: 160 });
  this.load.spritesheet('posters', 'posters-spritesheet' + getExt('posters-spritesheet.png'), { frameWidth: 160, frameHeight: 160 });
  this.load.spritesheet('coffee_machine', 'coffee-machine-v3-grid.webp', { frameWidth: 230, frameHeight: 230 });
  this.load.image('coffee_machine_shadow', 'coffee-machine-shadow-v1.png');
  this.load.spritesheet('serverroom', 'serverroom-spritesheet' + getExt('serverroom-spritesheet.png'), { frameWidth: 180, frameHeight: 251 });

  this.load.spritesheet('error_bug', 'error-bug-spritesheet-grid' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 220, frameHeight: 220 });
  this.load.spritesheet('cats', 'cats-spritesheet' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 160, frameHeight: 160 });
  this.load.image('desk', 'desk-v3' + getExt('desk-v3.png'));
  this.load.spritesheet('star_working', 'star-working-spritesheet-grid' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 230, frameHeight: 144 });
  this.load.spritesheet('sync_anim', 'sync-animation-v3-grid' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 256, frameHeight: 256 });
  this.load.image('memo_bg', 'memo-bg' + (supportsWebP ? '.webp' : '.png'));

  this.load.spritesheet('flowers', 'flowers-bloom-v2' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 65, frameHeight: 65 });
}

function create() {
  game = this;
  getSSESyncState(this);
  connectOfficeEventStream(this);
  this.add.image(640, 360, 'office_bg');

  // === 沙发（来自 LAYOUT）===
  sofa = this.add.sprite(
    LAYOUT.furniture.sofa.x,
    LAYOUT.furniture.sofa.y,
    'sofa_busy'
  ).setOrigin(LAYOUT.furniture.sofa.origin.x, LAYOUT.furniture.sofa.origin.y);
  sofa.setDepth(LAYOUT.furniture.sofa.depth);

  this.anims.create({
    key: 'sofa_busy',
    frames: this.anims.generateFrameNumbers('sofa_busy', { start: 0, end: 47 }),
    frameRate: 12,
    repeat: -1
  });

  areas = LAYOUT.areas;

  var starIdleFrameMax = Math.max(0, (this.textures.get('star_idle')?.frameTotal || 1) - 2);
  this.anims.create({
    key: 'star_idle',
    frames: this.anims.generateFrameNumbers('star_idle', { start: 0, end: starIdleFrameMax }),
    frameRate: 12,
    repeat: -1
  });

  star = game.physics.add.sprite(areas.breakroom.x, areas.breakroom.y, 'star_idle');
  star.setOrigin(0.5);
  star.setScale(1.4);
  star.setAlpha(0.95);
  star.setDepth(20);
  star.setVisible(false);
  star.anims.stop();

  if (game.textures.exists('sofa_busy')) {
    sofa.setTexture('sofa_busy');
    sofa.anims.play('sofa_busy', true);
  }

  // === 牌匾（来自 LAYOUT）===
  const plaqueX = LAYOUT.plaque.x;
  const plaqueY = LAYOUT.plaque.y;
  const plaqueBg = game.add.rectangle(plaqueX, plaqueY, LAYOUT.plaque.width, LAYOUT.plaque.height, 0x5d4037);
  plaqueBg.setStrokeStyle(3, 0x3e2723);
  const plaqueText = game.add.text(plaqueX, plaqueY, '海辛小龙虾的办公室', {
    fontFamily: 'ArkPixel, monospace',
    fontSize: '18px',
    fill: '#ffd700',
    fontWeight: 'bold',
    stroke: '#000',
    strokeThickness: 2
  }).setOrigin(0.5);
  game.add.text(plaqueX - 190, plaqueY, '⭐', { fontFamily: 'ArkPixel, monospace', fontSize: '20px' }).setOrigin(0.5);
  game.add.text(plaqueX + 190, plaqueY, '⭐', { fontFamily: 'ArkPixel, monospace', fontSize: '20px' }).setOrigin(0.5);

  // === 植物们（来自 LAYOUT）===
  const plantFrameCount = 16;
  for (let i = 0; i < LAYOUT.furniture.plants.length; i++) {
    const p = LAYOUT.furniture.plants[i];
    const randomPlantFrame = Math.floor(Math.random() * plantFrameCount);
    const plant = game.add.sprite(p.x, p.y, 'plants', randomPlantFrame).setOrigin(0.5);
    plant.setDepth(p.depth);
    plant.setInteractive({ useHandCursor: true });
    window[`plantSprite${i === 0 ? '' : i + 1}`] = plant;
    plant.on('pointerdown', (() => {
      const next = Math.floor(Math.random() * plantFrameCount);
      plant.setFrame(next);
    }));
  }

  // === 海报（来自 LAYOUT）===
  const postersFrameCount = 32;
  const randomPosterFrame = Math.floor(Math.random() * postersFrameCount);
  const poster = game.add.sprite(LAYOUT.furniture.poster.x, LAYOUT.furniture.poster.y, 'posters', randomPosterFrame).setOrigin(0.5);
  poster.setDepth(LAYOUT.furniture.poster.depth);
  poster.setInteractive({ useHandCursor: true });
  window.posterSprite = poster;
  window.posterFrameCount = postersFrameCount;
  poster.on('pointerdown', () => {
    const next = Math.floor(Math.random() * window.posterFrameCount);
    window.posterSprite.setFrame(next);
  });

  // === 小猫（来自 LAYOUT）===
  const catsFrameCount = 16;
  const randomCatFrame = Math.floor(Math.random() * catsFrameCount);
  const cat = game.add.sprite(LAYOUT.furniture.cat.x, LAYOUT.furniture.cat.y, 'cats', randomCatFrame).setOrigin(LAYOUT.furniture.cat.origin.x, LAYOUT.furniture.cat.origin.y);
  cat.setDepth(LAYOUT.furniture.cat.depth);
  cat.setInteractive({ useHandCursor: true });
  window.catSprite = cat;
  window.catsFrameCount = catsFrameCount;
  cat.on('pointerdown', () => {
    const next = Math.floor(Math.random() * window.catsFrameCount);
    window.catSprite.setFrame(next);
  });

  // === 咖啡机（来自 LAYOUT）===
  var coffeeFrameMax = Math.max(0, (this.textures.get('coffee_machine')?.frameTotal || 1) - 2);
  this.anims.create({
    key: 'coffee_machine',
    frames: this.anims.generateFrameNumbers('coffee_machine', { start: 0, end: coffeeFrameMax }),
    frameRate: 12.5,
    repeat: -1
  });
  const coffeeMachine = this.add.sprite(
    LAYOUT.furniture.coffeeMachine.x,
    LAYOUT.furniture.coffeeMachine.y,
    'coffee_machine'
  ).setOrigin(LAYOUT.furniture.coffeeMachine.origin.x, LAYOUT.furniture.coffeeMachine.origin.y);
  coffeeMachine.setDepth(LAYOUT.furniture.coffeeMachine.depth);
  coffeeMachine.anims.play('coffee_machine', true);

  // === 服务器区（来自 LAYOUT）===
  this.anims.create({
    key: 'serverroom_on',
    frames: this.anims.generateFrameNumbers('serverroom', { start: 0, end: 39 }),
    frameRate: 6,
    repeat: -1
  });
  serverroom = this.add.sprite(
    LAYOUT.furniture.serverroom.x,
    LAYOUT.furniture.serverroom.y,
    'serverroom',
    0
  ).setOrigin(LAYOUT.furniture.serverroom.origin.x, LAYOUT.furniture.serverroom.origin.y);
  serverroom.setDepth(LAYOUT.furniture.serverroom.depth);
  serverroom.anims.stop();
  serverroom.setFrame(0);

  // === 新办公桌（来自 LAYOUT，强制透明 PNG）===
  const desk = this.add.image(
    LAYOUT.furniture.desk.x,
    LAYOUT.furniture.desk.y,
    'desk_v2'
  ).setOrigin(LAYOUT.furniture.desk.origin.x, LAYOUT.furniture.desk.origin.y);
  desk.setDepth(LAYOUT.furniture.desk.depth);

  // === 花盆（来自 LAYOUT）===
  const flowerFrameCount = 16;
  const randomFlowerFrame = Math.floor(Math.random() * flowerFrameCount);
  const flower = this.add.sprite(
    LAYOUT.furniture.flower.x,
    LAYOUT.furniture.flower.y,
    'flowers',
    randomFlowerFrame
  ).setOrigin(LAYOUT.furniture.flower.origin.x, LAYOUT.furniture.flower.origin.y);
  flower.setScale(LAYOUT.furniture.flower.scale || 1);
  flower.setDepth(LAYOUT.furniture.flower.depth);
  flower.setInteractive({ useHandCursor: true });
  window.flowerSprite = flower;
  window.flowerFrameCount = flowerFrameCount;
  flower.on('pointerdown', () => {
    const next = Math.floor(Math.random() * window.flowerFrameCount);
    window.flowerSprite.setFrame(next);
  });

  // === Star 在桌前工作（来自 LAYOUT）===
  this.anims.create({
    key: 'star_working',
    frames: this.anims.generateFrameNumbers('star_working', { start: 0, end: 191 }),
    frameRate: 12,
    repeat: -1
  });
  this.anims.create({
    key: 'error_bug',
    frames: this.anims.generateFrameNumbers('error_bug', { start: 0, end: 95 }),
    frameRate: 12,
    repeat: -1
  });

  // === 错误 bug（来自 LAYOUT）===
  const errorBug = this.add.sprite(
    LAYOUT.furniture.errorBug.x,
    LAYOUT.furniture.errorBug.y,
    'error_bug',
    0
  ).setOrigin(LAYOUT.furniture.errorBug.origin.x, LAYOUT.furniture.errorBug.origin.y);
  errorBug.setDepth(LAYOUT.furniture.errorBug.depth);
  errorBug.setVisible(false);
  errorBug.setScale(LAYOUT.furniture.errorBug.scale);
  errorBug.anims.play('error_bug', true);
  window.errorBug = errorBug;
  window.errorBugDir = 1;

  const starWorking = this.add.sprite(
    LAYOUT.furniture.starWorking.x,
    LAYOUT.furniture.starWorking.y,
    'star_working',
    0
  ).setOrigin(LAYOUT.furniture.starWorking.origin.x, LAYOUT.furniture.starWorking.origin.y);
  starWorking.setVisible(false);
  starWorking.setScale(LAYOUT.furniture.starWorking.scale);
  starWorking.setDepth(LAYOUT.furniture.starWorking.depth);
  window.starWorking = starWorking;

  // === 同步动画（来自 LAYOUT）===
  this.anims.create({
    key: 'sync_anim',
    frames: this.anims.generateFrameNumbers('sync_anim', { start: 1, end: 52 }),
    frameRate: 12,
    repeat: -1
  });
  syncAnimSprite = this.add.sprite(
    LAYOUT.furniture.syncAnim.x,
    LAYOUT.furniture.syncAnim.y,
    'sync_anim',
    0
  ).setOrigin(LAYOUT.furniture.syncAnim.origin.x, LAYOUT.furniture.syncAnim.origin.y);
  syncAnimSprite.setDepth(LAYOUT.furniture.syncAnim.depth);
  syncAnimSprite.anims.stop();
  syncAnimSprite.setFrame(0);

  window.starSprite = star;

  statusText = document.getElementById('status-text');
  coordsOverlay = document.getElementById('coords-overlay');
  coordsDisplay = document.getElementById('coords-display');
  coordsToggle = document.getElementById('coords-toggle');

  coordsToggle.addEventListener('click', () => {
    showCoords = !showCoords;
    coordsOverlay.style.display = showCoords ? 'block' : 'none';
    coordsToggle.textContent = showCoords ? '隐藏坐标' : '显示坐标';
    coordsToggle.style.background = showCoords ? '#e94560' : '#333';
  });

  game.input.on('pointermove', (pointer) => {
    if (!showCoords) return;
    const x = Math.max(0, Math.min(config.width - 1, Math.round(pointer.x)));
    const y = Math.max(0, Math.min(config.height - 1, Math.round(pointer.y)));
    coordsDisplay.textContent = `${x}, ${y}`;
    coordsOverlay.style.left = (pointer.x + 18) + 'px';
    coordsOverlay.style.top = (pointer.y + 18) + 'px';
  });

  loadMemo();
  // Sync inventory for the SSE refactor:
  // - `fetchStatus()` is called once here for scene bootstrap.
  // - `fetchAgents()` is called once here for scene bootstrap.
  // - The repeating polling callers live in `update()` below.
  // - `setState()` also triggers a one-shot `fetchStatus()` after the compat POST completes.
  fetchStatus();
  fetchAgents();

  // 可选调试：仅在显式开启 debug 模式时渲染测试用尼卡 agent
  let debugAgents = false;
  try {
    if (typeof window !== 'undefined') {
      if (window.STAR_OFFICE_DEBUG_AGENTS === true) {
        debugAgents = true;
      } else if (window.location && window.location.search && typeof URLSearchParams !== 'undefined') {
        const sp = new URLSearchParams(window.location.search);
        if (sp.get('debugAgents') === '1') {
          debugAgents = true;
        }
      }
    }
  } catch (e) {
    debugAgents = false;
  }

  if (debugAgents) {
    const testNika = {
      agentId: 'agent_nika',
      name: '尼卡',
      isMain: false,
      state: 'writing',
      detail: '在画像素画...',
      area: 'writing',
      authStatus: 'approved',
      updated_at: new Date().toISOString()
    };
    applyOfficeAgentPayload(testNika);

    window.testNikaState = 'writing';
    window.testNikaTimer = setInterval(() => {
      const states = ['idle', 'writing', 'researching', 'executing'];
      const areas = { idle: 'breakroom', writing: 'writing', researching: 'writing', executing: 'writing' };
      window.testNikaState = states[Math.floor(Math.random() * states.length)];
      const testAgent = {
        agentId: 'agent_nika',
        name: '尼卡',
        isMain: false,
        state: window.testNikaState,
        detail: '在画像素画...',
        area: areas[window.testNikaState],
        authStatus: 'approved',
        updated_at: new Date().toISOString()
      };
      applyOfficeAgentPayload(testAgent);
    }, 5000);
  }
}

function update(time) {
  // Polling ownership boundary:
  // - `fetchStatus()` is the only polling path that mutates the main Star status/detail UI.
  // - `fetchAgents()` is the only polling path that reconciles remote office-agent sprites.
  // - Healthy `/ui/events` pushes should suppress these recurring fetches; degraded SSE flips
  //   `usePollingFallback` back on so both polling paths resume from this single gate.
  const shouldPollSync = shouldUsePollingSync(game);
  if (shouldPollSync && time - lastFetch > FETCH_INTERVAL) { fetchStatus(); lastFetch = time; }
  if (shouldPollSync && time - lastAgentsFetch > AGENTS_FETCH_INTERVAL) { fetchAgents(); lastAgentsFetch = time; }

  const effectiveStateForServer = pendingDesiredState || currentState;
  if (serverroom) {
    if (effectiveStateForServer === 'idle') {
      if (serverroom.anims.isPlaying) {
        serverroom.anims.stop();
        serverroom.setFrame(0);
      }
    } else {
      if (!serverroom.anims.isPlaying || serverroom.anims.currentAnim?.key !== 'serverroom_on') {
        serverroom.anims.play('serverroom_on', true);
      }
    }
  }

  if (window.errorBug) {
    if (effectiveStateForServer === 'error') {
      window.errorBug.setVisible(true);
      if (!window.errorBug.anims.isPlaying || window.errorBug.anims.currentAnim?.key !== 'error_bug') {
        window.errorBug.anims.play('error_bug', true);
      }
      const leftX = LAYOUT.furniture.errorBug.pingPong.leftX;
      const rightX = LAYOUT.furniture.errorBug.pingPong.rightX;
      const speed = LAYOUT.furniture.errorBug.pingPong.speed;
      const dir = window.errorBugDir || 1;
      window.errorBug.x += speed * dir;
      window.errorBug.y = LAYOUT.furniture.errorBug.y;
      if (window.errorBug.x >= rightX) {
        window.errorBug.x = rightX;
        window.errorBugDir = -1;
      } else if (window.errorBug.x <= leftX) {
        window.errorBug.x = leftX;
        window.errorBugDir = 1;
      }
    } else {
      window.errorBug.setVisible(false);
      window.errorBug.anims.stop();
    }
  }

  if (syncAnimSprite) {
    if (effectiveStateForServer === 'syncing') {
      if (!syncAnimSprite.anims.isPlaying || syncAnimSprite.anims.currentAnim?.key !== 'sync_anim') {
        syncAnimSprite.anims.play('sync_anim', true);
      }
    } else {
      if (syncAnimSprite.anims.isPlaying) syncAnimSprite.anims.stop();
      syncAnimSprite.setFrame(0);
    }
  }

  if (time - lastBubble > BUBBLE_INTERVAL) {
    showBubble();
    lastBubble = time;
  }
  if (time - lastCatBubble > CAT_BUBBLE_INTERVAL) {
    showCatBubble();
    lastCatBubble = time;
  }

  if (typewriterIndex < typewriterTarget.length && time - lastTypewriter > TYPEWRITER_DELAY) {
    typewriterText += typewriterTarget[typewriterIndex];
    statusText.textContent = typewriterText;
    typewriterIndex++;
    lastTypewriter = time;
  }

  moveStar(time);
}

function normalizeState(s) {
  if (!s) return 'idle';
  if (s === 'working') return 'writing';
  if (s === 'run' || s === 'running') return 'executing';
  if (s === 'sync') return 'syncing';
  if (s === 'research') return 'researching';
  return s;
}

function applyMainAgentPayload(payload) {
  const nextState = normalizeState(payload && payload.state);
  const stateInfo = STATES[nextState] || STATES.idle;
  const nextLine = '[' + stateInfo.name + '] ' + ((payload && payload.detail) || '...');
  const changed = (pendingDesiredState === null) && (nextState !== currentState);

  if (changed) {
    typewriterTarget = nextLine;
    typewriterText = '';
    typewriterIndex = 0;

    pendingDesiredState = null;
    currentState = nextState;

    if (nextState === 'idle') {
      if (game.textures.exists('sofa_busy')) {
        sofa.setTexture('sofa_busy');
        sofa.anims.play('sofa_busy', true);
      }
      star.setVisible(false);
      star.anims.stop();
      if (window.starWorking) {
        window.starWorking.setVisible(false);
        window.starWorking.anims.stop();
      }
    } else if (nextState === 'error') {
      sofa.anims.stop();
      sofa.setTexture('sofa_idle');
      star.setVisible(false);
      star.anims.stop();
      if (window.starWorking) {
        window.starWorking.setVisible(false);
        window.starWorking.anims.stop();
      }
    } else if (nextState === 'syncing') {
      sofa.anims.stop();
      sofa.setTexture('sofa_idle');
      star.setVisible(false);
      star.anims.stop();
      if (window.starWorking) {
        window.starWorking.setVisible(false);
        window.starWorking.anims.stop();
      }
    } else {
      sofa.anims.stop();
      sofa.setTexture('sofa_idle');
      star.setVisible(false);
      star.anims.stop();
      if (window.starWorking) {
        window.starWorking.setVisible(true);
        window.starWorking.anims.play('star_working', true);
      }
    }

    if (serverroom) {
      if (nextState === 'idle') {
        serverroom.anims.stop();
        serverroom.setFrame(0);
      } else {
        serverroom.anims.play('serverroom_on', true);
      }
    }

    if (syncAnimSprite) {
      if (nextState === 'syncing') {
        if (!syncAnimSprite.anims.isPlaying || syncAnimSprite.anims.currentAnim?.key !== 'sync_anim') {
          syncAnimSprite.anims.play('sync_anim', true);
        }
      } else {
        if (syncAnimSprite.anims.isPlaying) syncAnimSprite.anims.stop();
        syncAnimSprite.setFrame(0);
      }
    }
  } else if (!typewriterTarget || typewriterTarget !== nextLine) {
    typewriterTarget = nextLine;
    typewriterText = '';
    typewriterIndex = 0;
  }
}

function fetchStatus() {
  // Main-agent ownership:
  // - Handles the `/status` fetch path for the main Star agent only.
  // - Owns state normalization, status text/detail updates, and main-scene animation toggles.
  // - Current callers: scene bootstrap in `create()`, update-loop polling in `update()`,
  //   and the one-shot compat refresh in `setState()`.
  // - `applyMainAgentPayload()` is the shared plain-data path that SSE state bootstrap can reuse
  //   without depending on fetch response objects.
  fetch('status')
    .then(response => response.json())
    .then(data => applyMainAgentPayload(data))
    .catch(error => {
      typewriterTarget = '连接失败，正在重试...';
      typewriterText = '';
      typewriterIndex = 0;
    });
}

function moveStar(time) {
  const effectiveState = pendingDesiredState || currentState;
  const stateInfo = STATES[effectiveState] || STATES.idle;
  const baseTarget = areas[stateInfo.area] || areas.breakroom;

  const dx = targetX - star.x;
  const dy = targetY - star.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const speed = 1.4;
  const wobble = Math.sin(time / 200) * 0.8;

  if (dist > 3) {
    star.x += (dx / dist) * speed;
    star.y += (dy / dist) * speed;
    star.setY(star.y + wobble);
    isMoving = true;
  } else {
    if (waypoints && waypoints.length > 0) {
      waypoints.shift();
      if (waypoints.length > 0) {
        targetX = waypoints[0].x;
        targetY = waypoints[0].y;
        isMoving = true;
      } else {
        if (pendingDesiredState !== null) {
          isMoving = false;
          currentState = pendingDesiredState;
          pendingDesiredState = null;

          if (currentState === 'idle') {
            star.setVisible(false);
            star.anims.stop();
            if (window.starWorking) {
              window.starWorking.setVisible(false);
              window.starWorking.anims.stop();
            }
          } else {
            star.setVisible(false);
            star.anims.stop();
            if (window.starWorking) {
              window.starWorking.setVisible(true);
              window.starWorking.anims.play('star_working', true);
            }
          }
        }
      }
    } else {
      if (pendingDesiredState !== null) {
        isMoving = false;
        currentState = pendingDesiredState;
        pendingDesiredState = null;

        if (currentState === 'idle') {
          star.setVisible(false);
          star.anims.stop();
          if (window.starWorking) {
            window.starWorking.setVisible(false);
            window.starWorking.anims.stop();
          }
          if (game.textures.exists('sofa_busy')) {
            sofa.setTexture('sofa_busy');
            sofa.anims.play('sofa_busy', true);
          }
        } else {
          star.setVisible(false);
          star.anims.stop();
          if (window.starWorking) {
            window.starWorking.setVisible(true);
            window.starWorking.anims.play('star_working', true);
          }
          sofa.anims.stop();
          sofa.setTexture('sofa_idle');
        }
      }
    }
  }
}

function showBubble() {
  if (bubble) { bubble.destroy(); bubble = null; }
  const texts = BUBBLE_TEXTS[currentState] || BUBBLE_TEXTS.idle;
  if (currentState === 'idle') return;

  let anchorX = star.x;
  let anchorY = star.y;
  if (currentState === 'syncing' && syncAnimSprite && syncAnimSprite.visible) {
    anchorX = syncAnimSprite.x;
    anchorY = syncAnimSprite.y;
  } else if (currentState === 'error' && window.errorBug && window.errorBug.visible) {
    anchorX = window.errorBug.x;
    anchorY = window.errorBug.y;
  } else if (!star.visible && window.starWorking && window.starWorking.visible) {
    anchorX = window.starWorking.x;
    anchorY = window.starWorking.y;
  }

  const text = texts[Math.floor(Math.random() * texts.length)];
  const bubbleY = anchorY - 70;
  const bg = game.add.rectangle(anchorX, bubbleY, text.length * 10 + 20, 28, 0xffffff, 0.95);
  bg.setStrokeStyle(2, 0x000000);
  const txt = game.add.text(anchorX, bubbleY, text, { fontFamily: 'ArkPixel, monospace', fontSize: '12px', fill: '#000', align: 'center' }).setOrigin(0.5);
  bubble = game.add.container(0, 0, [bg, txt]);
  bubble.setDepth(1200);
  setTimeout(() => { if (bubble) { bubble.destroy(); bubble = null; } }, 3000);
}

function showCatBubble() {
  if (!window.catSprite) return;
  if (window.catBubble) { window.catBubble.destroy(); window.catBubble = null; }
  const texts = BUBBLE_TEXTS.cat || ['喵~', '咕噜咕噜…'];
  const text = texts[Math.floor(Math.random() * texts.length)];
  const anchorX = window.catSprite.x;
  const anchorY = window.catSprite.y - 60;
  const bg = game.add.rectangle(anchorX, anchorY, text.length * 10 + 20, 24, 0xfffbeb, 0.95);
  bg.setStrokeStyle(2, 0xd4a574);
  const txt = game.add.text(anchorX, anchorY, text, { fontFamily: 'ArkPixel, monospace', fontSize: '11px', fill: '#8b6914', align: 'center' }).setOrigin(0.5);
  window.catBubble = game.add.container(0, 0, [bg, txt]);
  window.catBubble.setDepth(2100);
  setTimeout(() => { if (window.catBubble) { window.catBubble.destroy(); window.catBubble = null; } }, 4000);
}

function fetchAgents() {
  // Office-agent ownership:
  // - Handles the `/agents` fetch path for non-main office occupants rendered via the shared
  //   office-agent lifecycle helpers below.
  // - Owns slot assignment, remote-agent create/update reconciliation, and removal of missing agents.
  // - Current callers: scene bootstrap in `create()` and update-loop polling in `update()`.
  // - When SSE lands, stream handlers should reuse this lifecycle boundary while fallback re-enables
  //   this fetch path only after the stream is unhealthy.
  fetch('agents?t=' + Date.now(), { cache: 'no-store' })
    .then(response => response.json())
    .then(data => {
      if (!Array.isArray(data)) return;
      const normalizedAgents = data
        .map(agent => normalizeBackendAgentPayload(agent))
        .filter(Boolean);
      // 重置位置计数器
      // 按区域分配不同位置索引，避免重叠
      const areaSlots = { breakroom: 0, writing: 0, error: 0 };
      for (const agent of normalizedAgents) {
        const area = agent.area || 'breakroom';
        agent._slotIndex = areaSlots[area] || 0;
        areaSlots[area] = (areaSlots[area] || 0) + 1;
      }
      reconcileOfficeAgentsFromPayload(normalizedAgents);
    })
    .catch(error => {
      console.error('拉取 agents 失败:', error);
    });
}

function getAreaPosition(area, slotIndex) {
  const positions = AREA_POSITIONS[area] || AREA_POSITIONS.breakroom;
  const idx = (slotIndex || 0) % positions.length;
  return positions[idx];
}

function getOfficeAgentAlpha(authStatus) {
  if (authStatus === 'pending') return 0.7;
  if (authStatus === 'rejected') return 0.4;
  if (authStatus === 'offline') return 0.5;
  return 1;
}

function getOfficeAgentDotColor(authStatus) {
  if (authStatus === 'approved') return 0x22c55e;
  if (authStatus === 'pending') return 0xf59e0b;
  if (authStatus === 'rejected') return 0xef4444;
  if (authStatus === 'offline') return 0x94a3b8;
  return 0x64748b;
}

function createOfficeAgent(agent) {
  const agentId = agent.agentId;
  const name = agent.name || 'Agent';
  const authStatus = agent.authStatus || 'pending';
  const isMain = !!agent.isMain;
  const pos = getAreaPosition(agent.area || 'breakroom', agent._slotIndex || 0);
  const alpha = getOfficeAgentAlpha(authStatus);
  const nameColor = NAME_TAG_COLORS[authStatus] || NAME_TAG_COLORS.default;
  const dotColor = getOfficeAgentDotColor(authStatus);

  const container = game.add.container(pos.x, pos.y);
  container.setDepth(1200 + (isMain ? 100 : 0));
  container.setAlpha(alpha);

  const starIcon = game.add.text(0, 0, '⭐', {
    fontFamily: 'ArkPixel, monospace',
    fontSize: '32px'
  }).setOrigin(0.5);
  starIcon.name = 'starIcon';
  starIcon.setTint(AGENT_COLORS[agentId] || AGENT_COLORS.default);

  const nameTag = game.add.text(0, -36, name, {
    fontFamily: 'ArkPixel, monospace',
    fontSize: '14px',
    fill: '#' + nameColor.toString(16).padStart(6, '0'),
    stroke: '#000',
    strokeThickness: 3,
    backgroundColor: 'rgba(255,255,255,0.95)'
  }).setOrigin(0.5);
  nameTag.name = 'nameTag';

  const statusDot = game.add.circle(20, -20, 5, dotColor, alpha);
  statusDot.setStrokeStyle(2, 0x000000, alpha);
  statusDot.name = 'statusDot';

  container.add([starIcon, statusDot, nameTag]);
  container.officeAgentMeta = {
    area: agent.area || 'breakroom',
    slotIndex: agent._slotIndex || 0
  };
  agents[agentId] = container;
  return container;
}

function updateOfficeAgent(agent) {
  const agentId = agent.agentId;
  const container = agents[agentId];
  if (!container) return createOfficeAgent(agent);

  const authStatus = agent.authStatus || 'pending';
  const isMain = !!agent.isMain;
  const pos = getAreaPosition(agent.area || 'breakroom', agent._slotIndex || 0);
  const alpha = getOfficeAgentAlpha(authStatus);
  const dotColor = getOfficeAgentDotColor(authStatus);

  container.setPosition(pos.x, pos.y);
  container.setAlpha(alpha);
  container.setDepth(1200 + (isMain ? 100 : 0));
  container.officeAgentMeta = {
    area: agent.area || 'breakroom',
    slotIndex: agent._slotIndex || 0
  };

  const starIcon = container.getAt(0);
  if (starIcon && starIcon.name === 'starIcon') {
    starIcon.setTint(AGENT_COLORS[agentId] || AGENT_COLORS.default);
  }

  const nameTag = container.getAt(2);
  if (nameTag && nameTag.name === 'nameTag') {
    nameTag.setText(agent.name || 'Agent');
    nameTag.setFill('#' + (NAME_TAG_COLORS[authStatus] || NAME_TAG_COLORS.default).toString(16).padStart(6, '0'));
  }

  const statusDot = container.getAt(1);
  if (statusDot && statusDot.name === 'statusDot') {
    statusDot.fillColor = dotColor;
    statusDot.setFillStyle(dotColor, alpha);
    statusDot.setStrokeStyle(2, 0x000000, alpha);
  }

  return container;
}

function removeOfficeAgent(agentId) {
  if (!agents[agentId]) return;
  agents[agentId].destroy();
  delete agents[agentId];
}

function markOfficeAgentOffline(agent) {
  if (!agent || !agent.agentId) return;
  updateOfficeAgent({ ...agent, authStatus: 'offline' });
}

function applyOfficeAgentPayload(agent) {
  if (!agent || !agent.agentId) return;
  if ((agent.authStatus || 'pending') === 'offline') {
    markOfficeAgentOffline(agent);
    return;
  }
  if (!agents[agent.agentId]) {
    createOfficeAgent(agent);
    return;
  }
  updateOfficeAgent(agent);
}

// 启动游戏
initGame();
