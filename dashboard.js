// Dashboard HTML generator — Le Bourlingueur branded

function getDashboardHTML(serverUrl) {
  const base = serverUrl || '';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Le Bourlingueur — WhatsApp Automation</title>
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

/* Header */
.header {
  background: linear-gradient(135deg, var(--teal-dark) 0%, var(--teal) 50%, var(--teal-light) 100%);
  padding: 0 32px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 12px rgba(13,90,92,0.15);
}
.header .logo {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header .logo-icon {
  width: 32px;
  height: 32px;
  background: rgba(255,255,255,0.15);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.header h1 {
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  letter-spacing: -0.3px;
}
.header .right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 8px #34d399;
  animation: livePulse 2s ease-in-out infinite;
}
@keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.85)} }
.header .live { display: flex; align-items: center; gap: 6px; font-size: 12px; color: rgba(255,255,255,0.8); font-weight: 500; }
.refresh-btn {
  background: rgba(255,255,255,0.15);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.2);
  padding: 6px 14px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  font-size: 12px;
  font-family: 'Poppins', sans-serif;
  transition: all 0.2s;
}
.refresh-btn:hover { background: rgba(255,255,255,0.25); }
.last-refresh { font-size: 11px; color: rgba(255,255,255,0.5); }

/* Container */
.container { max-width: 1360px; margin: 0 auto; padding: 24px; }

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 24px;
}
.kpi {
  background: var(--card);
  border-radius: 12px;
  padding: 18px 20px;
  border: 1px solid var(--border);
  transition: transform 0.15s, box-shadow 0.15s;
  position: relative;
  overflow: hidden;
}
.kpi:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
.kpi::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 3px;
  height: 100%;
  border-radius: 3px 0 0 3px;
}
.kpi.teal::before { background: var(--teal); }
.kpi.green::before { background: var(--success); }
.kpi.red::before { background: var(--danger); }
.kpi.orange::before { background: var(--warning); }
.kpi.magenta::before { background: var(--magenta); }
.kpi .label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 6px;
}
.kpi .value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.1;
}
.kpi.teal .value { color: var(--teal); }
.kpi.green .value { color: var(--success); }
.kpi.red .value { color: var(--danger); }
.kpi.orange .value { color: var(--warning); }
.kpi.magenta .value { color: var(--magenta); }
.kpi .sub {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
  font-weight: 400;
}

/* Cards */
.card {
  background: var(--card);
  border-radius: 12px;
  border: 1px solid var(--border);
  margin-bottom: 20px;
  overflow: hidden;
}
.card-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-header h2 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.card-header .count { font-size: 11px; color: var(--text-secondary); font-weight: 400; }
.card-body { padding: 18px 20px; }

/* Tables */
table { width: 100%; border-collapse: collapse; }
th {
  text-align: left;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  padding: 8px 10px;
  border-bottom: 2px solid var(--border);
}
td {
  padding: 10px;
  font-size: 13px;
  border-bottom: 1px solid #f3f4f6;
  font-weight: 400;
}
tr:hover td { background: #f8fafb; }

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
}
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

/* Flows */
.flow-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid #f3f4f6;
}
.flow-row:last-child { border: none; }
.flow-icon { font-size: 20px; margin-right: 12px; }
.flow-info { display: flex; align-items: center; }
.flow-name { font-weight: 600; font-size: 14px; }
.flow-desc { font-size: 12px; color: var(--text-secondary); margin-top: 1px; }
.toggle { position: relative; width: 46px; height: 26px; cursor: pointer; }
.toggle input { display: none; }
.toggle .slider {
  position: absolute; inset: 0;
  background: #d1d5db;
  border-radius: 13px;
  transition: 0.25s;
}
.toggle .slider:before {
  content: '';
  position: absolute;
  width: 20px; height: 20px;
  left: 3px; bottom: 3px;
  background: #fff;
  border-radius: 50%;
  transition: 0.25s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
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
.tab {
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
  font-family: 'Poppins', sans-serif;
  background: none;
  border-top: none;
  border-left: none;
  border-right: none;
}
.tab:hover { color: var(--teal); }
.tab.active { color: var(--teal); border-bottom-color: var(--teal); font-weight: 600; }
.tab-content { display: none; }
.tab-content.active { display: block; }

@media (max-width: 1024px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .chart-grid { grid-template-columns: 1fr; }
  .header { padding: 0 16px; }
  .container { padding: 16px; }
}
</style>
</head>
<body>

<div class="header">
  <div class="logo">
    <div class="logo-icon">LB</div>
    <h1>Le Bourlingueur</h1>
  </div>
  <div class="right">
    <div class="live"><div class="live-dot"></div> Production</div>
    <span class="last-refresh" id="lastRefresh"></span>
    <button class="refresh-btn" onclick="loadAll()">Actualiser</button>
  </div>
</div>

<div class="container">
  <div class="kpi-grid" id="kpiGrid"></div>

  <div class="chart-grid">
    <div class="card">
      <div class="card-header"><h2>Messages par flow</h2></div>
      <div class="card-body" id="flowChart"></div>
    </div>
    <div class="card">
      <div class="card-header"><h2>Heures d'envoi</h2></div>
      <div class="card-body" id="hourlyChart"></div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h2>Automatisations</h2></div>
    <div class="card-body" id="flowControls"></div>
  </div>

  <div class="card">
    <div class="card-header">
      <h2>Donnees</h2>
    </div>
    <div class="card-body">
      <div class="tabs">
        <button class="tab active" onclick="switchTab('checkouts',this)">Paniers</button>
        <button class="tab" onclick="switchTab('messages',this)">Messages</button>
      </div>
      <div class="tab-content active" id="tab-checkouts">
        <table id="checkoutsTable">
          <thead><tr><th>Date</th><th>Client</th><th>Email</th><th>Tel</th><th>Montant</th><th>Articles</th><th>Statut</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="tab-content" id="tab-messages">
        <table id="messagesTable">
          <thead><tr><th>Date</th><th>Tel</th><th>Flow</th><th>Template</th><th>Statut</th><th>Envoye</th><th>Erreur</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<script>
const SERVER = '';
async function api(p){return(await fetch(SERVER+p)).json()}
function fmtDate(d){if(!d)return'-';const dt=new Date(d.replace(' ','T')+(d.includes('Z')?'':'Z'));return dt.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function badge(s){const labels={sent:'Envoye',queued:'En attente',failed:'Echoue',cancelled:'Annule',converted:'Recupere',abandoned:'Abandonne'};return '<span class="badge '+s+'">'+(labels[s]||s)+'</span>'}

function switchTab(name,el){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-'+name).classList.add('active');
}

async function loadAll(){
  try{
    document.getElementById('lastRefresh').textContent=new Date().toLocaleTimeString('fr-FR');
    const s=await api('/api/stats');
    const rev=(s.revenue_recovered||0);
    document.getElementById('kpiGrid').innerHTML=[
      kpi('Messages envoyes',s.messages_sent||0,'','teal'),
      kpi('En attente',s.messages_queued||0,'','teal'),
      kpi('Echoues',s.messages_failed||0,'','red'),
      kpi('Annules',s.messages_cancelled||0,'Conversion client','orange'),
      kpi('Paniers detectes',s.total_checkouts||0,'dont '+(s.abandoned_checkouts||0)+' en cours','teal'),
      kpi('Paniers recuperes',s.recovered_checkouts||0,(s.recovery_rate||0)+'% de conversion','green'),
      kpi('Revenu recupere',rev.toFixed(0)+' EUR','','magenta'),
      kpi('Clients suivis',s.total_customers||0,(s.total_optins||0)+' opt-ins','teal'),
    ].join('');
    const bf=await api('/api/messages-by-flow');renderFlowChart(bf);
    const hr=await api('/api/hourly-distribution');renderHourly(hr);
    const fl=await api('/api/flows');renderFlows(fl);
    const ck=await api('/api/checkouts?limit=40');renderCheckouts(ck);
    const ms=await api('/api/messages?limit=60');renderMessages(ms);
  }catch(err){console.error('Dashboard error:',err);document.getElementById('kpiGrid').innerHTML='<div style="padding:20px;color:#dc2626">Erreur de chargement: '+err.message+'</div>';}
}

function kpi(l,v,sub,c){return '<div class="kpi '+c+'"><div class="label">'+l+'</div><div class="value">'+v+'</div>'+(sub?'<div class="sub">'+sub+'</div>':'')+'</div>'}

function renderFlowChart(data){
  const f={};
  data.forEach(r=>{if(!f[r.flow])f[r.flow]={sent:0,queued:0,failed:0,cancelled:0};f[r.flow][r.status]=r.count});
  const names={abandoned_cart:'Panier abandonne',upsell:'Upsell post-achat',winback:'Winback'};
  let h='<table><thead><tr><th>Flow</th><th>Envoyes</th><th>Attente</th><th>Echoues</th><th>Annules</th><th>Total</th></tr></thead><tbody>';
  for(const[k,d]of Object.entries(f)){
    const t=d.sent+d.queued+d.failed+d.cancelled;
    h+='<tr><td style="font-weight:600">'+(names[k]||k)+'</td><td>'+badge('sent')+' '+d.sent+'</td><td>'+badge('queued')+' '+d.queued+'</td><td>'+badge('failed')+' '+d.failed+'</td><td>'+badge('cancelled')+' '+d.cancelled+'</td><td style="font-weight:700">'+t+'</td></tr>';
  }
  h+='</tbody></table>';
  document.getElementById('flowChart').innerHTML=h;
}

function renderHourly(data){
  const hrs=Array(24).fill(0);
  data.forEach(r=>{hrs[r.hour]=r.count});
  const mx=Math.max(...hrs,1);
  let h='<div class="bar-chart">';
  for(let i=0;i<24;i++){
    const p=hrs[i]/mx*100;
    const active=i>=9&&i<21;
    const c=active?'var(--teal)':'#e2e8f0';
    h+='<div class="bar"><div class="bar-value">'+(hrs[i]||'')+'</div><div class="bar-fill" style="height:'+Math.max(p,2)+'%;background:'+c+';opacity:'+(active?1:0.5)+'"></div><div class="bar-label">'+i+'h</div></div>';
  }
  h+='</div><div style="font-size:10px;color:var(--text-secondary);margin-top:8px">Plage horaire : 9h - 21h (Europe/Paris)</div>';
  document.getElementById('hourlyChart').innerHTML=h;
}

function renderFlows(flows){
  const n={abandoned_cart:'Panier abandonne',upsell:'Upsell post-achat',winback:'Winback reactivation'};
  const d={abandoned_cart:'30 min, 24h, 48h apres abandon',upsell:'J+5 apres livraison',winback:'J+30, J+60, J+90 sans achat'};
  const icons={abandoned_cart:'&#128722;',upsell:'&#127873;',winback:'&#128140;'};
  let h='';
  flows.forEach(f=>{
    h+='<div class="flow-row"><div class="flow-info"><span class="flow-icon">'+(icons[f.flow_name]||'')+'</span><div><div class="flow-name">'+(n[f.flow_name]||f.flow_name)+'</div><div class="flow-desc">'+(d[f.flow_name]||'')+'</div></div></div><label class="toggle"><input type="checkbox" '+(f.enabled?'checked':'')+' onchange="toggleFlow(\\''+f.flow_name+'\\',this.checked)"><span class="slider"></span></label></div>';
  });
  document.getElementById('flowControls').innerHTML=h;
}
async function toggleFlow(n,e){await fetch(SERVER+'/api/flows/'+n+'/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:e})})}

function renderCheckouts(data){
  const tb=document.querySelector('#checkoutsTable tbody');
  tb.innerHTML=data.map(c=>{
    let items='-';
    try{const p=typeof c.line_items==='string'?JSON.parse(c.line_items||'[]'):(c.line_items||[]);items=p.map(i=>i.title+(i.quantity>1?' x'+i.quantity:'')).join(', ')||'-'}catch(e){}
    return '<tr><td>'+fmtDate(c.created_at)+'</td><td style="font-weight:500">'+(c.customer_name||'-')+'</td><td>'+(c.email||'-')+'</td><td>'+(c.phone||'-')+'</td><td style="font-weight:600">'+(c.total_price||'0')+' EUR</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">'+items+'</td><td>'+(c.converted?badge('converted'):badge('abandoned'))+'</td></tr>';
  }).join('');
}

function renderMessages(data){
  const tb=document.querySelector('#messagesTable tbody');
  tb.innerHTML=data.map(m=>'<tr><td>'+fmtDate(m.created_at)+'</td><td>'+m.phone+'</td><td style="font-weight:500">'+m.flow+'</td><td style="font-size:12px">'+m.template+'</td><td>'+badge(m.status)+'</td><td>'+fmtDate(m.sent_at)+'</td><td style="font-size:11px;color:var(--danger);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(m.error||'')+'</td></tr>').join('');
}

loadAll();
setInterval(loadAll,60000);
</script>
</body>
</html>`;
}

module.exports = { getDashboardHTML };
