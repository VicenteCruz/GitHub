import { createServer } from 'http';
import { readFileSync } from 'fs';

// --- Load .env manually ---
try {
  const envContent = readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key && val) process.env[key] = val;
    }
  });
} catch { /* .env is optional */ }

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-3.1-flash-lite';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
const LT_API_URL = 'https://api.languagetoolplus.com/v2/check';

// --- Language config ---
const LANGS = {
  eng: { name: 'English', flag: '🇬🇧', ltCode: 'en-US' },
  fr:  { name: 'French',  flag: '🇫🇷', ltCode: 'fr' },
  pt:  { name: 'Portuguese', flag: '🇵🇹', ltCode: 'pt-PT' },
};

// --- Tools config ---
const TOOLS = {};

// 1. /correct-[lang]/ (Non-AI, LanguageTool)
for (const [code, lang] of Object.entries(LANGS)) {
  const key = `correct-${code}`;
  TOOLS[key] = {
    prefix: key,
    label: `Correct ${lang.name} (No AI)`,
    description: `Strict grammar & spelling check in ${lang.name} using rules`,
    color: '#6b7280', // Gray for non-AI
    flag: lang.flag,
    engine: 'languagetool',
    ltCode: lang.ltCode,
    example: code === 'eng'
      ? { path: `${key}/i has went to the store yestarday`, display: 'i has went to the store yestarday' }
      : code === 'fr'
      ? { path: `${key}/je suis alle au magazin hier`, display: 'je suis alle au magazin hier' }
      : { path: `${key}/eu fui ao mecado ontem`, display: 'eu fui ao mecado ontem' },
    resultLabel: 'Corrected (Rule-based)',
    type: 'correct-rules',
  };
}

// 2. /correct-ai-[lang]/ (AI Gemini)
for (const [code, lang] of Object.entries(LANGS)) {
  const key = `correct-ai-${code}`;
  TOOLS[key] = {
    prefix: key,
    label: `Correct ${lang.name} (AI)`,
    description: `Smart rewrite and grammar fix in ${lang.name}`,
    color: code === 'eng' ? '#6366f1' : code === 'fr' ? '#3b82f6' : '#f59e0b',
    flag: lang.flag,
    engine: 'ai',
    example: code === 'eng'
      ? { path: `${key}/i has went to the store yestarday`, display: 'i has went to the store yestarday' }
      : code === 'fr'
      ? { path: `${key}/je suis alle au magazin hier`, display: 'je suis alle au magazin hier' }
      : { path: `${key}/eu fui ao mecado ontem`, display: 'eu fui ao mecado ontem' },
    prompt: (input, extra, shorter) => {
      let p = `You are a grammar and spelling corrector. Your ONLY job is to correct the following sentence in ${lang.name}. Fix grammar, spelling, punctuation, and capitalization errors. Return ONLY the corrected sentence with no explanation, no quotes, no extra text.`;
      if (shorter > 0) p += `\nMake the sentence more concise and brief. Shorten it while keeping the meaning.`;
      if (extra) p += `\nAdditional context from the user: ${extra}`;
      p += `\n\nSentence: ${input}`;
      return p;
    },
    resultLabel: 'Corrected (AI)',
    type: 'correct-ai',
  };
}

// 3. /ai-[lang]/ (Message Creation, AI Gemini)
for (const [code, lang] of Object.entries(LANGS)) {
  const key = `ai-${code}`;
  TOOLS[key] = {
    prefix: key,
    label: `Create ${lang.name} Message (AI)`,
    description: `Write a professional ${lang.name} message from instructions`,
    color: code === 'eng' ? '#10b981' : code === 'fr' ? '#8b5cf6' : '#ef4444',
    flag: lang.flag,
    engine: 'ai',
    example: code === 'eng'
      ? { path: `${key}/vou marcar uma reuniao para dia 30`, display: 'vou marcar uma reunião para dia 30' }
      : code === 'fr'
      ? { path: `${key}/marcar reuniao para dia 30 com o cliente`, display: 'marcar reunião para dia 30 com o cliente' }
      : { path: `${key}/schedule a meeting for the 30th`, display: 'schedule a meeting for the 30th' },
    prompt: (input, extra, shorter) => {
      let p = `You are a professional message writer. The user will give you instructions (possibly in another language). Based on those instructions, write a short, professional, friendly message in ${lang.name} to a work colleague. The message should be natural, polite, and ready to send (like a Slack message or short email). Do NOT include a subject line. Do NOT add any explanation — return ONLY the message text in ${lang.name}, ready to copy and send.`;
      if (shorter > 0) p += `\nIMPORTANT: Make the message MORE CONCISE and SHORTER. Keep it brief and to the point.`;
      if (extra) p += `\nAdditional information to include: ${extra}`;
      p += `\n\nInstructions: ${input}`;
      return p;
    },
    resultLabel: 'Message',
    type: 'message',
  };
}

// --- Engines ---

async function callGemini(promptText) {
  const body = { contents: [{ parts: [{ text: promptText }] }] };
  const res = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function callLanguageTool(text, ltCode) {
  const params = new URLSearchParams({ text: text, language: ltCode });
  const res = await fetch(LT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!res.ok) throw new Error('LanguageTool API failed');
  const data = await res.json();
  const matches = data.matches;
  if (!matches || matches.length === 0) return text;

  // Sort descending by offset to avoid shifting issues when replacing right-to-left
  matches.sort((a, b) => b.offset - a.offset);
  let corrected = text;
  for (const match of matches) {
    if (match.replacements && match.replacements.length > 0) {
      const replacement = match.replacements[0].value;
      corrected = corrected.slice(0, match.offset) + replacement + corrected.slice(match.offset + match.length);
    }
  }
  return corrected;
}

// --- HTML helpers ---
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function css() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0a0a0f; color: #e0e0e8;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background-image:
        radial-gradient(ellipse at 20% 50%, rgba(88, 28, 135, 0.15) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 50%, rgba(15, 82, 186, 0.12) 0%, transparent 60%);
    }

    .container { width: 100%; max-width: 780px; padding: 24px; }

    .card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px; padding: 48px 40px;
      backdrop-filter: blur(20px); animation: fadeIn 0.5s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .logo {
      font-size: 36px; margin-bottom: 8px;
      background: linear-gradient(135deg, #a78bfa, #6366f1);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }

    h1 {
      font-size: 32px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 8px;
      background: linear-gradient(135deg, #f0f0f8, #a0a0b8);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }

    .subtitle { color: #888898; font-size: 15px; line-height: 1.6; margin-bottom: 32px; }

    h2 {
      font-size: 13px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 1.5px; color: #6366f1; margin-bottom: 16px;
    }

    .section-title { margin-top: 24px; }

    /* Tools grid */
    .tools-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px; }

    .tool-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 14px; padding: 16px;
      transition: border-color 0.25s, transform 0.2s;
      cursor: pointer; text-decoration: none; color: inherit; display: block;
    }

    .tool-card:hover { border-color: rgba(99, 102, 241, 0.3); transform: translateY(-2px); }

    .tool-flag { font-size: 24px; margin-bottom: 8px; }
    .tool-name { font-size: 13px; font-weight: 600; color: #e0e0e8; margin-bottom: 4px; }
    .tool-desc { font-size: 11px; color: #777790; line-height: 1.4; }

    .tool-badge {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; padding: 3px 8px; border-radius: 5px;
      display: inline-block; margin-bottom: 8px;
    }

    /* Input form */
    .input-wrapper {
      display: flex; align-items: center;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px; padding: 0 16px;
      transition: border-color 0.2s; flex: 1;
    }

    .input-wrapper:focus-within { border-color: rgba(99, 102, 241, 0.5); }
    .input-prefix { color: #555568; font-size: 14px; font-weight: 500; margin-right: 4px; white-space: nowrap; }

    input {
      flex: 1; background: none; border: none; outline: none;
      color: #e0e0e8; font-size: 15px; font-family: inherit; padding: 14px 0; min-width: 0;
    }

    input::placeholder { color: #44445a; }
    .form-row { display: flex; gap: 10px; }

    select {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px; padding: 12px 14px;
      color: #e0e0e8; font-size: 14px; font-family: inherit;
      cursor: pointer; outline: none; transition: border-color 0.2s;
    }

    select:focus { border-color: rgba(99, 102, 241, 0.5); }
    select option { background: #1a1a2e; color: #e0e0e8; }

    button, .btn {
      border: none; border-radius: 12px;
      padding: 14px 24px; font-size: 14px; font-weight: 600;
      font-family: inherit; cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s, background 0.2s;
      white-space: nowrap; text-decoration: none; display: inline-flex;
      align-items: center; justify-content: center;
    }

    .btn-primary {
      background: linear-gradient(135deg, #6366f1, #7c3aed); color: white;
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
    }

    .copy-btn {
      width: 100%; margin-bottom: 16px;
      background: rgba(99, 102, 241, 0.12);
      color: #a78bfa; border: 1px solid rgba(99, 102, 241, 0.2);
    }

    .copy-btn:hover { background: rgba(99, 102, 241, 0.2); }

    /* +/- action buttons */
    .action-row {
      display: flex; gap: 10px; margin-bottom: 24px;
    }

    .btn-minus, .btn-plus {
      flex: 1; padding: 12px; font-size: 18px; font-weight: 700;
      border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);
      cursor: pointer; transition: all 0.2s; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }

    .btn-minus {
      background: rgba(239, 68, 68, 0.1); color: #f87171;
      border-color: rgba(239, 68, 68, 0.2);
    }

    .btn-minus:hover { background: rgba(239, 68, 68, 0.2); transform: translateY(-1px); }

    .btn-plus {
      background: rgba(16, 185, 129, 0.1); color: #34d399;
      border-color: rgba(16, 185, 129, 0.2);
    }

    .btn-plus:hover { background: rgba(16, 185, 129, 0.2); transform: translateY(-1px); }

    .btn-minus .btn-label, .btn-plus .btn-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
    }

    .extra-panel {
      display: none; margin-bottom: 16px;
      animation: slideDown 0.3s ease;
    }

    .extra-panel.visible { display: block; }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .extra-panel .form-row { margin-top: 0; }

    /* Result page */
    .back-link {
      color: #6366f1; text-decoration: none; font-size: 14px; font-weight: 500;
      display: inline-block; margin-bottom: 28px; transition: color 0.2s;
    }

    .back-link:hover { color: #818cf8; }

    .result-section { margin-bottom: 8px; }

    .label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 1.5px; color: #555568; display: block; margin-bottom: 10px;
    }

    .result-label { color: #6366f1; }
    .text { font-size: 20px; line-height: 1.6; font-weight: 400; }
    .original-text { color: #666678; font-size: 16px; }
    .result-text { color: #f0f0f8; font-weight: 500; white-space: pre-wrap; }

    .divider { display: flex; align-items: center; justify-content: center; padding: 16px 0; }
    .divider-icon { font-size: 20px; color: #6366f1; }

    .result-card { padding: 36px 40px; }
    .inline-form { border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 24px; }

    .tool-header-row {
      display: flex; align-items: center; gap: 12px; margin-bottom: 24px;
    }

    .loading-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(10,10,15,0.7); backdrop-filter: blur(4px);
      z-index: 100; align-items: center; justify-content: center;
    }

    .loading-overlay.visible { display: flex; }

    .spinner {
      width: 40px; height: 40px; border: 3px solid rgba(99,102,241,0.2);
      border-top-color: #6366f1; border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    footer { text-align: center; font-size: 12px; color: #33334a; margin-top: 20px; }

    @media (max-width: 500px) {
      .card { padding: 32px 24px; }
      h1 { font-size: 26px; }
      .form-row { flex-direction: column; }
      .tools-grid { grid-template-columns: 1fr; }
    }
  `;
}

// --- Pages ---

function landingPage() {
  const ltTools = Object.entries(TOOLS).filter(([,t]) => t.type === 'correct-rules');
  const aiCorrectTools = Object.entries(TOOLS).filter(([,t]) => t.type === 'correct-ai');
  const msgTools = Object.entries(TOOLS).filter(([,t]) => t.type === 'message');

  const toolCard = ([key, t]) => `
    <a href="/${t.example.path}" class="tool-card" id="tool-${key}">
      <span class="tool-badge" style="background:${t.color}22;color:${t.color};">/${t.prefix}</span>
      <div class="tool-flag">${t.flag}</div>
      <div class="tool-name">${escapeHtml(t.label)}</div>
      <div class="tool-desc">${escapeHtml(t.description)}</div>
    </a>`;

  const selectOptions = Object.entries(TOOLS).map(([key, t]) =>
    `<option value="${key}">/${t.prefix}</option>`
  ).join('\n            ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Correct — AI & Rules Writing Tools</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${css()}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">✦</div>
      <h1>Correct</h1>
      <p class="subtitle">AI & Rule-based writing tools in your URL bar. Pick a tool and type your text.</p>

      <h2>Correction (AI - Context Aware)</h2>
      <div class="tools-grid">
        ${aiCorrectTools.map(toolCard).join('')}
      </div>

      <h2 class="section-title">Correction (Rules - LanguageTool)</h2>
      <div class="tools-grid">
        ${ltTools.map(toolCard).join('')}
      </div>

      <h2 class="section-title">Create messages (AI)</h2>
      <div class="tools-grid">
        ${msgTools.map(toolCard).join('')}
      </div>

      <form id="input-form" onsubmit="go(event)" style="margin-top:28px;">
        <div class="form-row">
          <select id="tool-select">
            ${selectOptions}
          </select>
          <div class="input-wrapper">
            <input type="text" id="prompt-input" placeholder="Type your text..." autofocus autocomplete="off">
          </div>
          <button type="submit" class="btn btn-primary" id="go-btn">Go →</button>
        </div>
      </form>
    </div>
    <footer>Powered by Google Gemini & LanguageTool</footer>
  </div>
  <script>
    function go(e) {
      e.preventDefault();
      const v = document.getElementById('prompt-input').value.trim();
      const tool = document.getElementById('tool-select').value;
      if (!v) return;
      const prefix = TOOLS[tool] || tool;
      window.location.href = '/' + prefix + '/' + encodeURIComponent(v);
    }
    const TOOLS = {${Object.entries(TOOLS).map(([k,t]) => `'${k}':'${t.prefix}'`).join(',')}};
  </script>
</body>
</html>`;
}

function resultPage(toolKey, original, result, shorter, extra) {
  const t = TOOLS[toolKey];
  const toolPrefix = '/' + t.prefix;
  const encodedOriginal = encodeURIComponent(original);
  const currentShorter = shorter || 0;

  // Build shorter URL — same path, add ?shorter=N+1, preserve extra if any
  let shorterParams = `shorter=${currentShorter + 1}`;
  if (extra) shorterParams += `&extra=${encodeURIComponent(extra)}`;
  const shorterUrl = `${toolPrefix}/${encodedOriginal}?${shorterParams}`;

  const isAI = t.engine === 'ai';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(t.resultLabel)} — Correct</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${css()}</style>
</head>
<body>
  <div class="loading-overlay" id="loading">
    <div class="spinner"></div>
  </div>

  <div class="container">
    <div class="card result-card">
      <a href="/" class="back-link" id="back-link">← Back</a>

      <div class="tool-header-row">
        <span class="tool-badge" style="background:${t.color}22;color:${t.color};">/${t.prefix}</span>
        <span style="font-size:16px;font-weight:600;color:#e0e0e8;">${t.flag} ${escapeHtml(t.label)}</span>
      </div>

      <div class="result-section">
        <span class="label">Input</span>
        <p class="text original-text" id="original-text">${escapeHtml(original)}</p>
      </div>

      <div class="divider"><span class="divider-icon">⟱</span></div>

      <div class="result-section">
        <span class="label result-label">${escapeHtml(t.resultLabel)}</span>
        <p class="text result-text" id="result-text">${escapeHtml(result)}</p>
      </div>

      <button class="copy-btn" id="copy-btn" onclick="copyText()">Copy result</button>

      ${isAI ? `
      <div class="action-row">
        <a href="${escapeHtml(shorterUrl)}" class="btn-minus" id="btn-shorter" onclick="showLoading()">
          <span>−</span>
          <span class="btn-label">Shorter</span>
        </a>
        <button class="btn-plus" id="btn-more" onclick="toggleExtra()">
          <span>+</span>
          <span class="btn-label">Add info</span>
        </button>
      </div>

      <div class="extra-panel" id="extra-panel">
        <form onsubmit="submitExtra(event)">
          <div class="form-row">
            <div class="input-wrapper">
              <input type="text" id="extra-input" placeholder="Add more details..." autocomplete="off">
            </div>
            <button type="submit" class="btn btn-primary">Send →</button>
          </div>
        </form>
      </div>
      ` : ''}

      <form class="inline-form" onsubmit="goNew(event)">
        <div class="form-row">
          <div class="input-wrapper">
            <span class="input-prefix">${escapeHtml(toolPrefix)}/</span>
            <input type="text" id="prompt-input" placeholder="Try another..." autocomplete="off">
          </div>
          <button type="submit" class="btn btn-primary">Go →</button>
        </div>
      </form>
    </div>
    <footer>Powered by Google Gemini & LanguageTool</footer>
  </div>
  <script>
    const TOOL_PREFIX = '${t.prefix}';
    const ORIGINAL = '${encodedOriginal}';
    const CURRENT_EXTRA = ${JSON.stringify(extra || '')};

    function copyText() {
      const text = document.getElementById('result-text').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy result', 2000);
      });
    }

    function showLoading() {
      document.getElementById('loading').classList.add('visible');
    }

    function toggleExtra() {
      const panel = document.getElementById('extra-panel');
      panel.classList.toggle('visible');
      if (panel.classList.contains('visible')) {
        document.getElementById('extra-input').focus();
      }
    }

    function submitExtra(e) {
      e.preventDefault();
      const extraVal = document.getElementById('extra-input').value.trim();
      if (!extraVal) return;
      showLoading();
      // Combine existing extra with new extra
      const allExtra = CURRENT_EXTRA ? CURRENT_EXTRA + '. ' + extraVal : extraVal;
      window.location.href = '/' + TOOL_PREFIX + '/' + ORIGINAL + '?extra=' + encodeURIComponent(allExtra);
    }

    function goNew(e) {
      e.preventDefault();
      const v = document.getElementById('prompt-input').value.trim();
      if (v) {
        showLoading();
        window.location.href = '/' + TOOL_PREFIX + '/' + encodeURIComponent(v);
      }
    }
  </script>
</body>
</html>`;
}

function errorPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error — Correct</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${css()}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo" style="background:linear-gradient(135deg,#f87171,#ef4444);-webkit-background-clip:text;background-clip:text;">✕</div>
      <h1>Something went wrong</h1>
      <p class="subtitle">${escapeHtml(message)}</p>
      <a href="/" class="back-link" style="display:block;text-align:center;margin-top:20px;" id="home-link">← Go home</a>
    </div>
  </div>
</body>
</html>`;
}

// --- Route matching ---

function matchRoute(path) {
  // Sort by prefix length descending so longer prefixes match first (e.g. /correct-ai-pt/ before /correct-pt/)
  const sorted = Object.entries(TOOLS).sort((a, b) => b[1].prefix.length - a[1].prefix.length);

  for (const [key, tool] of sorted) {
    const prefix = '/' + tool.prefix + '/';
    if (path.startsWith(prefix)) {
      const prompt = path.slice(prefix.length).trim();
      return prompt ? { tool: key, prompt } : null;
    }
  }

  return null;
}

// --- Server ---

const handler = async (req, res) => {
  // Fix Vercel URL mapping
  const host = req.headers.host || `localhost:${PORT}`;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const url = new URL(req.url, `${protocol}://${host}`);
  const path = decodeURIComponent(url.pathname);

  if (path === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (path === '/' || path === '') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(landingPage());
    return;
  }

  const route = matchRoute(path);

  if (!route) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(landingPage());
    return;
  }

  const tool = TOOLS[route.tool];
  const shorter = parseInt(url.searchParams.get('shorter') || '0', 10);
  const extra = url.searchParams.get('extra') || '';

  try {
    let result;
    if (tool.engine === 'ai') {
      const promptText = tool.prompt(route.prompt, extra, shorter);
      result = await callGemini(promptText);
    } else if (tool.engine === 'languagetool') {
      result = await callLanguageTool(route.prompt, tool.ltCode);
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(resultPage(route.tool, route.prompt, result, shorter, extra));
  } catch (err) {
    console.error('API error:', err.message);
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(errorPage('Could not reach the correction service. Check logs and try again.'));
  }
};

// Se não estiver a correr no Vercel, inicia o servidor localmente
if (!process.env.VERCEL) {
  const server = createServer(handler);
  server.listen(PORT, () => {
    console.log(`✦ Correct is running at http://localhost:${PORT}`);
  });
}

// Exportar para o Vercel Serverless Functions
export default handler;
