import { CacheSimulator, validateConfig } from './cache.js';
import { getTestCase } from './testCases.js';

const els = {
  blockSize: document.getElementById('blockSize'),
  numCacheBlocks: document.getElementById('numCacheBlocks'),
  readPolicy: document.getElementById('readPolicy'),
  viewMode: document.getElementById('viewMode'),
  animSpeed: document.getElementById('animSpeed'),
  animSpeedLabel: document.getElementById('animSpeedLabel'),
  configSummary: document.getElementById('configSummary'),
  testDescription: document.getElementById('testDescription'),
  runBothBtn: document.getElementById('runBothBtn'),
  resetBtn: document.getElementById('resetBtn'),
  stepBtn: document.getElementById('stepBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  summaryPanel: document.getElementById('summaryPanel'),
  comparisonTable: document.getElementById('comparisonTable'),
  lru: {
    status: document.getElementById('lruStatus'),
    visual: document.getElementById('lruCacheVisual'),
    stats: document.getElementById('lruStats'),
    log: document.getElementById('lruLog'),
  },
  mru: {
    status: document.getElementById('mruStatus'),
    visual: document.getElementById('mruCacheVisual'),
    stats: document.getElementById('mruStats'),
    log: document.getElementById('mruLog'),
  },
};

const state = {
  selectedTest: null,
  sequence: [],
  animating: false,
  paused: false,
  stepIndex: 0,
  lruTrace: [],
  mruTrace: [],
  animTimer: null,
};

function getConfig() {
  return {
    blockSize: parseInt(els.blockSize.value, 10),
    numCacheBlocks: parseInt(els.numCacheBlocks.value, 10),
    ways: 4,
    replacementPolicy: 'LRU',
    readPolicy: els.readPolicy.value,
    memoryBlocks: 1024,
  };
}

function updateConfigSummary() {
  const cfg = getConfig();
  const numSets = cfg.numCacheBlocks / 4;
  els.configSummary.textContent =
    `${cfg.numCacheBlocks} cache blocks | ${numSets} sets × 4 ways | ` +
    `${cfg.blockSize}-word blocks | ${cfg.readPolicy} | 1024 main memory blocks`;
}

function renderEmptyCache(visualEl, numCacheBlocks) {
  const numSets = numCacheBlocks / 4;
  let html = '<table class="cache-table"><thead><tr><th>Set</th>';
  for (let w = 0; w < 4; w++) {
    html += `<th>Way ${w}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (let s = 0; s < numSets; s++) {
    html += `<tr><td class="set-label">S${s}</td>`;
    for (let w = 0; w < 4; w++) {
      html += '<td><div class="cache-slot empty">—</div></td>';
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  visualEl.innerHTML = html;
}

function renderCacheSnapshot(visualEl, snapshot, activeStep = null) {
  let html = '<table class="cache-table"><thead><tr><th>Set</th>';
  for (let w = 0; w < snapshot.ways; w++) {
    html += `<th>Way ${w}</th>`;
  }
  html += '</tr></thead><tbody>';

  snapshot.sets.forEach((set) => {
    html += `<tr><td class="set-label">S${set.setIndex}</td>`;
    set.slots.forEach((slot) => {
      let cls = 'cache-slot';
      if (!slot.valid) {
        cls += ' empty';
        html += `<td><div class="${cls}">—</div></td>`;
      } else {
        cls += ' filled';
        if (activeStep) {
          const isActive =
            activeStep.setIndex === set.setIndex &&
            activeStep.slotIndex === slot.wayIndex;
          if (isActive) {
            cls += activeStep.isHit ? ' active-hit' : ' active-miss';
          }
        }
        html +=
          `<td><div class="${cls}">` +
          `<span class="block-num">B${slot.blockIndex}</span>` +
          `<span class="tag-info">tag=${slot.tag}</span>` +
          '</div></td>';
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  visualEl.innerHTML = html;
}

function renderStats(statsEl, stats) {
  const items = [
    { label: 'Total Accesses', value: stats.totalAccesses },
    { label: 'Cache Hits', value: stats.hits, highlight: true },
    { label: 'Cache Misses', value: stats.misses },
    { label: 'Hit Rate', value: `${(stats.hitRate * 100).toFixed(1)}%`, highlight: true },
    { label: 'Miss Rate', value: `${(stats.missRate * 100).toFixed(1)}%` },
    { label: 'AMAT', value: `${stats.amat.toFixed(2)} cycles` },
    { label: 'Total Time', value: `${stats.totalTime} cycles` },
  ];

  statsEl.innerHTML = items
    .map(
      (item) =>
        `<div class="stat-card${item.highlight ? ' highlight' : ''}">` +
        `<div class="stat-value">${item.value}</div>` +
        `<div class="stat-label">${item.label}</div></div>`
    )
    .join('');
}

function formatLogEntry(entry) {
  const hitClass = entry.isHit ? 'log-hit' : 'log-miss';
  const result = entry.isHit ? 'HIT' : 'MISS';
  let line =
    `<span class="log-step">[${entry.step}]</span> ` +
    `Block ${entry.blockIndex} → Set ${entry.setIndex} ` +
    `<span class="${hitClass}">${result}</span> ` +
    `(${entry.accessTime} cycles, cumulative: ${entry.cumulativeTime})`;
  if (entry.evictedBlock !== null) {
    line += ` — evicted B${entry.evictedBlock}`;
  }
  return line;
}

function renderLog(logEl, trace, upToStep = null) {
  const entries = upToStep !== null ? trace.slice(0, upToStep + 1) : trace;
  logEl.innerHTML = entries.map(formatLogEntry).join('\n');
  logEl.scrollTop = logEl.scrollHeight;
}

function renderComparison(lruStats, mruStats) {
  const rows = [
    { label: 'Total Accesses', lru: lruStats.totalAccesses, mru: mruStats.totalAccesses, lower: false },
    { label: 'Cache Hits', lru: lruStats.hits, mru: mruStats.hits, lower: false },
    { label: 'Cache Misses', lru: lruStats.misses, mru: mruStats.misses, lower: true },
    {
      label: 'Hit Rate',
      lru: `${(lruStats.hitRate * 100).toFixed(1)}%`,
      mru: `${(mruStats.hitRate * 100).toFixed(1)}%`,
      lower: false,
      raw: { lru: lruStats.hitRate, mru: mruStats.hitRate },
    },
    {
      label: 'Miss Rate',
      lru: `${(lruStats.missRate * 100).toFixed(1)}%`,
      mru: `${(mruStats.missRate * 100).toFixed(1)}%`,
      lower: true,
      raw: { lru: lruStats.missRate, mru: mruStats.missRate },
    },
    {
      label: 'AMAT (cycles)',
      lru: lruStats.amat.toFixed(2),
      mru: mruStats.amat.toFixed(2),
      lower: true,
      raw: { lru: lruStats.amat, mru: mruStats.amat },
    },
    {
      label: 'Total Time (cycles)',
      lru: lruStats.totalTime,
      mru: mruStats.totalTime,
      lower: true,
    },
  ];

  let html =
    '<table class="comparison-table"><thead><tr>' +
    '<th>Metric</th><th>LRU</th><th>MRU</th><th>Better</th></tr></thead><tbody>';

  rows.forEach((row) => {
    let lruCls = '';
    let mruCls = '';
    let better = '—';

    if (row.raw) {
      const lVal = row.raw.lru;
      const mVal = row.raw.mru;
      if (lVal !== mVal) {
        const lruWins = row.lower ? lVal < mVal : lVal > mVal;
        lruCls = lruWins ? 'winner' : 'loser';
        mruCls = lruWins ? 'loser' : 'winner';
        better = lruWins ? 'LRU' : 'MRU';
      } else {
        better = 'Tie';
      }
    } else if (typeof row.lru === 'number') {
      if (row.lru !== row.mru) {
        const lruWins = row.lower ? row.lru < row.mru : row.lru > row.mru;
        lruCls = lruWins ? 'winner' : 'loser';
        mruCls = lruWins ? 'loser' : 'winner';
        better = lruWins ? 'LRU' : 'MRU';
      } else {
        better = 'Tie';
      }
    }

    html +=
      `<tr><td>${row.label}</td>` +
      `<td class="${lruCls}">${row.lru}</td>` +
      `<td class="${mruCls}">${row.mru}</td>` +
      `<td>${better}</td></tr>`;
  });

  html += '</tbody></table>';
  els.comparisonTable.innerHTML = html;
  els.summaryPanel.hidden = false;
}

function runSimulations() {
  const config = getConfig();
  const errors = validateConfig(config);
  if (errors.length > 0) {
    alert(errors.join('\n'));
    return null;
  }

  if (!state.selectedTest) {
    alert('Please select a test case first.');
    return null;
  }

  const lruSim = new CacheSimulator({ ...config, replacementPolicy: 'LRU' });
  const mruSim = new CacheSimulator({ ...config, replacementPolicy: 'MRU' });

  state.lruTrace = lruSim.runSequence(state.sequence);
  state.mruTrace = mruSim.runSequence(state.sequence);

  return {
    lru: { sim: lruSim, stats: lruSim.getStatistics() },
    mru: { sim: mruSim, stats: mruSim.getStatistics() },
  };
}

function computePartialStats(trace, upToIndex) {
  const slice = trace.slice(0, upToIndex + 1);
  const hits = slice.filter((e) => e.isHit).length;
  const misses = slice.length - hits;
  const totalTime = slice.length > 0 ? slice[slice.length - 1].cumulativeTime : 0;

  return {
    totalAccesses: slice.length,
    hits,
    misses,
    hitRate: slice.length > 0 ? hits / slice.length : 0,
    missRate: slice.length > 0 ? misses / slice.length : 0,
    amat: slice.length > 0 ? totalTime / slice.length : 0,
    totalTime,
  };
}

function showFinalResults(results) {
  const lruFinal = state.lruTrace[state.lruTrace.length - 1];
  const mruFinal = state.mruTrace[state.mruTrace.length - 1];

  renderCacheSnapshot(els.lru.visual, lruFinal.snapshot);
  renderCacheSnapshot(els.mru.visual, mruFinal.snapshot);
  renderStats(els.lru.stats, results.lru.stats);
  renderStats(els.mru.stats, results.mru.stats);
  renderLog(els.lru.log, state.lruTrace);
  renderLog(els.mru.log, state.mruTrace);

  els.lru.status.textContent = 'Complete';
  els.lru.status.className = 'status-badge done';
  els.mru.status.textContent = 'Complete';
  els.mru.status.className = 'status-badge done';

  renderComparison(results.lru.stats, results.mru.stats);
}

function stopAnimation() {
  if (state.animTimer) {
    clearTimeout(state.animTimer);
    state.animTimer = null;
  }
  state.animating = false;
  state.paused = false;
  els.stepBtn.disabled = true;
  els.pauseBtn.disabled = true;
  els.pauseBtn.textContent = 'Pause';
}

function animateStep(index, results) {
  if (index >= state.sequence.length) {
    stopAnimation();
    showFinalResults(results);
    return;
  }

  const lruEntry = state.lruTrace[index];
  const mruEntry = state.mruTrace[index];

  renderCacheSnapshot(els.lru.visual, lruEntry.snapshot, lruEntry);
  renderCacheSnapshot(els.mru.visual, mruEntry.snapshot, mruEntry);
  renderStats(els.lru.stats, computePartialStats(state.lruTrace, index));
  renderStats(els.mru.stats, computePartialStats(state.mruTrace, index));
  renderLog(els.lru.log, state.lruTrace, index);
  renderLog(els.mru.log, state.mruTrace, index);

  els.lru.status.textContent = `Step ${index + 1}/${state.sequence.length}`;
  els.mru.status.textContent = `Step ${index + 1}/${state.sequence.length}`;

  state.stepIndex = index;

  if (!state.paused) {
    const speed = parseInt(els.animSpeed.value, 10);
    state.animTimer = setTimeout(() => animateStep(index + 1, results), speed);
  }
}

function startSimulation() {
  stopAnimation();
  els.summaryPanel.hidden = true;

  const results = runSimulations();
  if (!results) return;

  els.lru.status.textContent = 'Running';
  els.lru.status.className = 'status-badge running';
  els.mru.status.textContent = 'Running';
  els.mru.status.className = 'status-badge running';

  if (els.viewMode.value === 'final') {
    showFinalResults(results);
  } else {
    state.animating = true;
    state.stepIndex = 0;
    els.stepBtn.disabled = false;
    els.pauseBtn.disabled = false;
    animateStep(0, results);
  }
}

function resetUI() {
  stopAnimation();
  state.selectedTest = null;
  state.sequence = [];
  state.lruTrace = [];
  state.mruTrace = [];

  const cfg = getConfig();
  renderEmptyCache(els.lru.visual, cfg.numCacheBlocks);
  renderEmptyCache(els.mru.visual, cfg.numCacheBlocks);

  els.lru.stats.innerHTML = '';
  els.mru.stats.innerHTML = '';
  els.lru.log.textContent = '';
  els.mru.log.textContent = '';
  els.lru.status.textContent = 'Idle';
  els.lru.status.className = 'status-badge';
  els.mru.status.textContent = 'Idle';
  els.mru.status.className = 'status-badge';
  els.summaryPanel.hidden = true;
  els.testDescription.textContent = 'Select a test case to begin simulation.';

  document.querySelectorAll('.test-btn').forEach((btn) => btn.classList.remove('active'));
}

function selectTest(testId) {
  const cfg = getConfig();
  const testCase = getTestCase(testId, cfg.numCacheBlocks);
  state.selectedTest = testId;
  state.sequence = testCase.sequence;

  document.querySelectorAll('.test-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.test === testId);
  });

  els.testDescription.textContent =
    `${testCase.name}: ${testCase.description} — ${state.sequence.length} accesses: ` +
    `[${state.sequence.slice(0, 12).join(', ')}${state.sequence.length > 12 ? ', …' : ''}]`;
}

function stepForward() {
  if (!state.lruTrace.length) return;

  if (state.animTimer) {
    clearTimeout(state.animTimer);
    state.animTimer = null;
  }
  state.paused = true;

  const nextIndex = state.stepIndex + 1;
  if (nextIndex >= state.sequence.length) return;

  const lruEntry = state.lruTrace[nextIndex];
  const mruEntry = state.mruTrace[nextIndex];

  renderCacheSnapshot(els.lru.visual, lruEntry.snapshot, lruEntry);
  renderCacheSnapshot(els.mru.visual, mruEntry.snapshot, mruEntry);
  renderStats(els.lru.stats, computePartialStats(state.lruTrace, nextIndex));
  renderStats(els.mru.stats, computePartialStats(state.mruTrace, nextIndex));
  renderLog(els.lru.log, state.lruTrace, nextIndex);
  renderLog(els.mru.log, state.mruTrace, nextIndex);

  state.stepIndex = nextIndex;
  els.lru.status.textContent = `Step ${nextIndex + 1}/${state.sequence.length} (paused)`;
  els.mru.status.textContent = `Step ${nextIndex + 1}/${state.sequence.length} (paused)`;

  if (nextIndex + 1 >= state.sequence.length) {
    renderComparison(
      computePartialStats(state.lruTrace, state.lruTrace.length - 1),
      computePartialStats(state.mruTrace, state.mruTrace.length - 1)
    );
    els.lru.status.textContent = 'Complete';
    els.lru.status.className = 'status-badge done';
    els.mru.status.textContent = 'Complete';
    els.mru.status.className = 'status-badge done';
    els.stepBtn.disabled = true;
    els.pauseBtn.disabled = true;
    state.animating = false;
  }
}

document.querySelectorAll('.test-btn').forEach((btn) => {
  btn.addEventListener('click', () => selectTest(btn.dataset.test));
});

els.runBothBtn.addEventListener('click', startSimulation);
els.resetBtn.addEventListener('click', resetUI);
els.stepBtn.addEventListener('click', stepForward);

els.pauseBtn.addEventListener('click', () => {
  if (!state.animating) return;

  if (state.paused) {
    state.paused = false;
    els.pauseBtn.textContent = 'Pause';
    const results = {
      lru: { stats: computePartialStats(state.lruTrace, state.lruTrace.length - 1) },
      mru: { stats: computePartialStats(state.mruTrace, state.mruTrace.length - 1) },
    };
    animateStep(state.stepIndex + 1, results);
  } else {
    state.paused = true;
    els.pauseBtn.textContent = 'Resume';
    if (state.animTimer) {
      clearTimeout(state.animTimer);
      state.animTimer = null;
    }
    els.lru.status.textContent = `Step ${state.stepIndex + 1}/${state.sequence.length} (paused)`;
    els.mru.status.textContent = `Step ${state.stepIndex + 1}/${state.sequence.length} (paused)`;
  }
});

els.animSpeed.addEventListener('input', () => {
  els.animSpeedLabel.textContent = `${els.animSpeed.value} ms`;
});

[els.blockSize, els.numCacheBlocks, els.readPolicy].forEach((el) => {
  el.addEventListener('change', () => {
    updateConfigSummary();
    if (state.selectedTest) {
      selectTest(state.selectedTest);
    }
    const cfg = getConfig();
    renderEmptyCache(els.lru.visual, cfg.numCacheBlocks);
    renderEmptyCache(els.mru.visual, cfg.numCacheBlocks);
  });
});

updateConfigSummary();
resetUI();
