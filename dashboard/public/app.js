const chartFont = '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
const chartColor = '#b1bac4';
const chartGrid = '#21262d';

const scaleFont = { size: 13, family: chartFont };
const legendFont = { size: 13, family: chartFont, weight: '500' };

function scaleOpts(title) {
  return {
    ticks: { font: scaleFont, color: chartColor, padding: 6 },
    grid: { color: chartGrid },
    title: title ? { display: true, text: title, color: chartColor, font: { size: 13, family: chartFont } } : undefined,
  };
}

function legendOpts(pos) {
  return {
    display: true,
    position: pos || 'top',
    labels: { font: legendFont, color: chartColor, padding: 16, usePointStyle: true },
  };
}

let charts = [];

function destroyCharts() {
  charts.forEach(c => c.destroy());
  charts = [];
}

function newChart(canvas, config) {
  const c = new Chart(canvas, config);
  charts.push(c);
  return c;
}

async function api(path) {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function $(sel, parent) { return (parent || document).querySelector(sel); }

function $$(sel, parent) { return Array.from((parent || document).querySelectorAll(sel)); }

function html(strings, ...vals) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < vals.length) out += String(vals[i] ?? '');
  }
  return out;
}

function escape(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function fmtHours(h) {
  if (h >= 1000) return (h / 1000).toFixed(1) + 'k';
  if (h >= 1) return h.toFixed(1);
  return (h * 60).toFixed(0) + 'm';
}

function fmtMinutes(m) {
  if (m >= 60) return (m / 60).toFixed(1) + 'h';
  return m + 'm';
}

function navLink(text, hash) {
  return html`<a href="#${escape(hash)}" class="session-card">${escape(text)}</a>`;
}

function renderMarkdown(md) {
  let out = '';
  const lines = md.split('\n');
  let inList = false;
  let inMermaid = false;
  let mermaidCode = '';
  let mermaidIdx = 0;
  const mermaidBlocks = [];

  function flushMermaid() {
    if (mermaidCode) {
      const id = 'mermaid-md-' + (mermaidIdx++);
      out += html`<iframe class="mermaid" id="${id}" style="width:100%;min-height:300px;border:1px solid var(--border);border-radius:6px"></iframe>\n`;
      mermaidBlocks.push({ id, code: mermaidCode });
      mermaidCode = '';
    }
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (/^```mermaid/i.test(line.trim())) {
      flushMermaid();
      inMermaid = true;
      continue;
    }
    if (inMermaid) {
      if (/^```/.test(line.trim())) {
        inMermaid = false;
        flushMermaid();
        continue;
      }
      mermaidCode += line + '\n';
      continue;
    }
    if (line.startsWith('**') && line.endsWith('**')) {
      out += html`<h3 style="margin:12px 0 6px">${escape(line.slice(2, -2))}</h3>\n`;
      continue;
    }
    if (/^### /.test(line)) {
      out += html`<h3 style="margin:12px 0 6px;font-size:15px">${escape(line.slice(4))}</h3>\n`;
      continue;
    }
    if (/^## /.test(line)) {
      out += html`<h2 style="margin:16px 0 8px;font-size:17px">${escape(line.slice(3))}</h2>\n`;
      continue;
    }
    if (/^# /.test(line)) {
      out += html`<h1 style="margin:16px 0 8px;font-size:19px">${escape(line.slice(2))}</h1>\n`;
      continue;
    }
    if (/^- /.test(line)) {
      if (!inList) { out += '<ul style="margin:4px 0 8px;padding-left:20px">'; inList = true; }
      out += html`<li style="margin:2px 0">${escape(line.slice(2))}</li>\n`;
      continue;
    }
    if (inList) { out += '</ul>\n'; inList = false; }
    if (/^\d+\. /.test(line)) {
      out += html`<li style="margin:2px 0">${escape(line.replace(/^\d+\. /, ''))}</li>\n`;
      continue;
    }
    if (line.trim() === '') {
      out += '<br>\n';
      continue;
    }
    let processed = escape(line);
    processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');
    processed = processed.replace(/`([^`]+)`/g, '<code style="background:var(--bg3);padding:1px 5px;border-radius:3px;font-size:13px">$1</code>');
    out += html`<div style="margin:2px 0">${processed}</div>\n`;
  }
  flushMermaid();
  if (inList) out += '</ul>\n';
  return { html: out, mermaidBlocks };
}

function renderMermaidBlocks(blocks) {
  for (const { id, code } of blocks) {
    const el = document.getElementById(id);
    if (el) {
      const doc = el.contentDocument || el.contentWindow.document;
      const mmdCode = JSON.stringify(code);
      doc.open();
      doc.write('<!DOCTYPE html><html><head><script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"><'+'/script><style>body{margin:0;padding:12px;background:#0d1117}</style></head><body><pre class="mermaid" style="margin:0"></pre><script>mermaid.initialize({startOnLoad:false,theme:"dark"});var e=document.querySelector(".mermaid");e.textContent='+mmdCode+';mermaid.run({nodes:[e]});<'+'/script></body></html>');
      doc.close();
    }
  }
}

function renderPartText(parts) {
  let texts = [];
  for (const p of parts) {
    if (p.type === 'text' && p.text) {
      texts.push(escape(p.text.slice(0, 600)));
    } else if (p.type === 'reasoning' && p.text) {
      texts.push(html`<details style="margin:2px 0"><summary style="cursor:pointer;color:var(--text2);font-size:12px">reasoning</summary><div style="color:var(--text2);font-size:12px;margin-top:4px">${escape(p.text.slice(0, 600))}</div></details>`);
    } else if (p.type === 'tool') {
      const input = p.state?.input || {};
      const keys = Object.keys(input).slice(0, 3);
      const args = keys.map(k => `${k}=${escape(String(input[k]).slice(0, 60))}`).join(', ');
      texts.push(html`<span style="color:var(--orange);font-size:12px">🔧 ${escape(p.tool)}(${args})</span>`);
    } else if (p.type === 'patch') {
      const files = p.files || [];
      texts.push(html`<span style="color:var(--green);font-size:12px">📁 patch: ${files.length} file(s) changed</span>`);
    }
  }
  return texts.join('<br>') || '<span style="color:var(--text2);font-size:12px">(metadata — no text content)</span>';
}

// ---------- Router ----------

function route() {
  const hash = location.hash.slice(1) || '/';
  destroyCharts();
  $$('.nav-link').forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + hash.split('?')[0].split('/')[0]));

  if (hash === '/' || hash === '') renderOverview();
  else if (hash.startsWith('/daily/')) renderDaily(hash.split('/')[2]);
  else if (hash === '/daily') renderDailyList();
  else if (hash.startsWith('/session/')) renderSession(hash.split('/')[2]);
  else if (hash === '/sessions') renderSessionsList();
  else if (hash === '/git') renderGit();
  else if (hash.startsWith('/commit/')) renderCommit(hash.split('/')[2]);
  else if (hash === '/experiments') renderExperimentsList();
  else if (hash.startsWith('/experiment/')) renderExperiment(hash.split('/')[2]);
  else if (hash === '/specs') renderSpecsTree();
  else if (hash.startsWith('/spec/')) renderSpecFile(decodeURIComponent(hash.slice(6)));
  else if (hash.startsWith('/search')) renderSearch(new URLSearchParams(hash.split('?')[1] || '').get('q') || '');
  else renderOverview();
}

window.addEventListener('hashchange', route);

// ---------- Overview ----------

async function renderOverview() {
  const el = $('#content');
  el.innerHTML = '<div class="spinner">Loading...</div>';
  try {
    const [health, stats] = await Promise.all([api('/api/health'), api('/api/stats')]);
    const days = stats.per_day || [];
    const last = days[days.length - 1] || null;

    el.innerHTML = html`
      <h1 class="page-title">Overview</h1>
      <div class="stats-grid">
        <div class="card">
          <div class="card-title">Session Days</div>
          <div class="card-value">${stats.total_days}</div>
        </div>
        <div class="card">
          <div class="card-title">Total Sessions</div>
          <div class="card-value">${stats.total_sessions}</div>
        </div>
        <div class="card">
          <div class="card-title">Prompter Time</div>
          <div class="card-value">${fmtHours(stats.total_prompter_time_hours)}h</div>
        </div>
        <div class="card">
          <div class="card-title">SME Time</div>
          <div class="card-value">${fmtHours(stats.total_sme_time_hours)}h</div>
        </div>
        <div class="card">
          <div class="card-title">Avg AI Multiplier</div>
          <div class="card-value">${stats.avg_multiplier}x</div>
        </div>
        <div class="card">
          <div class="card-title">Latest Day</div>
          <div class="card-value small">${last ? escape(last.date) : 'N/A'}</div>
        </div>
      </div>
      ${last ? html`
      <div class="two-col">
        <div class="chart-container">
          <h3 class="card-title">Latest Day: ${escape(last.date)} — Top Subject Areas by SME Time</h3>
          <canvas id="chart-top-subjects"></canvas>
        </div>
        <div class="chart-container">
          <h3 class="card-title">Session Durations (minutes)</h3>
          <canvas id="chart-session-durs"></canvas>
        </div>
      </div>
      ` : ''}
      <div class="chart-container">
        <h3 class="card-title">AI Multiplier Trend</h3>
        <canvas id="chart-trend"></canvas>
      </div>
      <div class="chart-container">
        <h3 class="card-title">Daily Prompter vs SME Hours</h3>
        <canvas id="chart-daily-bars"></canvas>
      </div>
      ${last ? html`
      <h3 class="page-title" style="font-size:18px">Latest Sessions</h3>
      ${last.session_breakdown.slice(-10).reverse().map(s => html`
        <a href="#/session/${escape(s.session_id)}" class="session-card" style="display:block">
          <div class="session-card-title">${escape(s.session_id)}</div>
          <div class="session-card-meta">${s.duration_minutes}m · ${s.prompter_time_minutes}m prompter · ${(s.sme_time_minutes / 60).toFixed(1)}h SME</div>
          <div>${escape(s.top_component_summary)}</div>
          <div style="margin-top:6px">${s.tags.slice(0, 8).map(t => html`<span class="tag">${escape(t)}</span>`).join('')}</div>
        </a>
      `).join('')}
      ` : ''}
    `;

    // Charts
    if (last) {
      const top15 = last.top_subject_areas.slice(0, 15);
      newChart($('#chart-top-subjects'), {
        type: 'bar',
        data: {
          labels: top15.map(s => s.name),
          datasets: [{
            label: 'SME hours',
            data: top15.map(s => s.sme_time_hours),
            backgroundColor: '#58a6ff',
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { x: scaleOpts('Hours'), y: scaleOpts() },
        },
      });

      newChart($('#chart-session-durs'), {
        type: 'bar',
        data: {
          labels: last.session_breakdown.map(s => s.session_id.replace(/^[\d-]+-/, '').slice(0, 20)),
          datasets: [{
            label: 'Duration (min)',
            data: last.session_breakdown.map(s => s.duration_minutes),
            backgroundColor: '#3fb950',
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { x: scaleOpts(), y: scaleOpts('Minutes') },
        },
      });
    }

    if (days.length > 1) {
      newChart($('#chart-trend'), {
        type: 'line',
        data: {
          labels: days.map(d => d.date),
          datasets: [{
            label: 'AI Multiplier',
            data: days.map(d => d.ai_multiplier),
            borderColor: '#d29922',
            backgroundColor: 'rgba(210,153,34,0.1)',
            fill: true,
            tension: 0.3,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: legendOpts() },
          scales: { x: scaleOpts(), y: scaleOpts('Multiplier') },
        },
      });

      newChart($('#chart-daily-bars'), {
        type: 'bar',
        data: {
          labels: days.map(d => d.date),
          datasets: [
            { label: 'Prompter', data: days.map(d => d.total_prompter_time_hours), backgroundColor: '#58a6ff' },
            { label: 'SME', data: days.map(d => d.total_sme_time_hours), backgroundColor: '#3fb950' },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: legendOpts() },
          scales: { x: scaleOpts(), y: scaleOpts('Hours') },
        },
      });
    }
  } catch (e) {
    el.innerHTML = html`<div class="error">Error: ${escape(e.message)}</div>`;
  }
}

// ---------- Daily List ----------

async function renderDailyList() {
  const el = $('#content');
  el.innerHTML = '<div class="spinner">Loading...</div>';
  try {
    const data = await api('/api/days');
    el.innerHTML = html`
      <h1 class="page-title">Daily Reports</h1>
      ${data.days.map(d => html`
        <a href="#/daily/${escape(d)}" class="session-card" style="display:block">
          <div class="session-card-title">${escape(d)}</div>
        </a>
      `).join('')}
    `;
  } catch (e) {
    el.innerHTML = html`<div class="error">Error: ${escape(e.message)}</div>`;
  }
}

// ---------- Daily Detail ----------

async function renderDaily(date) {
  const el = $('#content');
  el.innerHTML = '<div class="spinner">Loading...</div>';
  try {
    const day = await api(`/api/days/${date}`);
    el.innerHTML = html`
      <h1 class="page-title">${escape(day.date)}</h1>
      <div class="stats-grid">
        <div class="card"><div class="card-title">Sessions</div><div class="card-value">${day.total_sessions}</div></div>
        <div class="card"><div class="card-title">Prompter</div><div class="card-value">${day.total_prompter_time_hours}h</div></div>
        <div class="card"><div class="card-title">SME</div><div class="card-value">${day.total_sme_time_hours}h</div></div>
        <div class="card"><div class="card-title">AI Multiplier</div><div class="card-value">${day.ai_multiplier}x</div></div>
      </div>
      ${day.metadata ? html`<div class="card"><em>${escape(day.metadata.audit_note)}</em></div>` : ''}

      <div class="two-col">
        <div class="chart-container">
          <h3 class="card-title">Top Subject Areas</h3>
          <canvas id="chart-subjects"></canvas>
        </div>
        <div class="chart-container">
          <h3 class="card-title">Session Time Distribution</h3>
          <canvas id="chart-session-pie"></canvas>
        </div>
      </div>

      <h3 style="margin: 16px 0 8px; font-size:16px">Sessions</h3>
      ${day.session_breakdown.map(s => html`
        <a href="#/session/${escape(s.session_id)}" class="session-card" style="display:block">
          <div class="session-card-title">${escape(s.session_id)}</div>
          <div class="session-card-meta">${s.duration_minutes}m total · ${s.prompter_time_minutes}m prompter · ${fmtMinutes(s.sme_time_minutes)} SME · confidence: ${s.human_confidence}</div>
          <div>${escape(s.top_component_summary)}</div>
          <div style="margin-top:6px">${s.tags.map(t => html`<span class="tag">${escape(t)}</span>`).join('')}</div>
        </a>
      `).join('')}
    `;

    const top10 = day.top_subject_areas.slice(0, 10);
    newChart($('#chart-subjects'), {
      type: 'bar',
      data: {
        labels: top10.map(s => s.name),
        datasets: [{
          label: 'SME hours',
          data: top10.map(s => s.sme_time_hours),
          backgroundColor: '#58a6ff',
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: scaleOpts('Hours'), y: scaleOpts() },
      },
    });

    const sessions = day.session_breakdown;
    newChart($('#chart-session-pie'), {
      type: 'doughnut',
      data: {
        labels: sessions.map(s => s.session_id.replace(/^[\d-]+-/, '').slice(0, 15)),
        datasets: [{
          data: sessions.map(s => s.duration_minutes),
          backgroundColor: ['#58a6ff', '#3fb950', '#d29922', '#f85149', '#bc8cff', '#79c0ff', '#56d364', '#e3b341'],
        }],
      },
      options: { responsive: true, plugins: { legend: legendOpts('right') } },
    });
  } catch (e) {
    el.innerHTML = html`<div class="error">Error: ${escape(e.message)}</div>`;
  }
}

// ---------- Sessions List ----------

async function renderSessionsList() {
  const el = $('#content');
  el.innerHTML = '<div class="spinner">Loading...</div>';
  try {
    const data = await api('/api/sessions?limit=200');
    el.innerHTML = html`
      <h1 class="page-title">All Sessions (${data.total})</h1>
      ${data.sessions.map(s => html`
        <a href="#/session/${escape(s.entry.session_id)}" class="session-card" style="display:block">
          <div class="session-card-title">${escape(s.entry.session_id)}</div>
          <div class="session-card-meta">${s.date} · ${s.entry.duration_minutes}m · ${s.entry.human_confidence}</div>
          <div>${escape(s.entry.top_component_summary)}</div>
          <div style="margin-top:6px">${s.entry.tags.slice(0, 6).map(t => html`<span class="tag">${escape(t)}</span>`).join('')}</div>
        </a>
      `).join('')}
    `;
  } catch (e) {
    el.innerHTML = html`<div class="error">Error: ${escape(e.message)}</div>`;
  }
}

// ---------- Session Detail ----------

async function renderSession(id) {
  const el = $('#content');
  el.innerHTML = '<div class="spinner">Loading...</div>';

  let summaryData, fullData;
  try {
    [summaryData, fullData] = await Promise.all([
      api(`/api/sessions/${encodeURIComponent(id)}/summary`).catch(() => null),
      api(`/api/sessions/${encodeURIComponent(id)}`).catch(() => null),
    ]);
  } catch {
    el.innerHTML = html`<div class="error">Failed to load session data</div>`;
    return;
  }

  const s = (summaryData || fullData)?.summary;
  if (!s) {
    el.innerHTML = html`<div class="error">Session not found: ${escape(id)}</div>`;
    return;
  }

  const md = summaryData?.markdown || null;
  const d = fullData?.detail || null;

  let hasTranscript = !!d;

  el.innerHTML = html`
    <a href="#/daily/${escape(s.date)}" style="font-size:13px">&larr; Back to ${escape(s.date)}</a>
    <h1 class="page-title">${escape(s.entry.session_id)}</h1>
    <div class="stats-grid">
      <div class="card"><div class="card-title">Duration</div><div class="card-value">${s.entry.duration_minutes}m</div></div>
      <div class="card"><div class="card-title">Prompter</div><div class="card-value">${s.entry.prompter_time_minutes}m</div></div>
      <div class="card"><div class="card-title">SME</div><div class="card-value">${fmtMinutes(s.entry.sme_time_minutes)}</div></div>
      <div class="card"><div class="card-title">Confidence</div><div class="card-value small">${s.entry.human_confidence}</div></div>
    </div>
    <div class="card">
      <div class="card-title">Description</div>
      <div>${escape(s.entry.top_component_summary)}</div>
    </div>
    <div class="card">
      <div class="card-title">Tags</div>
      <div>${s.entry.tags.map(t => html`<span class="tag">${escape(t)}</span>`).join('')}</div>
    </div>
    ${d ? html`
      <div class="card">
        <div class="card-title">Session Info</div>
        <table>
          <tr><th>Title</th><td>${escape(d.info.title)}</td></tr>
          <tr><th>Agent</th><td>${escape(d.info.agent)}</td></tr>
          <tr><th>Model</th><td>${escape(d.info.model.id)} (${escape(d.info.model.providerID)})</td></tr>
          <tr><th>Files</th><td>${d.info.summary.files} changed (+${d.info.summary.additions}/-${d.info.summary.deletions})</td></tr>
        </table>
      </div>
    ` : ''}
    ${md ? html`
      <div class="card" id="summary-md">
        <div class="card-title">Session Summary</div>
        <div style="font-size:14px;line-height:1.7;color:var(--text)">${renderMarkdown(md)}</div>
      </div>
    ` : html`<div class="card"><em>No summary .md file for this session</em></div>`}
    <div id="transcript-section">
      ${hasTranscript ? html`
        <div class="card" style="margin-top:16px">
          <div class="card-title">Full Transcript (${d.messages.length} messages)</div>
          ${buildTranscript(d.messages)}
        </div>
      ` : html`<div class="card"><em>Full transcript not available (no .json.bz2 file found)</em></div>`}
    </div>
  `;
}

function buildTranscript(messages) {
  let out = '';
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (msg.info.role === 'user') {
      out += html`
        <div style="padding:10px 12px;margin-bottom:6px;border:1px solid var(--border);border-radius:6px;background:var(--bg2)">
          <div style="font-size:12px;color:var(--accent);margin-bottom:4px;font-weight:500">user · ${new Date(msg.info.time.created).toLocaleString()}</div>
          <div style="font-size:13px;line-height:1.5;word-break:break-word">${renderPartText(msg.parts)}</div>
        </div>
      `;
      i++;
      const assistantMsgs = [];
      while (i < messages.length && messages[i].info.role !== 'user') {
        assistantMsgs.push(messages[i]);
        i++;
      }
      if (assistantMsgs.length > 0) {
        const toolCount = assistantMsgs.filter(m => m.parts.some(p => p.type === 'tool')).length;
        out += html`
          <details style="margin:0 0 10px 0">
            <summary style="cursor:pointer;padding:8px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text2);font-size:13px;font-weight:500">
              Assistant Response (${assistantMsgs.length} messages${toolCount ? ', ' + toolCount + ' tool call(s)' : ''})
            </summary>
            <div style="padding:8px 12px 4px 20px;border-left:2px solid var(--border);margin-top:4px">
              ${assistantMsgs.map(am => {
                const hasTool = am.parts.some(p => p.type === 'tool');
                const color = hasTool ? 'var(--orange)' : 'var(--green)';
                return html`
                  <div style="padding:6px 0;border-bottom:1px solid var(--border)">
                    <div style="font-size:11px;color:${color};margin-bottom:2px;font-weight:500">assistant · ${new Date(am.info.time.created).toLocaleString()}</div>
                    <div style="font-size:13px;line-height:1.5;word-break:break-word">${renderPartText(am.parts)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </details>
        `;
      }
    } else {
      i++;
    }
  }
  return out;
}

// ---------- Git ----------

async function renderGit() {
  const el = $('#content');
  el.innerHTML = '<div class="spinner">Loading...</div>';
  try {
    const [stats, log] = await Promise.all([api('/api/git/stats'), api('/api/git/log')]);
    const dates = Object.keys(stats.per_date).sort();
    el.innerHTML = html`
      <h1 class="page-title">Git Activity</h1>
      <div class="stats-grid">
        <div class="card"><div class="card-title">Total Commits</div><div class="card-value">${stats.total_commits}</div></div>
        <div class="card"><div class="card-title">Files Changed</div><div class="card-value">${stats.total_files_changed}</div></div>
        <div class="card"><div class="card-title">Insertions</div><div class="card-value">${stats.total_insertions.toLocaleString()}</div></div>
        <div class="card"><div class="card-title">Deletions</div><div class="card-value">${stats.total_deletions.toLocaleString()}</div></div>
      </div>
      <div class="chart-container">
        <h3 class="card-title">Commits Per Day</h3>
        <canvas id="chart-commits"></canvas>
      </div>
      <h3 style="margin:16px 0 8px;font-size:16px">Recent Commits</h3>
      ${log.commits.slice(0, 50).map(c => html`
        <a href="#/commit/${escape(c.commit)}" class="session-card" style="display:block">
          <div class="session-card-title"><code>${escape(c.commit.slice(0, 8))}</code> ${escape(c.message)}</div>
          <div class="session-card-meta">${escape(c.author)} · ${escape(c.date)} · +${c.insertions}/-${c.deletions} · ${c.files_changed} files</div>
        </a>
      `).join('')}
    `;

    newChart($('#chart-commits'), {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [{
          label: 'Commits',
          data: dates.map(d => stats.per_date[d].commits),
          backgroundColor: '#58a6ff',
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: scaleOpts(), y: scaleOpts('Commits') },
      },
    });
  } catch (e) {
    el.innerHTML = html`<div class="error">Error: ${escape(e.message)}</div>`;
  }
}

// ---------- Commit Detail ----------

async function renderCommit(hash) {
  const el = $('#content');
  el.innerHTML = '<div class="spinner">Loading...</div>';
  try {
    const data = await api(`/api/git/commit/${encodeURIComponent(hash)}`);
    el.innerHTML = html`
      <a href="#/git" style="font-size:13px">&larr; Back to Git</a>
      <h1 class="page-title">Commit ${escape(hash.slice(0, 8))}</h1>
      <pre style="background:var(--bg3);padding:16px;border-radius:8px;overflow:auto;font-size:12px;font-family:var(--mono);max-height:80vh"><code class="language-diff">${escape(data.diff)}</code></pre>
    `;
    if (typeof hljs !== 'undefined') {
      hljs.highlightElement(el.querySelector('code'));
    }
  } catch (e) {
    el.innerHTML = html`<div class="error">Error: ${escape(e.message)}</div>`;
  }
}

// ---------- Search ----------

async function renderSearch(query) {
  const el = $('#content');
  el.innerHTML = html`
    <h1 class="page-title">Search</h1>
    <input type="text" class="search-box" placeholder="Search sessions..." value="${escape(query)}" id="search-input">
    <div id="search-results"></div>
  `;

  const input = $('#search-input');
  let timeout;

  async function doSearch(q) {
    if (!q.trim()) { $('#search-results').innerHTML = ''; return; }
    $('#search-results').innerHTML = '<div class="spinner">Searching...</div>';
    try {
      const data = await api(`/api/search?q=${encodeURIComponent(q)}`);
      if (data.results.length === 0) {
        $('#search-results').innerHTML = '<div class="card"><em>No results found</em></div>';
        return;
      }
      $('#search-results').innerHTML = data.results.map(r => html`
        <a href="#/session/${escape(r.session_id)}" class="session-card" style="display:block">
          <div class="session-card-title">${escape(r.session_id)}</div>
          <div class="session-card-meta">Match: ${r.match_type} · ${escape(r.date)}</div>
          <div>${escape(r.match_snippet)}</div>
        </a>
      `).join('');
      location.hash = '#/search?q=' + encodeURIComponent(q);
    } catch (e) {
      $('#search-results').innerHTML = html`<div class="error">Error: ${escape(e.message)}</div>`;
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => doSearch(input.value), 300);
  });

  if (query) {
    input.value = query;
    doSearch(query);
  }
}

// ---------- Experiments ----------

async function renderExperimentsList() {
  const el = $('#content');
  el.innerHTML = '<div class="spinner">Loading...</div>';
  try {
    const data = await api('/api/experiments');
    el.innerHTML = html`
      <h1 class="page-title">Experiments</h1>
      ${data.experiments.length === 0 ? html`<div class="card"><em>No experiments found</em></div>` : ''}
      ${data.experiments.map(exp => {
        const outcomeClass = exp.outcome.toLowerCase().includes('accepted') ? 'badge-accepted' :
          exp.outcome.toLowerCase().includes('archived') ? 'badge-archived' :
          exp.outcome.toLowerCase().includes('todo') ? 'badge-todo' :
          exp.outcome.toLowerCase().includes('wip') ? 'badge-wip' : '';
        const shortOutcome = exp.outcome.split('——')[0]?.trim() || exp.outcome;
        return html`
          <a href="#/experiment/${encodeURIComponent(exp.directory)}" class="session-card" style="display:block">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div class="session-card-title">${escape(exp.description)}</div>
              <span class="badge ${outcomeClass}">${escape(shortOutcome)}</span>
            </div>
            <div class="session-card-meta">${escape(exp.date)} · ${escape(exp.agent)} · ${escape(exp.directory)}</div>
          </a>
        `;
      }).join('')}
    `;
  } catch (e) {
    el.innerHTML = html`<div class="error">Error: ${escape(e.message)}</div>`;
  }
}

async function renderExperiment(name) {
  const el = $('#content');
  el.innerHTML = '<div class="spinner">Loading...</div>';
  try {
    const exp = await api(`/api/experiments/${encodeURIComponent(name)}`);
    const outcomeClass = exp.entry.outcome.toLowerCase().includes('accepted') ? 'badge-accepted' :
      exp.entry.outcome.toLowerCase().includes('archived') ? 'badge-archived' : '';

    el.innerHTML = html`
      <a href="#/experiments" style="font-size:13px">&larr; Back to Experiments</a>
      <h1 class="page-title">${escape(exp.entry.description)}</h1>

      <div class="stats-grid">
        <div class="card"><div class="card-title">Date</div><div class="card-value small">${escape(exp.entry.date)}</div></div>
        <div class="card"><div class="card-title">Agent</div><div class="card-value small">${escape(exp.entry.agent)}</div></div>
        <div class="card"><div class="card-title">Outcome</div><div><span class="badge ${outcomeClass}" style="font-size:15px">${escape(exp.entry.outcome)}</span></div></div>
      </div>

      <div class="card">
        <div class="card-title">Directory</div>
        <code style="font-size:13px;background:var(--bg3);padding:2px 6px;border-radius:4px">${escape(exp.entry.directory)}</code>
      </div>

      ${exp.readme ? (() => {
        const md = renderMarkdown(exp.readme);
        setTimeout(() => renderMermaidBlocks(md.mermaidBlocks), 0);
        return html`
          <div class="card" id="exp-readme">
            <div class="card-title">README.md</div>
            <div style="font-size:14px;line-height:1.7;color:var(--text)">${md.html}</div>
          </div>
        `;
      })() : html`<div class="card"><em>No README.md in this experiment</em></div>`}

      ${exp.subdirs.length > 0 ? html`
        <div class="card">
          <div class="card-title">Files</div>
          ${exp.subdirs.map(sd => html`
            <div style="margin:8px 0">
              <div style="font-weight:600;font-size:14px;margin-bottom:4px;color:var(--accent)}">${escape(sd.name)}/</div>
              ${sd.files.map(f => html`
                <div style="padding:2px 0 2px 16px;font-size:13px;font-family:var(--mono)">
                  <a href="javascript:void(0)" class="exp-file-link" data-path="${escape(f.path)}">${escape(f.name)}</a>
                  <span style="color:var(--text2);font-size:11px"> (${f.size} B)</span>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div id="exp-file-viewer"></div>
    `;

    $$('.exp-file-link').forEach(link => {
      link.addEventListener('click', async () => {
        const filePath = link.getAttribute('data-path');
        const viewer = $('#exp-file-viewer');
        viewer.innerHTML = '<div class="spinner">Loading...</div>';
        const ext = (filePath.match(/\.([^.]+)$/) || [])[1]?.toLowerCase() || '';
        const baseUrl = `/api/experiments/${encodeURIComponent(name)}/read?path=${encodeURIComponent(filePath)}`;
        try {
          if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'svg') {
            viewer.innerHTML = html`
              <div class="card">
                <div class="card-title" style="display:flex;justify-content:space-between">
                  <span>${escape(filePath)}</span>
                  <span style="cursor:pointer;color:var(--text2);font-size:12px" onclick="this.parentElement.parentElement.parentElement.innerHTML=''">[close]</span>
                </div>
                <div style="text-align:center;padding:12px"><img src="${baseUrl}&raw=true" style="max-width:100%;border-radius:6px"></div>
              </div>
            `;
          } else if (ext === 'html') {
            const rawUrl = baseUrl + '&raw=true';
            viewer.innerHTML = html`
              <div class="card">
                <div class="card-title" style="display:flex;justify-content:space-between">
                  <span>${escape(filePath)}</span>
                  <span style="cursor:pointer;color:var(--text2);font-size:12px" onclick="this.parentElement.parentElement.parentElement.innerHTML=''">[close]</span>
                </div>
                <iframe src="${rawUrl}" style="width:100%;min-height:500px;border:1px solid var(--border);border-radius:6px;background:#fff"></iframe>
              </div>
            `;
          } else if (ext === 'mmd') {
            const data = await api(baseUrl);
            const iframeId = 'mermaid-frame-' + Date.now();
            viewer.innerHTML = html`
              <div class="card">
                <div class="card-title" style="display:flex;justify-content:space-between">
                  <span>${escape(filePath)}</span>
                  <span style="cursor:pointer;color:var(--text2);font-size:12px" onclick="this.parentElement.parentElement.parentElement.innerHTML=''">[close]</span>
                </div>
                <iframe id="${iframeId}" style="width:100%;min-height:500px;border:none;border-radius:6px"></iframe>
              </div>
            `;
            const iframe = document.getElementById(iframeId);
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const mmdCode = JSON.stringify(data.content);
            doc.open();
            doc.write('<!DOCTYPE html><html><head><script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"><'+'/script><style>body{margin:0;padding:12px;background:#0d1117}</style></head><body><pre class="mermaid" style="margin:0"></pre><script>mermaid.initialize({startOnLoad:false,theme:"dark"});var e=document.querySelector(".mermaid");e.textContent='+mmdCode+';mermaid.run({nodes:[e]});<'+'/script></body></html>');
            doc.close();
          } else if (ext === 'cpp' || ext === 'h' || ext === 'asm' || ext === 'sh' || ext === 'js' || ext === 'ts' || ext === 'json') {
            const data = await api(baseUrl);
            const lang = ext === 'h' ? 'cpp' : ext === 'asm' ? 'asm' : ext === 'sh' ? 'bash' : ext;
            viewer.innerHTML = html`
              <div class="card">
                <div class="card-title" style="display:flex;justify-content:space-between">
                  <span>${escape(filePath)}</span>
                  <span style="cursor:pointer;color:var(--text2);font-size:12px" onclick="this.parentElement.parentElement.parentElement.innerHTML=''">[close]</span>
                </div>
                <pre style="background:var(--bg3);padding:12px;border-radius:6px;overflow:auto;font-size:12px;font-family:var(--mono);max-height:60vh;margin-top:8px"><code class="language-${lang}">${escape(data.content)}</code></pre>
              </div>
            `;
            const code = viewer.querySelector('code');
            if (code && typeof hljs !== 'undefined') {
              hljs.highlightElement(code);
            }
          } else if (ext === 'md') {
            const data = await api(baseUrl);
            const md = renderMarkdown(data.content);
            viewer.innerHTML = html`
              <div class="card">
                <div class="card-title" style="display:flex;justify-content:space-between">
                  <span>${escape(filePath)}</span>
                  <span style="cursor:pointer;color:var(--text2);font-size:12px" onclick="this.parentElement.parentElement.parentElement.innerHTML=''">[close]</span>
                </div>
                <div style="font-size:14px;line-height:1.7;color:var(--text)">${md.html}</div>
              </div>
            `;
            renderMermaidBlocks(md.mermaidBlocks);
          } else {
            const data = await api(baseUrl);
            viewer.innerHTML = html`
              <div class="card">
                <div class="card-title" style="display:flex;justify-content:space-between">
                  <span>${escape(filePath)}</span>
                  <span style="cursor:pointer;color:var(--text2);font-size:12px" onclick="this.parentElement.parentElement.parentElement.innerHTML=''">[close]</span>
                </div>
                <pre style="background:var(--bg3);padding:12px;border-radius:6px;overflow:auto;font-size:12px;font-family:var(--mono);max-height:60vh;margin-top:8px">${escape(data.content)}</pre>
              </div>
            `;
          }
        } catch (e) {
          viewer.innerHTML = html`<div class="error">Error loading file: ${escape(e.message)}</div>`;
        }
      });
    });
  } catch (e) {
    el.innerHTML = html`<div class="error">Error: ${escape(e.message)}</div>`;
  }
}

// ---------- Tech Specs ----------

async function renderSpecsTree() {
  const el = $('#content');
  el.innerHTML = '<div class="spinner">Loading...</div>';
  try {
    const tree = await api('/api/specs');
    el.innerHTML = html`
      <h1 class="page-title">Technical Specifications</h1>
      <div class="card" style="padding:8px 16px">
        ${renderSpecNode(tree, 0)}
      </div>
    `;
  } catch (e) {
    el.innerHTML = html`<div class="error">Error: ${escape(e.message)}</div>`;
  }
}

function renderSpecNode(node, depth) {
  if (node.isDir) {
    const visible = depth <= 1 ? 'open' : '';
    return html`
      <details ${visible} style="margin-left:${depth > 0 ? 16 : 0}px">
        <summary style="cursor:pointer;padding:3px 0;font-weight:${depth === 0 ? 600 : 500};color:var(--text)">${node.name}</summary>
        <div style="border-left:1px solid var(--border);padding-left:12px;margin-left:4px">
          ${(node.children || []).map(c => renderSpecNode(c, depth + 1)).join('')}
        </div>
      </details>
    `;
  }
  const isRoot = node.name === 'technical-specification.md';
  return html`
    <div style="margin-left:${depth * 16}px;padding:2px 0">
      <a href="#/spec/${encodeURIComponent(node.path)}" style="font-size:14px;${isRoot ? 'font-weight:600' : ''}">${escape(node.name)}</a>
    </div>
  `;
}

async function renderSpecFile(path) {
  const el = $('#content');
  el.innerHTML = '<div class="spinner">Loading...</div>';
  try {
    const data = await api(`/api/specs/read?path=${encodeURIComponent(path)}`);
    const md = renderMarkdown(data.content);
    el.innerHTML = html`
      <a href="#/specs" style="font-size:13px">&larr; Back to Specs</a>
      <h1 class="page-title">${escape(data.path)}</h1>
      <div class="card">
        <div style="font-size:14px;line-height:1.7;color:var(--text)">${md.html}</div>
      </div>
    `;
    renderMermaidBlocks(md.mermaidBlocks);
  } catch (e) {
    el.innerHTML = html`<div class="error">Error: ${escape(e.message)}</div>`;
  }
}

// ---------- Init ----------

document.addEventListener('DOMContentLoaded', route);
