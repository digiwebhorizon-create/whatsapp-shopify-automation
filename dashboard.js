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
.header .logo { display: flex; align-items: center; gap: 12px; }
.header .logo-icon {
  width: 32px; height: 32px;
  background: rgba(255,255,255,0.15);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
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
  cursor: pointer; font-size: 12px; font-family: 'Poppins', sans-serif;
  transition: all 0.2s;
}
.refresh-btn:hover { background: rgba(255,255,255,0.25); }
.last-refresh { font-size: 11px; color: rgba(255,255,255,0.5); }

/* Container */
.container { max-width: 1360px; margin: 0 auto; padding: 24px; }

/* KPI Grid */
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
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
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Warning banner */
.warning-banner { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #92400e; margin-bottom: 16px; display: flex; align-items: flex-start; gap: 8px; }
.warning-banner strong { font-weight: 700; }

/* Status message */
.status-msg { font-size: 12px; padding: 4px 0; }
.status-msg.ok { color: var(--success); }
.status-msg.err { color: var(--danger); }

@media (max-width: 1024px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .chart-grid { grid-template-columns: 1fr; }
  .header { padding: 0 16px; }
  .container { padding: 16px; }
  .modal { width: 96%; }
}
</style>
</head>
<body>

<div class="header">
  <div class="logo">
    <div class="logo-icon">LB</div>
    <h1>Le Bourlingueur — Marketing WhatsApp</h1>
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
      <div class="card-header"><h2>Heures d envoi</h2></div>
      <div class="card-body" id="hourlyChart"></div>
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
          <thead><tr><th>Cree</th><th>Prevu</th><th>Tel</th><th>Flow</th><th>Template</th><th>Statut</th><th>Envoye</th><th>Erreur</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- Modal templates -->
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

async function api(p){return(await fetch(SERVER+p)).json()}
function fmtDate(d){if(!d)return'-';const dt=new Date(d.replace(' ','T')+(d.includes('Z')?'':'Z'));return dt.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function badge(s){const labels={sent:'Envoye',queued:'En attente',failed:'Echoue',cancelled:'Annule',converted:'Recupere',abandoned:'Abandonne',APPROVED:'Approuve',PENDING:'En review',REJECTED:'Rejete'};return '<span class="badge '+s+'">'+(labels[s]||s)+'</span>'}

function switchTab(name,el){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-'+name).classList.add('active');
}

const FLOW_TEMPLATES={
  abandoned_cart:['panier_rappel_1','panier_rappel_2','panier_rappel_promo'],
  upsell:['post_purchase_upsell'],
  winback:['winback_news','winback_offer_15','winback_offer_20']
};

async function loadAll(){
  try{
    document.getElementById('lastRefresh').textContent=new Date().toLocaleTimeString('fr-FR');
    const s=await api('/api/stats');
    isTestMode=!!s.test_mode;
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
    try{const t=await api('/api/templates');if(Array.isArray(t))allTemplates=t;}catch(e){}
    try{const cp=await api('/api/campaigns');renderCampaigns(cp);}catch(e){}
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
  const n={abandoned_cart:'Panier abandonne',upsell:'Upsell post-achat',winback:'Winback reactivation'};
  const d=isTestMode
    ?{abandoned_cart:'TEST : 1 min, 2 min, 3 min',upsell:'TEST : 5 min apres livraison',winback:'J+30, J+60, J+90 sans achat'}
    :{abandoned_cart:'Envoi a +30 min, +24h, +48h apres abandon',upsell:'Envoi a J+5 apres livraison',winback:'Envoi a J+30, J+60, J+90 sans achat'};
  const icons={abandoned_cart:'&#128722;',upsell:'&#127873;',winback:'&#128140;'};
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
  const names={abandoned_cart:'Panier abandonne',upsell:'Upsell post-achat',winback:'Winback reactivation'};
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

function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

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

// ─── Campaigns push ─────────────────────────────
function renderCampaigns(data){
  const el=document.getElementById('campaignsList');
  if(!data||data.length===0){
    el.innerHTML='<div style="color:var(--text-secondary);font-size:13px;text-align:center;padding:10px">Aucune campagne — cliquez sur "+ Nouvelle campagne" pour commencer</div>';
    return;
  }
  let h='<table><thead><tr><th>Date</th><th>Nom</th><th>Template</th><th>Cibles</th><th>Envoyes</th><th>Echecs</th><th>Statut</th><th>Action</th></tr></thead><tbody>';
  data.forEach(c=>{
    const statusMap={draft:'En attente',sending:'Envoi...',sent:'Termine',completed:'Termine',cancelled:'Annule'};
    const statusClass={draft:'queued',sending:'queued',sent:'sent',completed:'sent',cancelled:'cancelled'};
    h+='<tr><td>'+fmtDate(c.created_at)+'</td><td style="font-weight:600">'+escHtml(c.name)+'</td><td style="font-size:12px">'+escHtml(c.template)+'</td><td style="text-align:center">'+c.target_count+'</td><td style="text-align:center;color:var(--success);font-weight:600">'+c.sent_count+'</td><td style="text-align:center;color:var(--danger)">'+c.failed_count+'</td><td>'+badge(statusClass[c.status]||c.status)+'</td>';
    if(c.status==='sending'||c.status==='draft'){
      h+='<td><button class="btn btn-secondary" style="font-size:11px;padding:4px 10px" onclick="cancelCampaign('+c.id+')">Annuler</button></td>';
    }else{
      h+='<td>-</td>';
    }
    h+='</tr>';
  });
  h+='</tbody></table>';
  el.innerHTML=h;
}

async function openCampaignModal(){
  // Load customers count and templates
  let customers=[];
  try{customers=await api('/api/customers');}catch(e){}

  document.getElementById('modalTitle').textContent='Nouvelle campagne push';

  let tplOptions='';
  allTemplates.filter(t=>t.status==='APPROVED'&&t.language==='fr').forEach(t=>{
    tplOptions+='<option value="'+escHtml(t.name)+'">'+escHtml(t.name)+'</option>';
  });

  let h='<div class="warning-banner">&#128227; <div><strong>Campagne push</strong> — Envoie un template Meta WhatsApp a tous vos clients avec un numero de telephone. Les messages passent par la queue et respectent la plage horaire 8h-21h.</div></div>';

  h+='<div style="margin-bottom:16px"><div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px"><strong>'+customers.length+'</strong> clients avec numero de telephone</div>';

  h+='<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Nom de la campagne</label><input type="text" id="campaignName" placeholder="Ex: Soldes printemps 2026" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-family:Poppins,sans-serif;font-size:13px"></div>';

  h+='<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Template Meta (approuve)</label><select id="campaignTemplate" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-family:Poppins,sans-serif;font-size:13px">';
  h+=tplOptions||'<option value="">Aucun template approuve</option>';
  h+='</select></div>';

  h+='<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 14px;font-size:12px;color:#166534;margin-bottom:16px">&#9989; <strong>'+customers.length+' destinataires</strong> recevront ce message via la queue (plage 8h-21h)</div>';

  h+='<div style="display:flex;gap:8px"><button class="btn btn-magenta" onclick="sendCampaign()" id="sendCampaignBtn">Lancer la campagne</button><button class="btn btn-secondary" onclick="closeModal()">Annuler</button><span class="status-msg" id="campaignStatus"></span></div></div>';

  document.getElementById('modalBody').innerHTML=h;
  document.getElementById('modalOverlay').classList.add('open');
}

async function sendCampaign(){
  const name=document.getElementById('campaignName').value.trim();
  const template=document.getElementById('campaignTemplate').value;
  const status=document.getElementById('campaignStatus');
  const btn=document.getElementById('sendCampaignBtn');

  if(!name){status.className='status-msg err';status.textContent='Donnez un nom a la campagne';return;}
  if(!template){status.className='status-msg err';status.textContent='Selectionnez un template';return;}

  btn.disabled=true;
  status.className='status-msg';
  status.textContent='Lancement...';

  try{
    const res=await fetch(SERVER+'/api/campaigns',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,template})
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

loadAll();
setInterval(loadAll,60000);
</script>
</body>
</html>`;
}

module.exports = { getDashboardHTML };
