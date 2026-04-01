// Dashboard HTML generator — Le Bourlingueur branded

function getDashboardHTML(serverUrl) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Le Bourlingueur — Marketing WhatsApp</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --teal: #0d5a5c;
  --teal-light: #0f7275;
  --teal-dark: #094243;
  --magenta: #f542c8;
  --magenta-light: #f76dd6;
  --bg: #fafafa;
  --card: #ffffff;
  --text: #1a1a2e;
  --text-secondary: #64748b;
  --border: #e8ecf0;
  --success: #059669;
  --warning: #d97706;
  --danger: #dc2626;
  --info: #0d5a5c;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Poppins', -apple-system, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }

/* Login overlay */
.login-overlay {
  position: fixed; inset: 0; background: linear-gradient(135deg, var(--teal-dark) 0%, var(--teal) 50%, var(--teal-light) 100%);
  z-index: 500; display: flex; align-items: center; justify-content: center;
}
.login-overlay.hidden { display: none; }
.login-box {
  background: var(--card); border-radius: 16px; padding: 40px; width: 380px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center;
}
.login-box h2 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
.login-box .subtitle { font-size: 13px; color: var(--text-secondary); margin-bottom: 24px; }
.login-box input {
  width: 100%; padding: 12px 16px; border: 1px solid var(--border); border-radius: 8px;
  font-family: 'Poppins', sans-serif; font-size: 14px; margin-bottom: 12px;
}
.login-box input:focus { outline: none; border-color: var(--teal); box-shadow: 0 0 0 3px rgba(13,90,92,0.1); }
.login-box .login-btn {
  width: 100%; padding: 12px; background: var(--teal); color: #fff; border: none;
  border-radius: 8px; font-family: 'Poppins', sans-serif; font-size: 14px;
  font-weight: 600; cursor: pointer; transition: background 0.2s;
}
.login-box .login-btn:hover { background: var(--teal-light); }
.login-box .login-error { color: var(--danger); font-size: 12px; margin-top: 8px; min-height: 18px; }

/* Header */
.header {
  background: linear-gradient(135deg, var(--teal-dark) 0%, var(--teal) 50%, var(--teal-light) 100%);
  padding: 0 32px; height: 64px; display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 12px rgba(13,90,92,0.15);
}
.header .logo { display: flex; align-items: center; gap: 12px; }
.header .logo-icon {
  width: 32px; height: 32px; background: rgba(255,255,255,0.15); border-radius: 8px;
  display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.header h1 { font-size: 17px; font-weight: 600; color: #fff; letter-spacing: -0.3px; }
.header .right { display: flex; align-items: center; gap: 16px; }
.live-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #34d399; box-shadow: 0 0 8px #34d399;
  animation: livePulse 2s ease-in-out infinite;
}
@keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.85)} }
.header .live { display: flex; align-items: center; gap: 6px; font-size: 12px; color: rgba(255,255,255,0.8); font-weight: 500; }
.refresh-btn {
  background: rgba(255,255,255,0.15); color: #fff;
  border: 1px solid rgba(255,255,255,0.2);
  padding: 6px 14px; border-radius: 6px; font-weight: 500;
  cursor: pointer; font-size: 12px; font-family: 'Poppins', sans-serif; transition: all 0.2s;
}
.refresh-btn:hover { background: rgba(255,255,255,0.25); }
.last-refresh { font-size: 11px; color: rgba(255,255,255,0.5); }

/* Container */
.container { max-width: 1360px; margin: 0 auto; padding: 24px; }

/* Date filter bar */
.date-filter-bar {
  display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
  background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 10px 18px;
}
.date-filter-bar label { font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.date-filter-bar select {
  padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px;
  font-family: 'Poppins', sans-serif; font-size: 13px; background: #fff; cursor: pointer;
}
.date-filter-bar select:focus { outline: none; border-color: var(--teal); }
.date-filter-bar .date-range-info { font-size: 11px; color: var(--text-secondary); margin-left: auto; }

/* KPI Grid */
.kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 24px; }
.kpi {
  background: var(--card); border-radius: 12px; padding: 18px 20px;
  border: 1px solid var(--border); transition: transform 0.15s, box-shadow 0.15s;
  position: relative; overflow: hidden;
}
.kpi:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
.kpi::before { content: ''; position: absolute; top: 0; left: 0; width: 3px; height: 100%; border-radius: 3px 0 0 3px; }
.kpi.teal::before { background: var(--teal); }
.kpi.green::before { background: var(--success); }
.kpi.red::before { background: var(--danger); }
.kpi.orange::before { background: var(--warning); }
.kpi.magenta::before { background: var(--magenta); }
.kpi .label { font-size: 11px; font-weight: 500; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }
.kpi .value { font-size: 28px; font-weight: 700; color: var(--text); line-height: 1.1; }
.kpi.teal .value { color: var(--teal); }
.kpi.green .value { color: var(--success); }
.kpi.red .value { color: var(--danger); }
.kpi.orange .value { color: var(--warning); }
.kpi.magenta .value { color: var(--magenta); }
.kpi .sub { font-size: 11px; color: var(--text-secondary); margin-top: 4px; font-weight: 400; }

/* Cards */
.card { background: var(--card); border-radius: 12px; border: 1px solid var(--border); margin-bottom: 20px; overflow: hidden; }
.card-header { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
.card-header h2 { font-size: 14px; font-weight: 600; color: var(--text); }
.card-body { padding: 18px 20px; }

/* Tables */
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 10px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.6px; padding: 8px 10px; border-bottom: 2px solid var(--border); }
td { padding: 10px; font-size: 13px; border-bottom: 1px solid #f3f4f6; font-weight: 400; }
tr:hover td { background: #f8fafb; }

/* Badges */
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.2px; }
.badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; }
.badge.sent { background: #ecfdf5; color: #047857; }
.badge.sent::before { background: #059669; }
.badge.queued { background: #eff6ff; color: var(--teal); }
.badge.queued::before { background: var(--teal); }
.badge.failed { background: #fef2f2; color: #b91c1c; }
.badge.failed::before { background: #dc2626; }
.badge.cancelled { background: #f4f4f5; color: #52525b; }
.badge.cancelled::before { background: #71717a; }
.badge.converted { background: #ecfdf5; color: #047857; }
.badge.converted::before { background: #059669; }
.badge.abandoned { background: #fff7ed; color: #c2410c; }
.badge.abandoned::before { background: #ea580c; }
.badge.APPROVED { background: #ecfdf5; color: #047857; }
.badge.APPROVED::before { background: #059669; }
.badge.PENDING { background: #fffbeb; color: #92400e; }
.badge.PENDING::before { background: #d97706; }
.badge.REJECTED { background: #fef2f2; color: #b91c1c; }
.badge.REJECTED::before { background: #dc2626; }
.badge.optout { background: #fef2f2; color: #b91c1c; }
.badge.optout::before { background: #dc2626; }
.badge.received { background: #eff6ff; color: var(--teal); }
.badge.received::before { background: var(--teal); }

/* Flows */
.flow-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background 0.15s; }
.flow-row:last-child { border: none; }
.flow-row:hover { background: #f8fafb; margin: 0 -20px; padding-left: 20px; padding-right: 20px; }
.flow-icon { font-size: 20px; margin-right: 12px; }
.flow-info { display: flex; align-items: center; flex: 1; }
.flow-name { font-weight: 600; font-size: 14px; }
.flow-desc { font-size: 12px; color: var(--text-secondary); margin-top: 1px; }
.flow-arrow { color: var(--text-secondary); font-size: 18px; margin-right: 16px; }
.toggle { position: relative; width: 46px; height: 26px; cursor: pointer; }
.toggle input { display: none; }
.toggle .slider { position: absolute; inset: 0; background: #d1d5db; border-radius: 13px; transition: 0.25s; }
.toggle .slider:before { content: ''; position: absolute; width: 20px; height: 20px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.25s; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
.toggle input:checked + .slider { background: var(--teal); }
.toggle input:checked + .slider:before { transform: translateX(20px); }

/* Charts */
.chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.bar-chart { display: flex; align-items: flex-end; gap: 4px; height: 110px; }
.bar { display: flex; flex-direction: column; align-items: center; flex: 1; }
.bar-fill { width: 100%; border-radius: 4px 4px 0 0; min-height: 2px; transition: height 0.4s ease; }
.bar-label { font-size: 9px; color: var(--text-secondary); margin-top: 4px; font-weight: 500; }
.bar-value { font-size: 9px; color: var(--text-secondary); margin-bottom: 2px; font-weight: 600; }

/* Tabs */
.tabs { display: flex; gap: 0; border-bottom: 2px solid var(--border); margin-bottom: 16px; }
.tab { padding: 8px 20px; font-size: 13px; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; font-family: 'Poppins', sans-serif; background: none; border-top: none; border-left: none; border-right: none; }
.tab:hover { color: var(--teal); }
.tab.active { color: var(--teal); border-bottom-color: var(--teal); font-weight: 600; }
.tab-content { display: none; }
.tab-content.active { display: block; }

/* Modal */
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; backdrop-filter: blur(2px); }
.modal-overlay.open { display: flex; align-items: center; justify-content: center; }
.modal { background: var(--card); border-radius: 16px; width: 90%; max-width: 800px; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
.modal-header { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: var(--card); z-index: 1; border-radius: 16px 16px 0 0; }
.modal-header h2 { font-size: 16px; font-weight: 700; }
.modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); padding: 4px 8px; border-radius: 6px; }
.modal-close:hover { background: #f3f4f6; }
.modal-body { padding: 24px; }

/* Template card */
.tpl-card { border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
.tpl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.tpl-name { font-weight: 600; font-size: 13px; color: var(--teal); }
.tpl-body { background: #f8fafb; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; margin-bottom: 10px; }
.tpl-edit textarea { width: 100%; min-height: 100px; border: 1px solid var(--border); border-radius: 8px; padding: 12px; font-family: 'Poppins', sans-serif; font-size: 13px; resize: vertical; line-height: 1.6; }
.tpl-edit textarea:focus { outline: none; border-color: var(--teal); box-shadow: 0 0 0 3px rgba(13,90,92,0.1); }
.tpl-actions { display: flex; gap: 8px; align-items: center; }
.btn { padding: 7px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Poppins', sans-serif; border: none; transition: all 0.2s; }
.btn-primary { background: var(--teal); color: #fff; }
.btn-primary:hover { background: var(--teal-light); }
.btn-secondary { background: #f3f4f6; color: var(--text); border: 1px solid var(--border); }
.btn-secondary:hover { background: #e8ecf0; }
.btn-magenta { background: var(--magenta); color: #fff; }
.btn-magenta:hover { background: var(--magenta-light); }
.btn-danger { background: var(--danger); color: #fff; }
.btn-danger:hover { background: #b91c1c; }
.btn-sm { padding: 4px 10px; font-size: 11px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-export { background: #f3f4f6; color: var(--text); border: 1px solid var(--border); padding: 4px 10px; font-size: 11px; }
.btn-export:hover { background: #e8ecf0; }

/* Alert badge */
.alert-bell { position: relative; cursor: pointer; font-size: 18px; background: none; border: none; color: rgba(255,255,255,0.8); padding: 4px; }
.alert-bell:hover { color: #fff; }
.alert-badge { position: absolute; top: -4px; right: -6px; background: var(--danger); color: #fff; font-size: 9px; font-weight: 700; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 4px; }

/* Timeline modal */
.timeline-item { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
.timeline-item:last-child { border: none; }
.timeline-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
.timeline-dot.out { background: var(--teal); }
.timeline-dot.in { background: var(--magenta); }

/* Warning banner */
.warning-banner { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #92400e; margin-bottom: 16px; display: flex; align-items: flex-start; gap: 8px; }
.warning-banner strong { font-weight: 700; }

/* Status message */
.status-msg { font-size: 12px; padding: 4px 0; }
.status-msg.ok { color: var(--success); }
.status-msg.err { color: var(--danger); }

/* Contacts */
.contacts-toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
.contacts-toolbar select {
  padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px;
  font-family: 'Poppins', sans-serif; font-size: 12px; background: #fff;
}
.tag-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; background: #eff6ff; color: var(--teal); margin: 0 2px; }

/* Form styles */
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 4px; }
.form-group input, .form-group select { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-family: 'Poppins', sans-serif; font-size: 13px; }
.form-group input:focus { outline: none; border-color: var(--teal); box-shadow: 0 0 0 3px rgba(13,90,92,0.1); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

@media (max-width: 1200px) { .kpi-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 768px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .chart-grid { grid-template-columns: 1fr; }
  .header { padding: 0 16px; }
  .container { padding: 16px; }
  .modal { width: 96%; }
  .form-row { grid-template-columns: 1fr; }
  .date-filter-bar { flex-wrap: wrap; }
}
</style>
</head>
<body>

<!-- Login overlay -->
<div class="login-overlay hidden" id="loginOverlay">
  <div class="login-box">
    <div style="font-size:32px;margin-bottom:12px">LB</div>
    <h2>Le Bourlingueur</h2>
    <div class="subtitle">Marketing WhatsApp — Acces Dashboard</div>
    <input type="email" id="loginEmail" placeholder="Email" onkeydown="if(event.key==='Enter')document.getElementById('loginPassword').focus()">
    <input type="password" id="loginPassword" placeholder="Mot de passe" onkeydown="if(event.key==='Enter')doLogin()">
    <button class="login-btn" onclick="doLogin()">Se connecter</button>
    <div class="login-error" id="loginError"></div>
  </div>
</div>

<div class="header">
  <div class="logo">
    <div class="logo-icon">LB</div>
    <h1>Le Bourlingueur — Marketing WhatsApp</h1>
  </div>
  <div class="right">
    <div class="live"><div class="live-dot"></div> Production</div>
    <button class="alert-bell" onclick="openAlertModal()" title="Alertes">&#128276;<span class="alert-badge" id="alertBadge" style="display:none">0</span></button>
    <span class="last-refresh" id="lastRefresh"></span>
    <button class="refresh-btn" onclick="loadAll()">Actualiser</button>
  </div>
</div>

<div class="container">
  <!-- Date filter -->
  <div class="date-filter-bar">
    <label>Periode :</label>
    <select id="dateRange" onchange="onDateRangeChange()">
      <option value="all">Tout</option>
      <option value="today">Aujourd'hui</option>
      <option value="7d" selected>7 derniers jours</option>
      <option value="30d">30 derniers jours</option>
      <option value="90d">90 derniers jours</option>
    </select>
    <span class="date-range-info" id="dateRangeInfo"></span>
  </div>

  <div class="kpi-grid" id="kpiGrid"></div>

  <!-- Couts & ROI -->
  <div class="card" style="border-left:4px solid var(--magenta)">
    <div class="card-header">
      <h2>&#128176; Couts & ROI WhatsApp</h2>
      <span style="font-size:11px;color:var(--text-secondary)" id="costPerMsg"></span>
    </div>
    <div class="card-body" id="costCard">
      <div style="color:var(--text-secondary);font-size:13px">Chargement...</div>
    </div>
  </div>

  <div class="chart-grid">
    <div class="card">
      <div class="card-header"><h2>Messages par flow</h2></div>
      <div class="card-body" id="flowChart"></div>
    </div>
    <div class="card">
      <div class="card-header"><h2>Heures d envoi</h2></div>
      <div class="card-body" id="hourlyChart"></div>
    </div>
  </div>

  <!-- Stats par template -->
  <div class="card">
    <div class="card-header">
      <h2>&#128202; Performance par template</h2>
      <span style="font-size:11px;color:var(--text-secondary)">KPIs detailles par message et par flow</span>
    </div>
    <div class="card-body" id="templateStats">
      <div style="color:var(--text-secondary);font-size:13px">Chargement...</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h2>&#9878; A/B Test — Images produit (Panier abandonne)</h2>
    </div>
    <div class="card-body" id="abTestResults">
      <div style="color:var(--text-secondary);font-size:13px">Chargement des resultats A/B...</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h2>Automatisations</h2>
      <span style="font-size:11px;color:var(--text-secondary)">Cliquer pour voir/modifier les templates</span>
    </div>
    <div class="card-body" id="flowControls"></div>
  </div>

  <div class="card">
    <div class="card-header">
      <h2>&#128227; Campagnes push</h2>
      <button class="btn btn-magenta" onclick="openCampaignModal()">+ Nouvelle campagne</button>
    </div>
    <div class="card-body" id="campaignsList">
      <div style="color:var(--text-secondary);font-size:13px">Chargement...</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h2>Donnees</h2>
      <div style="display:flex;gap:6px">
        <button class="btn btn-export" onclick="window.open('/api/export/contacts')">&#128229; Contacts</button>
        <button class="btn btn-export" onclick="window.open('/api/export/messages')">&#128229; Messages</button>
        <button class="btn btn-export" onclick="window.open('/api/export/stats')">&#128229; Stats</button>
      </div>
    </div>
    <div class="card-body">
      <div class="tabs">
        <button class="tab active" onclick="switchTab('checkouts',this)">Paniers</button>
        <button class="tab" onclick="switchTab('messages',this)">Messages</button>
        <button class="tab" onclick="switchTab('contacts',this)">Contacts</button>
        <button class="tab" onclick="switchTab('incoming',this)">Reponses</button>
      </div>
      <div class="tab-content active" id="tab-checkouts">
        <table id="checkoutsTable">
          <thead><tr><th>Date</th><th>Client</th><th>Email</th><th>Tel</th><th>Montant</th><th>Articles</th><th>Statut</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="tab-content" id="tab-messages">
        <table id="messagesTable">
          <thead><tr><th>Cree</th><th>Prevu</th><th>Tel</th><th>Flow</th><th>Template</th><th>Statut</th><th>Envoye</th><th>Erreur</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="tab-content" id="tab-contacts">
        <div class="contacts-toolbar">
          <select id="segmentFilter" onchange="loadContacts()">
            <option value="all">Tous les contacts</option>
          </select>
          <button class="btn btn-primary" onclick="openAddContactModal()">+ Ajouter un contact</button>
          <span style="font-size:12px;color:var(--text-secondary)" id="contactCount"></span>
        </div>
        <table id="contactsTable">
          <thead><tr><th>Prenom</th><th>Nom</th><th>Telephone</th><th>Email</th><th>Tags</th><th>Source</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="tab-content" id="tab-incoming">
        <table id="incomingTable">
          <thead><tr><th>Date</th><th>Telephone</th><th>Message</th><th>Statut</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- Modal -->
<div class="modal-overlay" id="modalOverlay" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <div class="modal-header">
      <h2 id="modalTitle">Templates</h2>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body" id="modalBody"></div>
  </div>
</div>

<script>
const SERVER='';
let allTemplates=[];
let isTestMode=false;
let waCost=0.08;
let needsAuth=false;

// ─── Date range ──────────────────────────────────
function getDateRange(){
  const sel=document.getElementById('dateRange').value;
  if(sel==='all') return {};
  const to=new Date();
  let from=new Date();
  if(sel==='today'){from.setHours(0,0,0,0);}
  else if(sel==='7d'){from.setDate(from.getDate()-7);}
  else if(sel==='30d'){from.setDate(from.getDate()-30);}
  else if(sel==='90d'){from.setDate(from.getDate()-90);}
  return {from:from.toISOString().split('.')[0],to:to.toISOString().split('.')[0]};
}
function dateParams(){
  const r=getDateRange();
  const p=new URLSearchParams();
  if(r.from)p.set('from',r.from);
  if(r.to)p.set('to',r.to);
  const s=p.toString();
  return s?'&'+s:'';
}
function onDateRangeChange(){
  const r=getDateRange();
  const info=document.getElementById('dateRangeInfo');
  if(r.from){
    const fd=new Date(r.from);
    info.textContent=fd.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})+' — Maintenant';
  }else{
    info.textContent='Toutes les donnees';
  }
  loadAll();
}

// ─── Auth ────────────────────────────────────────
async function checkAuth(){
  try{
    const res=await fetch(SERVER+'/api/stats');
    if(res.status===401){showLogin();return false;}
    return true;
  }catch(e){return true;}
}
function showLogin(){
  document.getElementById('loginOverlay').classList.remove('hidden');
  needsAuth=true;
  setTimeout(()=>document.getElementById('loginEmail').focus(),100);
}
async function doLogin(){
  const em=document.getElementById('loginEmail').value;
  const pw=document.getElementById('loginPassword').value;
  const err=document.getElementById('loginError');
  if(!em||!pw){err.textContent='Remplissez tous les champs';return;}
  try{
    const res=await fetch(SERVER+'/api/login',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:em,password:pw})
    });
    if(res.ok){
      document.getElementById('loginOverlay').classList.add('hidden');
      needsAuth=false;
      loadAll();
    }else{
      err.textContent='Mot de passe incorrect';
    }
  }catch(e){err.textContent='Erreur de connexion';}
}

// ─── Utilities ───────────────────────────────────
async function api(p){
  const sep=p.includes('?')?'&':'?';
  const url=SERVER+p+(p.includes('from=')?'':sep.substring(0,0));
  const res=await fetch(SERVER+p);
  if(res.status===401){showLogin();throw new Error('Auth required');}
  return res.json();
}
function fmtDate(d){if(!d)return'-';const dt=new Date(d.replace(' ','T')+(d.includes('Z')?'':'Z'));return dt.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function badge(s){const labels={sent:'Envoye',queued:'En attente',failed:'Echoue',cancelled:'Annule',converted:'Recupere',abandoned:'Abandonne',APPROVED:'Approuve',PENDING:'En review',REJECTED:'Rejete'};return '<span class="badge '+s+'">'+(labels[s]||s)+'</span>'}
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function switchTab(name,el){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-'+name).classList.add('active');
  if(name==='contacts') loadContacts();
  if(name==='incoming') loadIncoming();
}

const FLOW_TEMPLATES={
  abandoned_cart:['panier_rappel_1','panier_rappel_2','panier_rappel_promo'],
  upsell:['post_purchase_upsell'],
  winback:['winback_news','winback_offer_15','winback_offer_20'],
  review:['demande_avis'],
  birthday:['birthday_wish']
};

// ─── Main load ───────────────────────────────────
async function loadAll(){
  try{
    document.getElementById('lastRefresh').textContent=new Date().toLocaleTimeString('fr-FR');
    const dp=dateParams();
    const s=await api('/api/stats?_=1'+dp);
    isTestMode=!!s.test_mode;
    waCost=s.wa_cost||0.08;
    const rev=(s.revenue_recovered||0);
    const totalCost=((s.messages_sent||0)*waCost);
    const roi=totalCost>0?((rev/totalCost)).toFixed(1):'--';
    document.getElementById('kpiGrid').innerHTML=[
      kpi('Messages envoyes',s.messages_sent||0,'','teal'),
      kpi('En attente / Echoues',(s.messages_queued||0)+' / '+(s.messages_failed||0),'','orange'),
      kpi('Paniers recuperes',s.recovered_checkouts||0,(s.recovery_rate||0)+'% sur '+(s.total_checkouts||0)+' detectes','green'),
      kpi('CA recupere',rev.toFixed(0)+' EUR','ROI: x'+roi,'magenta'),
      kpi('Cout WhatsApp',totalCost.toFixed(2)+' EUR',(waCost*100).toFixed(1)+' cts/msg — '+(s.messages_sent||0)+' envois','red'),
    ].join('');
    const bf=await api('/api/messages-by-flow?_=1'+dp);renderFlowChart(bf);
    const hr=await api('/api/hourly-distribution?_=1'+dp);renderHourly(hr);
    const fl=await api('/api/flows');renderFlows(fl);
    const ck=await api('/api/checkouts?limit=40'+dp);renderCheckouts(ck);
    const ms=await api('/api/messages?limit=60'+dp);renderMessages(ms);
    try{const t=await api('/api/templates');if(Array.isArray(t))allTemplates=t;}catch(e){}
    let campaigns=[];
    try{campaigns=await api('/api/campaigns');renderCampaigns(campaigns);}catch(e){}
    try{const ab=await api('/api/ab-results');renderABTest(ab);}catch(e){}
    try{const ts=await api('/api/template-stats?_=1'+dp);const fc=await api('/api/flow-conversion-stats?_=1'+dp);renderTemplateStats(ts,fc);}catch(e){}
    // Render cost card with all data
    renderCostCard(s, bf, campaigns);
  }catch(err){
    if(err.message==='Auth required')return;
    console.error('Dashboard error:',err);
    document.getElementById('kpiGrid').innerHTML='<div style="padding:20px;color:#dc2626">Erreur de chargement: '+err.message+'</div>';
  }
}

function kpi(l,v,sub,c){return '<div class="kpi '+c+'"><div class="label">'+l+'</div><div class="value">'+v+'</div>'+(sub?'<div class="sub">'+sub+'</div>':'')+'</div>'}

// ─── Couts & ROI card ───────────────────────────
function renderCostCard(stats, flowData, campaigns){
  const el=document.getElementById('costCard');
  const totalSent=stats.messages_sent||0;

  if(totalSent===0){
    document.getElementById('costPerMsg').textContent='';
    el.innerHTML='<div style="color:var(--text-secondary);font-size:13px;text-align:center;padding:16px">Aucun message envoye — les couts et le ROI apparaitront ici des le premier envoi.</div>';
    return;
  }

  document.getElementById('costPerMsg').textContent=(waCost*100).toFixed(1)+' centimes / message (Meta WhatsApp FR)';

  // Costs by flow
  const flows={};
  flowData.forEach(r=>{
    if(!flows[r.flow])flows[r.flow]={sent:0,total:0};
    flows[r.flow].total+=r.count;
    if(r.status==='sent')flows[r.flow].sent+=r.count;
  });
  const flowNames={abandoned_cart:'Panier abandonne',upsell:'Upsell post-achat',winback:'Winback',review:'Demande d avis',birthday:'Anniversaire'};

  // Campaign costs
  let campaignCostTotal=0;
  let campaignSentTotal=0;
  (campaigns||[]).forEach(c=>{campaignCostTotal+=c.sent_count*waCost;campaignSentTotal+=c.sent_count;});

  // Totals
  const totalSent=stats.messages_sent||0;
  const totalCost=totalSent*waCost;
  const rev=stats.revenue_recovered||0;
  const roi=totalCost>0?(rev/totalCost):0;
  const costPerConversion=(stats.recovered_checkouts||0)>0?(totalCost/(stats.recovered_checkouts||1)):0;
  const profit=rev-totalCost;

  let h='';

  // Big ROI numbers
  h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px">';
  h+='<div style="text-align:center;padding:16px;background:#fef2f2;border-radius:10px"><div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;font-weight:600;letter-spacing:0.5px;margin-bottom:4px">Cout total</div><div style="font-size:26px;font-weight:700;color:var(--danger)">'+totalCost.toFixed(2)+'<span style="font-size:14px"> EUR</span></div></div>';
  h+='<div style="text-align:center;padding:16px;background:#f0fdf4;border-radius:10px"><div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;font-weight:600;letter-spacing:0.5px;margin-bottom:4px">CA recupere</div><div style="font-size:26px;font-weight:700;color:var(--success)">'+rev.toFixed(0)+'<span style="font-size:14px"> EUR</span></div></div>';
  h+='<div style="text-align:center;padding:16px;background:'+(profit>=0?'#f0fdf4':'#fef2f2')+';border-radius:10px"><div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;font-weight:600;letter-spacing:0.5px;margin-bottom:4px">Profit net</div><div style="font-size:26px;font-weight:700;color:'+(profit>=0?'var(--success)':'var(--danger)')+'">'+profit.toFixed(0)+'<span style="font-size:14px"> EUR</span></div></div>';
  h+='<div style="text-align:center;padding:16px;background:#fdf4ff;border-radius:10px"><div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;font-weight:600;letter-spacing:0.5px;margin-bottom:4px">ROI</div><div style="font-size:26px;font-weight:700;color:var(--magenta)">x'+roi.toFixed(1)+'</div></div>';
  h+='</div>';

  // Detail by flow
  h+='<table><thead><tr><th>Source</th><th>Messages envoyes</th><th>Cout</th><th>% du total</th></tr></thead><tbody>';
  let flowCostTotal=0;
  for(const[k,d]of Object.entries(flows)){
    const cost=d.sent*waCost;
    flowCostTotal+=cost;
    const pct=totalCost>0?Math.round(cost/totalCost*100):0;
    h+='<tr><td style="font-weight:600">'+(flowNames[k]||k)+'</td><td style="text-align:center">'+d.sent+'</td><td style="font-weight:700;color:var(--danger)">'+cost.toFixed(2)+' EUR</td><td><div style="display:flex;align-items:center;gap:6px"><div style="background:#e8ecf0;border-radius:3px;height:8px;width:80px;overflow:hidden"><div style="background:var(--danger);height:100%;width:'+pct+'%"></div></div>'+pct+'%</div></td></tr>';
  }

  // Campaigns row
  if(campaigns&&campaigns.length>0){
    const campPct=totalCost>0?Math.round(campaignCostTotal/totalCost*100):0;
    h+='<tr style="border-top:2px solid var(--border)"><td style="font-weight:600">Campagnes push ('+campaigns.length+')</td><td style="text-align:center">'+campaignSentTotal+'</td><td style="font-weight:700;color:var(--danger)">'+campaignCostTotal.toFixed(2)+' EUR</td><td><div style="display:flex;align-items:center;gap:6px"><div style="background:#e8ecf0;border-radius:3px;height:8px;width:80px;overflow:hidden"><div style="background:var(--magenta);height:100%;width:'+campPct+'%"></div></div>'+campPct+'%</div></td></tr>';
  }

  // Total row
  h+='<tr style="background:#f8fafb;border-top:2px solid var(--teal)"><td style="font-weight:700">TOTAL</td><td style="text-align:center;font-weight:700">'+totalSent+'</td><td style="font-weight:700;color:var(--danger);font-size:15px">'+totalCost.toFixed(2)+' EUR</td><td></td></tr>';
  h+='</tbody></table>';

  // Cost per conversion
  if(stats.recovered_checkouts>0){
    h+='<div style="margin-top:14px;padding:10px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;font-size:12px;color:#92400e">Cout par conversion : <strong>'+costPerConversion.toFixed(2)+' EUR</strong> — pour '+stats.recovered_checkouts+' panier'+(stats.recovered_checkouts>1?'s':'')+' recupere'+(stats.recovered_checkouts>1?'s':'')+'</div>';
  }

  // Campaign detail if any
  if(campaigns&&campaigns.length>0){
    h+='<div style="margin-top:16px"><div style="font-size:12px;font-weight:700;margin-bottom:8px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px">Detail par campagne</div>';
    h+='<table><thead><tr><th>Campagne</th><th>Template</th><th>Envoyes</th><th>Cout</th><th>Statut</th></tr></thead><tbody>';
    campaigns.forEach(c=>{
      const cCost=(c.sent_count*waCost).toFixed(2);
      const st={draft:'En attente',sending:'Envoi...',sent:'Termine',completed:'Termine',cancelled:'Annule'};
      h+='<tr><td style="font-weight:600">'+escHtml(c.name)+'</td><td style="font-size:12px">'+escHtml(c.template)+'</td><td style="text-align:center">'+c.sent_count+' / '+c.target_count+'</td><td style="font-weight:700;color:var(--danger)">'+cCost+' EUR</td><td>'+(st[c.status]||c.status)+'</td></tr>';
    });
    h+='</tbody></table></div>';
  }

  el.innerHTML=h;
}

function renderFlowChart(data){
  const f={};
  data.forEach(r=>{if(!f[r.flow])f[r.flow]={sent:0,queued:0,failed:0,cancelled:0};f[r.flow][r.status]=r.count});
  const names={abandoned_cart:'Panier abandonne',upsell:'Upsell post-achat',winback:'Winback',review:'Demande d avis',birthday:'Anniversaire'};
  let h='<table><thead><tr><th>Flow</th><th>Envoyes</th><th>Attente</th><th>Echoues</th><th>Annules</th><th>Total</th><th>Cout</th></tr></thead><tbody>';
  for(const[k,d]of Object.entries(f)){
    const t=d.sent+d.queued+d.failed+d.cancelled;
    const cost=(d.sent*waCost).toFixed(2);
    h+='<tr><td style="font-weight:600">'+(names[k]||k)+'</td><td>'+badge('sent')+' '+d.sent+'</td><td>'+badge('queued')+' '+d.queued+'</td><td>'+badge('failed')+' '+d.failed+'</td><td>'+badge('cancelled')+' '+d.cancelled+'</td><td style="font-weight:700">'+t+'</td><td style="font-weight:600;color:var(--danger)">'+cost+' EUR</td></tr>';
  }
  h+='</tbody></table>';
  if(Object.keys(f).length===0) h='<div style="color:var(--text-secondary);font-size:13px;padding:10px">Aucun message pour le moment</div>';
  document.getElementById('flowChart').innerHTML=h;
}

function renderHourly(data){
  const hrs=Array(24).fill(0);
  data.forEach(r=>{hrs[r.hour]=r.count});
  const mx=Math.max(...hrs,1);
  let h='<div class="bar-chart">';
  for(let i=0;i<24;i++){
    const p=hrs[i]/mx*100;
    const active=i>=8&&i<21;
    const c=active?'var(--teal)':'#e2e8f0';
    h+='<div class="bar"><div class="bar-value">'+(hrs[i]||'')+'</div><div class="bar-fill" style="height:'+Math.max(p,2)+'%;background:'+c+';opacity:'+(active?1:0.5)+'"></div><div class="bar-label">'+i+'h</div></div>';
  }
  h+='</div><div style="font-size:10px;color:var(--text-secondary);margin-top:8px">Plage horaire : 8h - 21h (Europe/Paris)</div>';
  document.getElementById('hourlyChart').innerHTML=h;
}

function renderFlows(flows){
  const n={abandoned_cart:'Panier abandonne',upsell:'Upsell post-achat',winback:'Winback reactivation',review:'Demande d avis',birthday:'Anniversaire client'};
  const d=isTestMode
    ?{abandoned_cart:'TEST : 1 min, 2 min, 3 min',upsell:'TEST : 5 min apres livraison',winback:'J+30, J+60, J+90 sans achat',review:'TEST : demande avis rapide',birthday:'TEST : message anniversaire'}
    :{abandoned_cart:'Envoi a +30 min, +24h, +48h apres abandon',upsell:'Envoi a J+10 apres livraison (delai reception)',winback:'Envoi a J+30, J+60, J+90 sans achat',review:'Demande d avis J+15 apres livraison',birthday:'Message + promo le jour de l anniversaire'};
  const icons={abandoned_cart:'&#128722;',upsell:'&#127873;',winback:'&#128140;',review:'&#11088;',birthday:'&#127874;'};
  let h='';
  flows.forEach(f=>{
    const testBadge=isTestMode?' <span style="color:var(--warning);font-weight:600;font-size:11px">MODE TEST</span>':'';
    h+='<div class="flow-row" onclick="openFlowModal(\\''+f.flow_name+'\\')">'
      +'<div class="flow-info"><span class="flow-icon">'+(icons[f.flow_name]||'')+'</span>'
      +'<div><div class="flow-name">'+(n[f.flow_name]||f.flow_name)+'</div>'
      +'<div class="flow-desc">'+(d[f.flow_name]||'')+testBadge+'</div></div></div>'
      +'<span class="flow-arrow">&#8250;</span>'
      +'<label class="toggle" onclick="event.stopPropagation()"><input type="checkbox" '+(f.enabled?'checked':'')+' onchange="toggleFlow(\\''+f.flow_name+'\\',this.checked)"><span class="slider"></span></label>'
      +'</div>';
  });
  document.getElementById('flowControls').innerHTML=h;
}

async function toggleFlow(n,e){
  await fetch(SERVER+'/api/flows/'+n+'/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:e})});
}

// ─── Modal: Flow detail + template editor ───────
function closeModal(){document.getElementById('modalOverlay').classList.remove('open')}

function openFlowModal(flowName){
  const names={abandoned_cart:'Panier abandonne',upsell:'Upsell post-achat',winback:'Winback reactivation',review:'Demande d avis',birthday:'Anniversaire client'};
  document.getElementById('modalTitle').textContent=names[flowName]||flowName;

  const tplNames=FLOW_TEMPLATES[flowName]||[];
  const matched=tplNames.map(name=>{
    const found=allTemplates.find(t=>t.name===name&&t.language==='fr');
    return found||{name:name,status:'UNKNOWN',components:[]};
  });

  let h='<div class="warning-banner">&#9888; <div><strong>Propagation Meta</strong> — Toute modification de template est soumise a Meta pour validation. Delai : quelques minutes a 24h. Le template actuel reste actif pendant la review.</div></div>';

  if(matched.length===0){
    h+='<div style="color:var(--text-secondary);padding:20px;text-align:center">Aucun template associe</div>';
  }

  matched.forEach((tpl,idx)=>{
    const bodyComp=(tpl.components||[]).find(c=>c.type==='BODY');
    const btnComp=(tpl.components||[]).find(c=>c.type==='BUTTONS');
    const bodyText=bodyComp?bodyComp.text:'(contenu non disponible)';
    const hasBtn=btnComp&&btnComp.buttons&&btnComp.buttons.length>0;

    h+='<div class="tpl-card" id="tpl-'+idx+'">'
      +'<div class="tpl-header"><span class="tpl-name">'+tpl.name+'</span>'+badge(tpl.status||'UNKNOWN')+'</div>'
      +'<div class="tpl-body" id="tpl-view-'+idx+'">'+escHtml(bodyText)+'</div>'
      +'<div class="tpl-edit" id="tpl-edit-'+idx+'" style="display:none"><textarea id="tpl-textarea-'+idx+'">'+escHtml(bodyText)+'</textarea></div>';

    if(hasBtn){
      h+='<div style="margin-bottom:10px;font-size:12px;color:var(--text-secondary)">';
      btnComp.buttons.forEach(b=>{
        h+='&#128279; Bouton : <strong>'+escHtml(b.text||'')+'</strong>';
        if(b.url) h+=' &rarr; '+escHtml(b.url);
        h+='<br>';
      });
      h+='</div>';
    }

    h+='<div class="tpl-actions">'
      +'<button class="btn btn-secondary" onclick="toggleEdit('+idx+')">Modifier</button>'
      +'<button class="btn btn-primary" id="tpl-save-'+idx+'" style="display:none" onclick="saveTemplate(\\''+tpl.id+'\\','+idx+',\\''+tpl.name+'\\')">Envoyer a Meta</button>'
      +'<span class="status-msg" id="tpl-status-'+idx+'"></span>'
      +'</div></div>';
  });

  document.getElementById('modalBody').innerHTML=h;
  document.getElementById('modalOverlay').classList.add('open');
}

function toggleEdit(idx){
  const view=document.getElementById('tpl-view-'+idx);
  const edit=document.getElementById('tpl-edit-'+idx);
  const save=document.getElementById('tpl-save-'+idx);
  if(edit.style.display==='none'){
    edit.style.display='block';view.style.display='none';save.style.display='inline-block';
  }else{
    edit.style.display='none';view.style.display='block';save.style.display='none';
  }
}

async function saveTemplate(templateId,idx,templateName){
  const textarea=document.getElementById('tpl-textarea-'+idx);
  const status=document.getElementById('tpl-status-'+idx);
  const saveBtn=document.getElementById('tpl-save-'+idx);
  const newBody=textarea.value;

  if(!templateId||templateId==='undefined'){
    status.className='status-msg err';
    status.textContent='ID template manquant — modifier sur Meta Business directement';
    return;
  }

  saveBtn.disabled=true;
  status.className='status-msg';
  status.textContent='Envoi a Meta...';

  try{
    const res=await fetch(SERVER+'/api/templates/'+templateId,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({components:[{type:'BODY',text:newBody}]})
    });
    const data=await res.json();
    if(data.success){
      status.className='status-msg ok';
      status.textContent='Soumis a Meta ! En attente de validation (quelques min a 24h)';
      document.getElementById('tpl-view-'+idx).textContent=newBody;
    }else{
      status.className='status-msg err';
      status.textContent='Erreur : '+(data.error||'echec');
    }
  }catch(err){
    status.className='status-msg err';
    status.textContent='Erreur : '+err.message;
  }
  saveBtn.disabled=false;
}

// ─── Template & Flow KPIs ───────────────────────
function renderTemplateStats(tplStats, flowConv){
  const el=document.getElementById('templateStats');

  if(!tplStats||tplStats.length===0){
    el.innerHTML='<div style="color:var(--text-secondary);font-size:13px;text-align:center;padding:16px">Aucune donnee — les stats par template apparaitront apres les premiers envois.</div>';
    return;
  }

  const flowNames={abandoned_cart:'Panier abandonne',upsell:'Upsell',winback:'Winback',review:'Demande avis',birthday:'Anniversaire'};
  const stepNames={abandoned_cart:{1:'Rappel 30min',2:'Rappel 24h',3:'Promo 48h'},upsell:{1:'Recommendation'},winback:{1:'Nouveautes J+30',2:'-15% J+60',3:'-20% J+90'},review:{1:'Demande avis J+15'},birthday:{1:'Voeux'}};

  // Group by flow
  const byFlow={};
  tplStats.forEach(t=>{
    const f=t.flow.startsWith('campaign_')?'campaigns':t.flow;
    if(!byFlow[f])byFlow[f]=[];
    byFlow[f].push(t);
  });

  let h='';

  // Flow conversion KPIs (abandoned_cart)
  if(flowConv&&flowConv.abandoned_cart){
    const ac=flowConv.abandoned_cart;
    h+='<div style="margin-bottom:20px"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--teal);margin-bottom:10px">&#128722; Panier abandonne — Funnel de conversion</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">';
    h+='<div style="background:#f8fafb;border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--text-secondary);text-transform:uppercase;font-weight:600">Detectes</div><div style="font-size:22px;font-weight:700;color:var(--teal)">'+ac.total_checkouts+'</div></div>';
    h+='<div style="background:#f8fafb;border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--text-secondary);text-transform:uppercase;font-weight:600">Convertis</div><div style="font-size:22px;font-weight:700;color:var(--success)">'+ac.converted_checkouts+'</div></div>';
    h+='<div style="background:#f8fafb;border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--text-secondary);text-transform:uppercase;font-weight:600">Taux conversion</div><div style="font-size:22px;font-weight:700;color:'+(ac.conversion_rate>5?'var(--success)':'var(--warning)')+'">'+ac.conversion_rate+'%</div></div>';
    h+='<div style="background:#f8fafb;border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--text-secondary);text-transform:uppercase;font-weight:600">CA recupere</div><div style="font-size:22px;font-weight:700;color:var(--magenta)">'+ac.revenue.toFixed(0)+' EUR</div></div>';
    h+='</div>';

    // Steps funnel
    if(ac.steps&&ac.steps.length>0){
      h+='<div style="display:flex;gap:8px;margin-bottom:14px">';
      ac.steps.forEach(st=>{
        const sName=(stepNames.abandoned_cart||{})[st.step]||'Step '+st.step;
        const cancelPct=st.sent>0?Math.round(st.cancelled/(st.sent+st.cancelled)*100):0;
        h+='<div style="flex:1;border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">';
        h+='<div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px">'+sName+'</div>';
        h+='<div style="font-size:18px;font-weight:700;color:var(--teal)">'+st.sent+'</div>';
        h+='<div style="font-size:10px;color:var(--text-secondary)">envoyes</div>';
        if(st.cancelled>0) h+='<div style="font-size:10px;color:var(--success);margin-top:2px">'+st.cancelled+' annules ('+cancelPct+'% convertis avant)</div>';
        h+='</div>';
      });
      h+='</div>';
    }
    h+='</div>';
  }

  // Detail table per template
  h+='<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);margin-bottom:8px">Detail par template</div>';
  h+='<table><thead><tr><th>Flow</th><th>Step</th><th>Template</th><th>Envoyes</th><th>Echoues</th><th>Annules</th><th>En attente</th><th>Taux echec</th><th>Cout</th></tr></thead><tbody>';

  for(const[flow,templates]of Object.entries(byFlow)){
    templates.sort((a,b)=>a.step-b.step);
    templates.forEach(t=>{
      const fName=flowNames[flow]||(flow.startsWith('campaign_')?'Campagne':'Autre');
      const sName=(stepNames[flow]||{})[t.step]||'Step '+t.step;
      const failRate=t.sent>0?Math.round(t.failed/t.sent*100):0;
      const failColor=failRate>10?'var(--danger)':failRate>5?'var(--warning)':'var(--success)';
      const cost=(t.sent*waCost).toFixed(2);
      h+='<tr><td style="font-weight:600">'+fName+'</td><td>'+sName+'</td><td style="font-size:12px;color:var(--teal)">'+escHtml(t.template)+'</td>';
      h+='<td style="text-align:center;font-weight:600">'+t.sent+'</td>';
      h+='<td style="text-align:center;color:var(--danger)">'+t.failed+'</td>';
      h+='<td style="text-align:center;color:var(--text-secondary)">'+t.cancelled+'</td>';
      h+='<td style="text-align:center;color:var(--teal)">'+t.queued+'</td>';
      h+='<td style="text-align:center"><span style="color:'+failColor+';font-weight:600">'+failRate+'%</span></td>';
      h+='<td style="font-weight:600;color:var(--danger)">'+cost+' EUR</td></tr>';
    });
  }
  h+='</tbody></table>';

  el.innerHTML=h;
}

// ─── A/B Test results ───────────────────────────
function renderABTest(data){
  const el=document.getElementById('abTestResults');
  const a=data.with_images||{sent:0,converted:0,revenue:0,conversion_rate:0};
  const b=data.no_images||{sent:0,converted:0,revenue:0,conversion_rate:0};
  const attr=data.attribution||{total_wa_clicks:0,total_sent:0,total_converted:0,total_revenue:0,click_rate:0};
  const total=a.sent+b.sent;

  if(total===0){
    el.innerHTML='<div style="color:var(--text-secondary);font-size:13px;text-align:center;padding:10px">Pas encore de donnees — le test A/B commence automatiquement avec les prochains paniers abandonnes. 50% recevront les images produit, 50% uniquement le template texte.</div>';
    return;
  }

  let winner='';
  if(a.sent>=250&&b.sent>=250){
    if(a.conversion_rate>b.conversion_rate) winner='with_images';
    else if(b.conversion_rate>a.conversion_rate) winner='no_images';
    else winner='tie';
  }

  // Attribution summary
  let h='<div style="background:#f8fafb;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:24px;flex-wrap:wrap;font-size:13px">';
  h+='<div><span style="color:var(--text-secondary)">Clics WhatsApp :</span> <strong>'+attr.total_wa_clicks+'</strong></div>';
  h+='<div><span style="color:var(--text-secondary)">Taux de clic :</span> <strong>'+attr.click_rate+'%</strong></div>';
  h+='<div><span style="color:var(--text-secondary)">Conversions totales :</span> <strong style="color:var(--success)">'+attr.total_converted+'</strong></div>';
  h+='<div><span style="color:var(--text-secondary)">Revenu total :</span> <strong style="color:var(--magenta)">'+attr.total_revenue.toFixed(0)+' EUR</strong></div>';
  h+='</div>';

  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';

  // Variant A
  const aWin=winner==='with_images';
  h+='<div style="border:2px solid '+(aWin?'var(--success)':'var(--border)')+';border-radius:10px;padding:16px'+(aWin?';background:#f0fdf4':'')+'">';
  h+='<div style="font-weight:700;font-size:14px;margin-bottom:8px">&#128247; Variante A : Avec images produit</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">';
  h+='<div>Envoyes : <strong>'+a.sent+'</strong></div>';
  h+='<div>Convertis : <strong style="color:var(--success)">'+a.converted+'</strong></div>';
  h+='<div>Taux conversion : <strong style="font-size:18px;color:'+(aWin?'var(--success)':'var(--text)')+'">'+a.conversion_rate+'%</strong></div>';
  h+='<div>Revenu : <strong>'+a.revenue.toFixed(0)+' EUR</strong></div>';
  h+='</div>';
  if(aWin) h+='<div style="margin-top:8px;color:var(--success);font-weight:700;font-size:12px">&#127942; GAGNANT</div>';
  h+='</div>';

  // Variant B
  const bWin=winner==='no_images';
  h+='<div style="border:2px solid '+(bWin?'var(--success)':'var(--border)')+';border-radius:10px;padding:16px'+(bWin?';background:#f0fdf4':'')+'">';
  h+='<div style="font-weight:700;font-size:14px;margin-bottom:8px">&#128172; Variante B : Template seul (sans images)</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">';
  h+='<div>Envoyes : <strong>'+b.sent+'</strong></div>';
  h+='<div>Convertis : <strong style="color:var(--success)">'+b.converted+'</strong></div>';
  h+='<div>Taux conversion : <strong style="font-size:18px;color:'+(bWin?'var(--success)':'var(--text)')+'">'+b.conversion_rate+'%</strong></div>';
  h+='<div>Revenu : <strong>'+b.revenue.toFixed(0)+' EUR</strong></div>';
  h+='</div>';
  if(bWin) h+='<div style="margin-top:8px;color:var(--success);font-weight:700;font-size:12px">&#127942; GAGNANT</div>';
  h+='</div>';

  h+='</div>';

  if(total<500){
    const pct=Math.round(total/500*100);
    h+='<div style="margin-top:14px"><div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px">Progression : '+total+' / 500 envois (250 par variante)</div>';
    h+='<div style="background:#e8ecf0;border-radius:4px;height:6px;overflow:hidden"><div style="background:var(--teal);height:100%;width:'+pct+'%;border-radius:4px;transition:width 0.5s"></div></div></div>';
  }else if(winner==='tie'){
    h+='<div style="margin-top:12px;font-size:12px;color:var(--warning);text-align:center;font-weight:600">Egalite — continuez le test pour plus de donnees</div>';
  }

  h+='<div style="margin-top:12px;font-size:11px;color:var(--text-secondary)">&#128279; Attribution : chaque lien WhatsApp contient un UTM (utm_source=whatsapp). Les clics sur les liens sont trackes pour mesurer le taux de clic et attribuer les conversions.</div>';

  el.innerHTML=h;
}

// ─── Data tables ────────────────────────────────
function renderCheckouts(data){
  const tb=document.querySelector('#checkoutsTable tbody');
  if(!data||data.length===0){tb.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">Aucun panier detecte</td></tr>';return;}
  tb.innerHTML=data.map(c=>{
    let items='-';
    try{const p=typeof c.line_items==='string'?JSON.parse(c.line_items||'[]'):(c.line_items||[]);items=p.map(i=>i.title+(i.quantity>1?' x'+i.quantity:'')).join(', ')||'-'}catch(e){}
    return '<tr><td>'+fmtDate(c.created_at)+'</td><td style="font-weight:500">'+(c.customer_name||'-')+'</td><td>'+(c.email||'-')+'</td><td>'+(c.phone||'-')+'</td><td style="font-weight:600">'+(c.total_price||'0')+' EUR</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">'+items+'</td><td>'+(c.converted?badge('converted'):badge('abandoned'))+'</td></tr>';
  }).join('');
}

function renderMessages(data){
  const tb=document.querySelector('#messagesTable tbody');
  if(!data||data.length===0){tb.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--text-secondary)">Aucun message</td></tr>';return;}
  tb.innerHTML=data.map(m=>'<tr><td>'+fmtDate(m.created_at)+'</td><td style="font-weight:500;color:var(--teal)">'+fmtDate(m.scheduled_at)+'</td><td>'+m.phone+'</td><td style="font-weight:500">'+m.flow+'</td><td style="font-size:12px">'+m.template+'</td><td>'+badge(m.status)+'</td><td>'+fmtDate(m.sent_at)+'</td><td style="font-size:11px;color:var(--danger);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(m.error||'')+'</td></tr>').join('');
}

// ─── Contacts ───────────────────────────────────
async function loadContacts(){
  const seg=document.getElementById('segmentFilter').value;
  try{
    const contacts=await api('/api/contacts?segment='+seg);
    renderContacts(contacts);
    document.getElementById('contactCount').textContent=contacts.length+' contact'+(contacts.length!==1?'s':'');
  }catch(e){
    if(e.message!=='Auth required') document.querySelector('#contactsTable tbody').innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--danger)">Erreur: '+e.message+'</td></tr>';
  }
  // Load segments for filter
  try{
    const seg_data=await api('/api/segments');
    const sel=document.getElementById('segmentFilter');
    const current=sel.value;
    let opts='';
    seg_data.segments.forEach(s=>{
      opts+='<option value="'+s.id+'"'+(s.id===current?' selected':'')+'>'+escHtml(s.name)+' ('+s.count+')</option>';
    });
    if(seg_data.tags&&seg_data.tags.length>0){
      seg_data.tags.forEach(t=>{
        const v='tag:'+t;
        opts+='<option value="'+v+'"'+(v===current?' selected':'')+'>Tag: '+escHtml(t)+'</option>';
      });
    }
    sel.innerHTML=opts;
  }catch(e){}
}

function renderContacts(data){
  const tb=document.querySelector('#contactsTable tbody');
  if(!data||data.length===0){
    tb.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--text-secondary)">Aucun contact — ajoutez-en via le bouton ci-dessus</td></tr>';
    return;
  }
  tb.innerHTML=data.map(c=>{
    const tags=(c.tags||'').split(',').filter(t=>t.trim()).map(t=>'<span class="tag-badge">'+escHtml(t.trim())+'</span>').join(' ');
    const src=c.source==='shopify'?'<span style="color:var(--success);font-weight:600">Shopify</span>':'<span style="color:var(--teal)">Manuel</span>';
    const isManual=c.source!=='shopify';
    const actions=isManual
      ?'<button class="btn btn-secondary btn-sm" onclick="openEditContactModal('+c.id+',\\''+escHtml(c.first_name||'')+'\\',\\''+escHtml(c.last_name||'')+'\\',\\''+escHtml(c.phone||'')+'\\',\\''+escHtml(c.email||'')+'\\',\\''+escHtml(c.tags||'')+'\\')">Edit</button> <button class="btn btn-danger btn-sm" onclick="deleteContact('+c.id+')">X</button>'
      :'<span style="font-size:11px;color:var(--text-secondary)">Auto</span>';
    const phoneLink=c.phone?'<a href="#" style="color:var(--teal);font-weight:600;text-decoration:underline;cursor:pointer" onclick="event.preventDefault();openTimelineModal(\\''+escHtml(c.phone)+'\\',\\''+escHtml(c.first_name||'')+'\\')">'+escHtml(c.phone)+'</a>':'-';
    return '<tr><td style="font-weight:500">'+(c.first_name||'-')+'</td><td>'+(c.last_name||'-')+'</td><td>'+phoneLink+'</td><td>'+(c.email||'-')+'</td><td>'+tags+'</td><td>'+src+'</td><td>'+fmtDate(c.created_at)+'</td><td>'+actions+'</td></tr>';
  }).join('');
}

function openAddContactModal(){
  document.getElementById('modalTitle').textContent='Ajouter un contact';
  let h='<div class="form-row"><div class="form-group"><label>Prenom</label><input type="text" id="ctFirstName" placeholder="Jean"></div>';
  h+='<div class="form-group"><label>Nom</label><input type="text" id="ctLastName" placeholder="Dupont"></div></div>';
  h+='<div class="form-group"><label>Telephone *</label><input type="tel" id="ctPhone" placeholder="+33612345678 ou 0612345678"></div>';
  h+='<div class="form-group"><label>Email</label><input type="email" id="ctEmail" placeholder="jean@example.com"></div>';
  h+='<div class="form-group"><label>Tags (separes par des virgules)</label><input type="text" id="ctTags" placeholder="vip, prospect, newsletter"></div>';
  h+='<div style="display:flex;gap:8px;margin-top:16px"><button class="btn btn-primary" onclick="saveNewContact()">Ajouter</button><button class="btn btn-secondary" onclick="closeModal()">Annuler</button><span class="status-msg" id="contactFormStatus"></span></div>';
  document.getElementById('modalBody').innerHTML=h;
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('ctFirstName').focus(),100);
}

function openEditContactModal(id,fn,ln,ph,em,tg){
  document.getElementById('modalTitle').textContent='Modifier le contact';
  let h='<div class="form-row"><div class="form-group"><label>Prenom</label><input type="text" id="ctFirstName" value="'+escHtml(fn)+'"></div>';
  h+='<div class="form-group"><label>Nom</label><input type="text" id="ctLastName" value="'+escHtml(ln)+'"></div></div>';
  h+='<div class="form-group"><label>Telephone *</label><input type="tel" id="ctPhone" value="'+escHtml(ph)+'"></div>';
  h+='<div class="form-group"><label>Email</label><input type="email" id="ctEmail" value="'+escHtml(em)+'"></div>';
  h+='<div class="form-group"><label>Tags</label><input type="text" id="ctTags" value="'+escHtml(tg)+'"></div>';
  h+='<div style="display:flex;gap:8px;margin-top:16px"><button class="btn btn-primary" onclick="updateContact('+id+')">Enregistrer</button><button class="btn btn-secondary" onclick="closeModal()">Annuler</button><span class="status-msg" id="contactFormStatus"></span></div>';
  document.getElementById('modalBody').innerHTML=h;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveNewContact(){
  const status=document.getElementById('contactFormStatus');
  const data={
    first_name:document.getElementById('ctFirstName').value.trim(),
    last_name:document.getElementById('ctLastName').value.trim(),
    phone:document.getElementById('ctPhone').value.trim(),
    email:document.getElementById('ctEmail').value.trim(),
    tags:document.getElementById('ctTags').value.trim()
  };
  if(!data.phone){status.className='status-msg err';status.textContent='Le telephone est obligatoire';return;}
  try{
    const res=await fetch(SERVER+'/api/contacts',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
    });
    const r=await res.json();
    if(r.success){
      status.className='status-msg ok';status.textContent='Contact ajoute !';
      setTimeout(()=>{closeModal();loadContacts();},800);
    }else{
      status.className='status-msg err';status.textContent='Erreur : '+(r.error||'echec');
    }
  }catch(e){status.className='status-msg err';status.textContent='Erreur : '+e.message;}
}

async function updateContact(id){
  const status=document.getElementById('contactFormStatus');
  const data={
    first_name:document.getElementById('ctFirstName').value.trim(),
    last_name:document.getElementById('ctLastName').value.trim(),
    phone:document.getElementById('ctPhone').value.trim(),
    email:document.getElementById('ctEmail').value.trim(),
    tags:document.getElementById('ctTags').value.trim()
  };
  try{
    const res=await fetch(SERVER+'/api/contacts/'+id,{
      method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
    });
    const r=await res.json();
    if(r.success){
      status.className='status-msg ok';status.textContent='Modifie !';
      setTimeout(()=>{closeModal();loadContacts();},800);
    }else{
      status.className='status-msg err';status.textContent='Erreur : '+(r.error||'echec');
    }
  }catch(e){status.className='status-msg err';status.textContent='Erreur : '+e.message;}
}

async function deleteContact(id){
  if(!confirm('Supprimer ce contact ?'))return;
  try{
    await fetch(SERVER+'/api/contacts/'+id,{method:'DELETE'});
    loadContacts();
  }catch(e){alert('Erreur: '+e.message);}
}

// ─── Campaigns push ─────────────────────────────
function renderCampaigns(data){
  const el=document.getElementById('campaignsList');
  if(!data||data.length===0){
    el.innerHTML='<div style="color:var(--text-secondary);font-size:13px;text-align:center;padding:10px">Aucune campagne — cliquez sur "+ Nouvelle campagne" pour commencer</div>';
    return;
  }
  let h='<table><thead><tr><th>Date</th><th>Nom</th><th>Template</th><th>Segment</th><th>Cibles</th><th>Envoyes</th><th>Echecs</th><th>Cout</th><th>Statut</th><th>Action</th></tr></thead><tbody>';
  data.forEach(c=>{
    const statusMap={draft:'En attente',sending:'Envoi...',sent:'Termine',completed:'Termine',cancelled:'Annule'};
    const statusClass={draft:'queued',sending:'queued',sent:'sent',completed:'sent',cancelled:'cancelled'};
    const cost=(c.sent_count*waCost).toFixed(2);
    h+='<tr><td>'+fmtDate(c.created_at)+'</td><td style="font-weight:600">'+escHtml(c.name)+'</td><td style="font-size:12px">'+escHtml(c.template)+'</td><td style="font-size:12px">'+(c.target_filter||'all')+'</td><td style="text-align:center">'+c.target_count+'</td><td style="text-align:center;color:var(--success);font-weight:600">'+c.sent_count+'</td><td style="text-align:center;color:var(--danger)">'+c.failed_count+'</td><td style="font-weight:600;color:var(--danger)">'+cost+' EUR</td><td>'+badge(statusClass[c.status]||c.status)+'</td>';
    if(c.status==='sending'||c.status==='draft'){
      h+='<td><button class="btn btn-secondary btn-sm" onclick="cancelCampaign('+c.id+')">Annuler</button></td>';
    }else{
      h+='<td>-</td>';
    }
    h+='</tr>';
  });
  h+='</tbody></table>';
  el.innerHTML=h;
}

async function openCampaignModal(){
  let segments=[];
  let customers=[];
  try{segments=(await api('/api/segments')).segments||[];}catch(e){}
  try{customers=await api('/api/customers');}catch(e){}

  document.getElementById('modalTitle').textContent='Nouvelle campagne push';

  let tplOptions='';
  allTemplates.filter(t=>t.status==='APPROVED'&&t.language==='fr').forEach(t=>{
    tplOptions+='<option value="'+escHtml(t.name)+'">'+escHtml(t.name)+'</option>';
  });

  let segOptions='';
  segments.forEach(s=>{
    segOptions+='<option value="'+s.id+'">'+escHtml(s.name)+' ('+s.count+')</option>';
  });

  let h='<div class="warning-banner">&#128227; <div><strong>Campagne push</strong> — Envoie un template Meta WhatsApp aux contacts du segment choisi. Les messages passent par la queue et respectent la plage horaire 8h-21h.</div></div>';

  h+='<div class="form-group"><label>Nom de la campagne</label><input type="text" id="campaignName" placeholder="Ex: Soldes printemps 2026"></div>';

  h+='<div class="form-row"><div class="form-group"><label>Template Meta (approuve)</label><select id="campaignTemplate">';
  h+=tplOptions||'<option value="">Aucun template approuve</option>';
  h+='</select></div>';

  h+='<div class="form-group"><label>Segment cible</label><select id="campaignSegment" onchange="updateCampaignCount()">';
  h+=segOptions||'<option value="all">Tous</option>';
  h+='</select></div></div>';

  h+='<div class="form-group"><label>Date/heure d envoi (optionnel)</label><input type="datetime-local" id="campaignSchedule"><div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Laisser vide pour envoyer immediatement</div></div>';

  h+='<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 14px;font-size:12px;color:#166534;margin-bottom:16px" id="campaignInfo">&#9989; Selectionnez un segment pour voir le nombre de destinataires</div>';

  h+='<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;font-size:12px;color:#991b1b;margin-bottom:16px" id="campaignCostInfo"></div>';

  h+='<div style="display:flex;gap:8px"><button class="btn btn-magenta" onclick="sendCampaign()" id="sendCampaignBtn">Lancer la campagne</button><button class="btn btn-secondary" onclick="closeModal()">Annuler</button><span class="status-msg" id="campaignStatus"></span></div>';

  document.getElementById('modalBody').innerHTML=h;
  document.getElementById('modalOverlay').classList.add('open');
  updateCampaignCount();
}

async function updateCampaignCount(){
  const seg=document.getElementById('campaignSegment').value;
  try{
    const contacts=await api('/api/contacts?segment='+seg);
    const count=contacts.length;
    const cost=(count*waCost).toFixed(2);
    document.getElementById('campaignInfo').innerHTML='&#9989; <strong>'+count+' destinataire'+(count!==1?'s':'')+'</strong> dans ce segment';
    document.getElementById('campaignCostInfo').innerHTML='&#128176; Cout estime : <strong>'+cost+' EUR</strong> ('+(waCost*100).toFixed(1)+' cts x '+count+' messages)';
  }catch(e){}
}

async function sendCampaign(){
  const name=document.getElementById('campaignName').value.trim();
  const template=document.getElementById('campaignTemplate').value;
  const segment=document.getElementById('campaignSegment').value;
  const scheduleVal=document.getElementById('campaignSchedule').value;
  const status=document.getElementById('campaignStatus');
  const btn=document.getElementById('sendCampaignBtn');

  if(!name){status.className='status-msg err';status.textContent='Donnez un nom a la campagne';return;}
  if(!template){status.className='status-msg err';status.textContent='Selectionnez un template';return;}

  btn.disabled=true;
  status.className='status-msg';
  status.textContent=scheduleVal?'Programmation...':'Lancement...';

  const payload={name,template,segment};
  if(scheduleVal) payload.scheduled_at=new Date(scheduleVal).toISOString();

  try{
    const res=await fetch(SERVER+'/api/campaigns',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    const data=await res.json();
    if(data.success){
      status.className='status-msg ok';
      status.textContent=data.queued+' messages en queue !';
      setTimeout(()=>{closeModal();loadAll();},1500);
    }else{
      status.className='status-msg err';
      status.textContent='Erreur : '+(data.error||'echec');
    }
  }catch(err){
    status.className='status-msg err';
    status.textContent='Erreur : '+err.message;
  }
  btn.disabled=false;
}

async function cancelCampaign(id){
  if(!confirm('Annuler cette campagne ?')) return;
  try{
    await fetch(SERVER+'/api/campaigns/'+id+'/cancel',{method:'POST'});
    loadAll();
  }catch(e){alert('Erreur: '+e.message);}
}

// ─── Incoming messages (Reponses) ───────────────
async function loadIncoming(){
  try{
    const data=await api('/api/incoming-messages');
    const tb=document.querySelector('#incomingTable tbody');
    if(!data||data.length===0){
      tb.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--text-secondary)">Aucune reponse recue</td></tr>';
      return;
    }
    tb.innerHTML=data.map(m=>{
      const body=(m.body||m.message||'').toUpperCase();
      const isOptout=body.includes('STOP')||body.includes('ARRET')||body.includes('DESABONNER');
      const statut=isOptout?'<span class="badge optout">Opt-out</span>':'<span class="badge received">Recu</span>';
      return '<tr><td>'+fmtDate(m.received_at||m.created_at)+'</td><td style="font-weight:500">'+escHtml(m.phone||m.from)+'</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(m.body||m.message||'')+'</td><td>'+statut+'</td></tr>';
    }).join('');
  }catch(e){
    if(e.message!=='Auth required') document.querySelector('#incomingTable tbody').innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--danger)">Erreur: '+e.message+'</td></tr>';
  }
}

// ─── Timeline client ────────────────────────────
async function openTimelineModal(phone,name){
  document.getElementById('modalTitle').textContent='Timeline — '+(name?name+' ('+phone+')':phone);
  document.getElementById('modalBody').innerHTML='<div style="color:var(--text-secondary);font-size:13px">Chargement...</div>';
  document.getElementById('modalOverlay').classList.add('open');

  try{
    const msgs=await api('/api/messages?phone='+encodeURIComponent(phone)+'&limit=100');
    let incoming=[];
    try{incoming=await api('/api/incoming-messages?phone='+encodeURIComponent(phone));}catch(e){}

    // Merge and sort by date
    const all=[];
    (msgs||[]).forEach(m=>all.push({type:'out',date:m.sent_at||m.scheduled_at||m.created_at,flow:m.flow||'-',template:m.template||'-',status:m.status,error:m.error||''}));
    (incoming||[]).forEach(m=>all.push({type:'in',date:m.received_at||m.created_at,flow:'-',template:'-',status:'received',message:m.body||m.message||''}));
    all.sort((a,b)=>new Date(b.date)-new Date(a.date));

    if(all.length===0){
      document.getElementById('modalBody').innerHTML='<div style="color:var(--text-secondary);font-size:13px;text-align:center;padding:20px">Aucun message pour ce numero</div>';
      return;
    }

    let h='<div style="margin-bottom:12px;font-size:12px;color:var(--text-secondary)">'+all.length+' message'+(all.length>1?'s':'')+' au total</div>';
    all.forEach(m=>{
      h+='<div class="timeline-item">';
      h+='<div class="timeline-dot '+(m.type==='out'?'out':'in')+'"></div>';
      h+='<div style="flex:1">';
      h+='<div style="font-size:11px;color:var(--text-secondary)">'+fmtDate(m.date)+' — '+(m.type==='out'?'Envoye':'Recu')+'</div>';
      if(m.type==='out'){
        h+='<div style="font-weight:500">'+escHtml(m.flow)+' / '+escHtml(m.template)+'</div>';
        h+='<div>'+badge(m.status)+(m.error?' <span style="font-size:11px;color:var(--danger)">'+escHtml(m.error)+'</span>':'')+'</div>';
      }else{
        h+='<div style="font-weight:500;color:var(--magenta)">'+escHtml(m.message)+'</div>';
      }
      h+='</div></div>';
    });

    document.getElementById('modalBody').innerHTML=h;
  }catch(e){
    document.getElementById('modalBody').innerHTML='<div style="color:var(--danger);font-size:13px">Erreur: '+e.message+'</div>';
  }
}

// ─── Alertes ────────────────────────────────────
async function loadAlerts(){
  try{
    const data=await api('/api/alerts');
    const unread=(data||[]).filter(a=>!a.read).length;
    const badge=document.getElementById('alertBadge');
    if(unread>0){
      badge.textContent=unread>99?'99+':unread;
      badge.style.display='flex';
    }else{
      badge.style.display='none';
    }
    return data||[];
  }catch(e){return[];}
}

async function openAlertModal(){
  document.getElementById('modalTitle').textContent='Alertes';
  document.getElementById('modalBody').innerHTML='<div style="color:var(--text-secondary);font-size:13px">Chargement...</div>';
  document.getElementById('modalOverlay').classList.add('open');

  const alerts=await loadAlerts();
  if(!alerts||alerts.length===0){
    document.getElementById('modalBody').innerHTML='<div style="color:var(--text-secondary);font-size:13px;text-align:center;padding:20px">Aucune alerte</div>';
    return;
  }

  const typeIcons={error:'&#9888;',warning:'&#9888;',info:'&#128712;',success:'&#9989;'};
  const typeColors={error:'var(--danger)',warning:'var(--warning)',info:'var(--teal)',success:'var(--success)'};

  let h='';
  alerts.forEach(a=>{
    const icon=typeIcons[a.type||'info']||'&#128712;';
    const color=typeColors[a.type||'info']||'var(--teal)';
    const bg=a.read?'transparent':'#fffbeb';
    h+='<div style="padding:12px;border-bottom:1px solid var(--border);background:'+bg+'">';
    h+='<div style="display:flex;gap:8px;align-items:flex-start">';
    h+='<span style="color:'+color+';font-size:16px">'+icon+'</span>';
    h+='<div style="flex:1"><div style="font-weight:600;font-size:13px">'+escHtml(a.title||a.message||'Alerte')+'</div>';
    if(a.details) h+='<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">'+escHtml(a.details)+'</div>';
    h+='<div style="font-size:11px;color:var(--text-secondary);margin-top:4px">'+fmtDate(a.created_at)+'</div>';
    h+='</div></div></div>';
  });

  document.getElementById('modalBody').innerHTML=h;
  // Mark as read
  document.getElementById('alertBadge').style.display='none';
}

// ─── Init ────────────────────────────────────────
async function init(){
  const ok=await checkAuth();
  if(ok){
    onDateRangeChange();
    loadAlerts();
  }
}
init();
setInterval(loadAll,60000);
</script>
</body>
</html>`;
}

module.exports = { getDashboardHTML };
