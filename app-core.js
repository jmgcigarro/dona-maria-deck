const SUPABASE_URL='https://hrlfwpwzciljwpgejmha.supabase.co';
const SUPABASE_PUBLIC_KEY='sb_publishable_2VSqW87Rn7f4OwC1EXDSoQ_CInkq7mK';
const APP_VERSION='2026.06.30-01';
const db=window.supabase ? window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY) : null;
const RESTAURANT_TABLES=['faturacao_historica','faturacao_diaria','fornecedores_historico','ordenados','despesas_fixas','investimentos'];
let restaurantDataCache=null;
let restaurantDataPromise=null;

function dmCell(row,names){
  for(const name of names){
    if(row && Object.prototype.hasOwnProperty.call(row,name) && row[name]!==null && row[name]!==undefined) return row[name];
  }
  const normalize=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const wanted=names.map(normalize);
  const key=Object.keys(row||{}).find(k=>wanted.includes(normalize(k)));
  return key ? row[key] : null;
}

function dmNumber(value){
  if(typeof value==='number') return Number.isFinite(value)?value:0;
  let s=String(value??'').trim();
  if(!s) return 0;
  s=s.replace(/\s/g,'').replace(/€/g,'');
  if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
  const n=Number(s.replace(/[^0-9.-]/g,''));
  return Number.isFinite(n)?n:0;
}

function dmDate(value){
  if(!value) return null;
  if(value instanceof Date && !isNaN(value)) return value;
  const s=String(value).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.slice(0,10)+'T00:00:00');
  const numeric=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if(numeric){
    const year=Number(numeric[3].length===2?'20'+numeric[3]:numeric[3]);
    return new Date(year,Number(numeric[2])-1,Number(numeric[1]));
  }
  const d=new Date(s+'T00:00:00');
  return isNaN(d)?null:d;
}

function computeRevenueEstimate(rows,date=new Date()){
  const year=date.getFullYear();
  const month=date.getMonth();
  const todayStart=new Date(year,month,date.getDate());
  const daysInMonth=new Date(year,month+1,0).getDate();
  const dailyTotals={};
  (rows||[]).forEach(row=>{
    const d=dmDate(dmCell(row,['Data','data']));
    if(!d || isNaN(d) || d.getFullYear()!==year || d.getMonth()!==month || d>todayStart) return;
    const value=dmNumber(dmCell(row,['Valor','valor']));
    if(value<=0) return;
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    dailyTotals[key]=(dailyTotals[key]||0)+value;
  });
  const observedDays=Object.keys(dailyTotals).length;
  const observedTotal=Object.values(dailyTotals).reduce((a,b)=>a+b,0);
  const dailyAverage=observedDays?observedTotal/observedDays:0;
  return {year,month,daysInMonth,observedDays,dailyAverage,observedTotal,estimated:observedDays?dailyAverage*daysInMonth:0};
}

function notify(message,type='info',timeout=3200){
  let host=document.getElementById('toastHost');
  if(!host){
    host=document.createElement('div');
    host.id='toastHost';
    host.className='toast-host';
    document.body.appendChild(host);
  }
  const toast=document.createElement('div');
  toast.className='toast '+type;
  toast.textContent=message;
  host.appendChild(toast);
  setTimeout(()=>{toast.style.opacity='0';toast.style.transform='translateY(6px)';},timeout);
  setTimeout(()=>toast.remove(),timeout+260);
}

async function fetchTableRows(table){
  if(!db) throw new Error('Supabase não carregou no browser.');
  const {data,error}=await db.from(table).select('*');
  if(error) throw error;
  return data||[];
}

async function loadRestaurantData(force=false){
  if(restaurantDataCache && !force) return restaurantDataCache;
  if(restaurantDataPromise && !force) return restaurantDataPromise;
  const sessionInfo=db?.auth?.getSession ? await db.auth.getSession().catch(()=>null) : null;
  if(!sessionInfo?.data?.session && !force) throw new Error('Sessão Supabase ainda não está pronta para carregar dados.');
  restaurantDataPromise=Promise.all(RESTAURANT_TABLES.map(fetchTableRows)).then(rows=>{
    const data={loadedAt:new Date()};
    RESTAURANT_TABLES.forEach((table,i)=>{data[table]=rows[i]||[];});
    restaurantDataCache=data;
    restaurantDataPromise=null;
    return data;
  }).catch(error=>{restaurantDataPromise=null;throw error;});
  return restaurantDataPromise;
}

function invalidateRestaurantData(){
  restaurantDataCache=null;
  restaurantDataPromise=null;
}
window.loadRestaurantData=loadRestaurantData;
window.invalidateRestaurantData=invalidateRestaurantData;

function getAnoMesDiaFromDate(dateStr){
  const d=new Date(dateStr);
  return {
    ano:d.getFullYear(),
    mes:meses[d.getMonth()],
    dia:d.getDate()
  };
}

async function saveFaturacaoDiariaOnline(dateStr,valor){
  if(!db) throw new Error('Supabase não carregou no browser.');
  await assertNoFaturacaoDiariaDuplicate(dateStr);
  const d=getAnoMesDiaFromDate(dateStr);
  const payload={
    "Data":dateStr,
    "Ano":d.ano,
    "Mês":d.mes,
    "Dia":d.dia,
    "Valor":valor
  };
  const {data,error}=await db.from('faturacao_diaria').insert([payload]).select('*').single();
  if(error) throw error;
  invalidateRestaurantData();
  return data||payload;
}

function currentYear(){ return new Date().getFullYear(); }

async function insertOnline(table,payload){
  if(!db) throw new Error('Supabase não carregou no browser.');
  const {data,error}=await db.from(table).insert([payload]).select('*').single();
  if(error) throw error;
  if(RESTAURANT_TABLES.includes(table)) invalidateRestaurantData();
  return data||payload;
}

function normalizeKey(value){
  return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function rowDateISO(row){
  let dataStr=getTableValue(row,['Data','data']);
  if(dataStr) return String(dataStr).slice(0,10);
  const ano=Number(getTableValue(row,['Ano','ano']));
  const mesIndex=monthIndexFromName(getTableValue(row,['Mês','mes']));
  const dia=Number(getTableValue(row,['Dia','dia']));
  if(ano && mesIndex>=0 && dia) return `${ano}-${String(mesIndex+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  return '';
}

async function assertNoFaturacaoDiariaDuplicate(dateStr){
  const target=String(dateStr||'').slice(0,10);
  if(!target) return;
  const {data,error}=await db.from('faturacao_diaria').select('*');
  if(error) throw new Error('Não foi possível verificar se esta data já existe na faturação diária.');
  const exists=(data||[]).some(row=>rowDateISO(row)===target);
  if(exists) throw new Error(`A faturação do dia ${formatDatePT(target)} já foi registada.`);
}

async function assertNoDespesaFixaDuplicate(ano,mes,tipo){
  const targetMes=normalizeKey(mes);
  const targetTipo=normalizeKey(tipo);
  if(!ano || !targetMes || !targetTipo) return;
  const {data,error}=await db.from('despesas_fixas').select('*');
  if(error) throw new Error('Não foi possível verificar se esta despesa fixa já existe.');
  const exists=(data||[]).some(row=>{
    const rowAno=Number(getTableValue(row,['Ano','ano']));
    const rowMes=normalizeKey(getTableValue(row,['Mês','mes']));
    const rowTipo=normalizeKey(getTableValue(row,['Tipo','tipo']));
    return rowAno===Number(ano) && rowMes===targetMes && rowTipo===targetTipo;
  });
  if(exists) throw new Error(`A despesa fixa "${tipo}" de ${mes} ${ano} já foi registada.`);
}

async function assertNoOrdenadoDuplicate(ano,mes,funcionario){
  const targetMes=normalizeKey(mes);
  const targetFuncionario=normalizeKey(funcionario);
  if(!ano || !targetMes || !targetFuncionario) return;
  const {data,error}=await db.from('ordenados').select('*');
  if(error) throw new Error('Não foi possível verificar se este ordenado já existe.');
  const exists=(data||[]).some(row=>{
    const rowAno=Number(getTableValue(row,['Ano','ano']));
    const rowMes=normalizeKey(getTableValue(row,['Mês','mes']));
    const rowFuncionario=normalizeKey(getTableValue(row,['Funcionário','Funcionário/a','Funcionario','funcionario']));
    return rowAno===Number(ano) && rowMes===targetMes && rowFuncionario===targetFuncionario;
  });
  if(exists) throw new Error(`O ordenado de "${funcionario}" de ${mes} ${ano} já foi registado.`);
}

function isAggregateFixedType(value){
  const s=normalizeKey(value);
  return ['total','totais','subtotal','sub total'].includes(s);
}

const listManagerConfig={
  fornecedores:{title:'Gerir fornecedores',label:'Novo fornecedor',table:'lista_fornecedores',column:'Fornecedor',placeholder:'Ex.: Aviludo'},
  funcionarios:{title:'Gerir funcionários',label:'Novo funcionário',table:'lista_funcionarios',column:'Funcionário',placeholder:'Ex.: Maria Silva'},
  despesas:{title:'Gerir despesas fixas',label:'Nova despesa fixa',table:'lista_despesas_fixas',column:'Tipo',placeholder:'Ex.: Telecomunicações',filterFn:v=>!isAggregateFixedType(v)}
};
let activeListManager='fornecedores';

function escapeHTML(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

async function loadListManagerItems(){
  const cfg=listManagerConfig[activeListManager];
  const itemsEl=document.getElementById('cfgListItems');
  const status=document.getElementById('cfgListManagerStatus');
  if(!cfg||!itemsEl) return;
  if(!db){
    if(status) status.textContent='Supabase não carregou no browser.';
    return;
  }
  itemsEl.innerHTML='<div class="setting-row"><span>A carregar...</span><b>—</b></div>';
  const {data,error}=await db.from(cfg.table).select(`"${cfg.column}"`).order(cfg.column,{ascending:true});
  if(error){
    console.warn('Erro ao carregar gestor de lista',cfg.table,error);
    itemsEl.innerHTML='<div class="setting-row"><span>Erro ao carregar a lista.</span><b>—</b></div>';
    if(status) status.textContent='Não foi possível carregar esta lista. Verifica permissões/RLS no Supabase.';
    return;
  }
  let values=[...new Set((data||[]).map(row=>row[cfg.column]).filter(Boolean))];
  if(cfg.filterFn) values=values.filter(cfg.filterFn);
  itemsEl.innerHTML=values.map(value=>`<div class="setting-row"><span>${escapeHTML(value)}</span><b>Ativo</b></div>`).join('') || '<div class="setting-row"><span>Sem itens nesta lista.</span><b>—</b></div>';
  if(status) status.textContent=`${values.length} ${values.length===1?'item carregado':'itens carregados'} nesta lista.`;
}

async function openListManager(type){
  const cfg=listManagerConfig[type];
  if(!cfg) return;
  const box=document.getElementById('cfgListManager');
  if(box && box.classList.contains('active') && activeListManager===type){
    box.classList.remove('active');
    return;
  }
  activeListManager=type;
  const title=document.getElementById('cfgListManagerTitle');
  const table=document.getElementById('cfgListManagerTable');
  const label=document.getElementById('cfgListInputLabel');
  const input=document.getElementById('cfgListInput');
  if(box) box.classList.add('active');
  if(title) title.textContent=cfg.title;
  if(table) table.textContent=cfg.table;
  if(label) label.textContent=cfg.label;
  if(input){
    input.value='';
    input.placeholder=cfg.placeholder;
    setTimeout(()=>input.focus(),0);
  }
  await loadListManagerItems();
}

async function saveListItem(ev){
  ev.preventDefault();
  const cfg=listManagerConfig[activeListManager];
  const input=document.getElementById('cfgListInput');
  const status=document.getElementById('cfgListManagerStatus');
  const value=String(input?.value||'').trim();
  if(!cfg||!value) return;
  if(window.currentUserProfile==='Visitante'){
    const msg='Perfil Visitante: apenas consulta. Entra como Administrador ou Gerente para alterar listas.';
    if(status) status.textContent=msg;
    notify(msg,'warn');
    return;
  }
  if(!db){
    if(status) status.textContent='Supabase não carregou no browser.';
    return;
  }
  try{
    if(status) status.textContent='A verificar a lista...';
    const {data,error}=await db.from(cfg.table).select(`"${cfg.column}"`);
    if(error) throw error;
    const exists=(data||[]).some(row=>normalizeKey(row[cfg.column])===normalizeKey(value));
    if(exists) throw new Error(`"${value}" já existe nesta lista.`);
    if(cfg.filterFn && !cfg.filterFn(value)) throw new Error('Este nome está reservado e não pode ser usado nesta lista.');
    const payload={};
    payload[cfg.column]=value;
    const {error:insertError}=await db.from(cfg.table).insert([payload]);
    if(insertError) throw insertError;
    if(input) input.value='';
    if(status) status.textContent=`"${value}" foi adicionado ao Supabase.`;
    notify('Item adicionado à lista.','good');
    await loadListsFromSupabase();
  }catch(error){
    console.error(error);
    const raw=error.message||String(error);
    const msg=raw.includes('row-level security') || raw.includes('violates row-level security')
      ? `O Supabase está a bloquear alterações em "${cfg.table}" por RLS. É preciso criar uma policy de INSERT para utilizadores autenticados.`
      : raw;
    if(status) status.textContent=msg;
    notify(msg,'bad',5200);
  }
}

async function loadSelectFromTable(table,column,selector,includeAll=false,allLabel='Todos os fornecedores',filterFn=null){
  if(!db) return {count:0,error:new Error('Supabase não carregou no browser.')};
  const {data,error}=await db.from(table).select(`"${column}"`).order(column,{ascending:true});
  if(error){ console.warn('Erro ao carregar lista',table,error); return {count:0,error}; }
  let values=[...new Set((data||[]).map(r=>r[column]).filter(Boolean))];
  if(filterFn) values=values.filter(filterFn);
  document.querySelectorAll(selector).forEach(select=>{
    const current=select.value;
    const options=(includeAll?['__all']:[]).concat(values);
    select.innerHTML=options.map(v=> v==='__all' ? `<option value="__all">${allLabel}</option>` : `<option>${v}</option>`).join('');
    if(options.includes(current)) select.value=current;
  });
  return {count:values.length,error:null};
}

async function loadListsFromSupabase(){
  const status=document.getElementById('cfgListStatus');
  if(status) status.textContent='A carregar listas do Supabase...';

  const fornecedores=await loadSelectFromTable('lista_fornecedores','Fornecedor','#entrada-fornecedores select[name="categoria"]');
  const funcionarios=await loadSelectFromTable('lista_funcionarios','Funcionário','#entrada-pessoal select[name="categoria"]');
  const despesas=await loadSelectFromTable('lista_despesas_fixas','Tipo','#entrada-fixas select[name="categoria"]',false,'Todos os fornecedores',v=>!isAggregateFixedType(v));
  await loadSelectFromTable('lista_fornecedores','Fornecedor','#supplierSelect',true);
  await loadSelectFromTable('lista_despesas_fixas','Tipo','#fixedExpenseSelect',true,'Todas as Despesas',v=>!isAggregateFixedType(v));

  const cf=document.getElementById('cfgCountFornecedores');
  const cfu=document.getElementById('cfgCountFuncionarios');
  const cd=document.getElementById('cfgCountDespesasFixas');
  if(cf) cf.textContent=fornecedores.count;
  if(cfu) cfu.textContent=funcionarios.count;
  if(cd) cd.textContent=despesas.count;
  if(status){
    if(fornecedores.error||funcionarios.error||despesas.error){
      status.textContent='Não foi possível carregar uma ou mais listas. Verifica permissões/RLS no Supabase.';
      status.classList.add('warn');
    }else{
      status.classList.remove('warn');
      status.textContent='Listas carregadas da Base de Dados. Qualquer alteração feita nas tabelas de listas aparece aqui após atualizar.';
    }
  }
  if(document.getElementById('cfgListManager')?.classList.contains('active')){
    await loadListManagerItems();
  }
  changeSupplier();
}

const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const fmt=createEuroFormatter();
function formatEuroAmount(value){
  const n=Number(value)||0;
  const sign=n<0?'-':'';
  const [whole,dec]=Math.abs(n).toFixed(1).split('.');
  return `${sign}${whole.replace(/\B(?=(\d{3})+(?!\d))/g,' ')},${dec} €`;
}
function createEuroFormatter(){
  return {format:formatEuroAmount};
}
function parseCurrency(value){
  if(value===null||value===undefined)return 0;
  let s=String(value).trim();
  if(!s)return 0;
  s=s.replace(/\s/g,'').replace(/€/g,'');
  // Portuguese format: 1.234,56 or 1 234,56. Also accepts 1234.56 while typing.
  if(s.includes(',')){
    s=s.replace(/\./g,'').replace(',','.');
  }
  const n=Number(s.replace(/[^0-9.-]/g,''));
  return Number.isFinite(n)?n:0;
}
function formatCurrencyValue(value){
  const n=typeof value==='number'?value:parseCurrency(value);
  return n?fmt.format(n).replace(/ /g,' '):'';
}
function formatCurrencyTyping(input){
  // While typing, keep the user's number mostly intact and only normalize invalid characters.
  input.value=input.value.replace(/[^0-9,\.]/g,'');
}
function formatCurrencyField(input){
  const n=parseCurrency(input.value);
  input.value=n?fmt.format(n).replace(/ /g,' '):'';
}
function bindCurrencyInputs(){
  document.querySelectorAll('.currency-input').forEach(input=>{
    input.addEventListener('input',()=>formatCurrencyTyping(input));
    input.addEventListener('blur',()=>formatCurrencyField(input));
    input.addEventListener('focus',()=>{
      const n=parseCurrency(input.value);
      input.value=n?String(n).replace('.',','):'';
      setTimeout(()=>input.select(),0);
    });
  });
}

const inputPages=[['entrada-faturacao','Faturação Diária Restaurante','Registar vendas diárias do restaurante.'],['entrada-fornecedores','Despesas com Fornecedores','Lançar faturas e pagamentos de fornecedores.'],['entrada-pessoal','Ordenados','Registar ordenados e encargos com pessoal.'],['entrada-fixas','Despesas Fixas','Controlar rendas, energia, água, gás e serviços.'],['entrada-investimentos','Investimentos','Registar obras, equipamentos e melhorias.']];
const reportPages=[['resumo','Resumo / Alertas','Indicadores do mês a decorrer e evolução anual.'],['fat-mes','Faturação - Atual','Consultar dia a dia do mês a decorrer.'],['fat-anteriores','Faturação - Histórico','Consultar meses já fechados no ano atual.'],['fornecedores','Fornecedores','Comparar fornecedores e consultar detalhe individual.'],['despesas-fixas-consulta','Despesas Fixas','Consultar evolução e detalhe das despesas fixas.'],['resultados','Resultados','Lucro mensal, despesas, margens e comparativo com anos anteriores.'],['analises','Análises','Tendências, desvios, alertas e leitura evolutiva.'],['assistente','Assistente IA','Perguntas em linguagem natural sobre a gestão do restaurante.'],['configuracoes','Configurações','Listas, utilizadores, segurança e backup.']];
const pages=[['inicio','Início','Capa da ferramenta de gestão Dona Maria Deck.'],...reportPages,...inputPages];
const RECENT_RECORDS_KEY='dm_records_v4';
const RECENT_RECORDS_TTL_MS=24*60*60*1000;
function getRecentRecordTime(record){
  const stamp=Number(record?.createdAt||record?.id);
  return Number.isFinite(stamp)?stamp:Date.now();
}
function filterRecentRecords(items){
  const now=Date.now();
  return (Array.isArray(items)?items:[]).filter(record=>now-getRecentRecordTime(record)<RECENT_RECORDS_TTL_MS);
}
function loadRecentRecords(){
  let stored=[];
  try{stored=JSON.parse(localStorage.getItem(RECENT_RECORDS_KEY)||'[]');}
  catch(error){console.warn('Não foi possível ler os registos recentes.',error);}
  const fresh=filterRecentRecords(stored);
  if(fresh.length!==stored.length) localStorage.setItem(RECENT_RECORDS_KEY,JSON.stringify(fresh));
  return fresh;
}
function saveRecentRecords(){
  records=filterRecentRecords(records);
  localStorage.setItem(RECENT_RECORDS_KEY,JSON.stringify(records));
}
function addRecentRecord(record){
  const createdAt=Date.now();
  records.unshift({...record,id:createdAt,createdAt});
}
let records=loadRecentRecords();
const daily=[1240,1390,1810,2310,2980,2520,980,1430,1680,1720,2290,3420,2870,1100,1450,1820,1930,1460,1920,2480,2140];
function addBtns(host,arr){arr.forEach(p=>{const b=document.createElement('button');b.textContent=p[1];b.dataset.page=p[0];b.onclick=()=>show(p[0]);host.appendChild(b);});}
function build(){bindCurrencyInputs();addBtns(navInputs,inputPages);addBtns(navReports,reportPages);addBtns(phonebar,[['inicio','Início',''],...inputPages.map(p=>[p[0],p[1].replace('Faturação Diária Restaurante','Faturação').replace('Despesas com Fornecedores','Fornecedores').replace('Despesas Fixas','Fixas').replace('Investimentos','Invest.'),p[2]]),...reportPages.map(p=>[p[0],p[1].replace('Resumo / Alertas','Resumo').replace('Faturação - Atual','Fat. Atual').replace('Faturação - Histórico','Fat. Hist.').replace('Despesas Fixas','Fixas').replace('Assistente IA','IA').replace('Configurações','Config.'),p[2]])]);document.querySelectorAll('select[name="mes"]').forEach(s=>{s.innerHTML=meses.map(m=>`<option>${m}</option>`).join('')});renderRecords();updateNav('inicio');loadListsFromSupabase();}
function installPageFooters(){
  const text='© 2026 Dona Maria Deck · InteliGest';
  document.querySelectorAll('.section').forEach(section=>{
    if(section.querySelector('.cover-footer,.page-footer')) return;
    const footer=document.createElement('div');
    footer.className='cover-footer page-footer';
    footer.textContent=text;
    section.appendChild(footer);
  });
}
function getAppScroller(){
  const main=document.querySelector('.main');
  if(!main) return window;
  const overflowY=getComputedStyle(main).overflowY;
  const canScroll=/(auto|scroll)/.test(overflowY) && main.scrollHeight>main.clientHeight;
  return canScroll?main:window;
}
function scrollAppTop(){
  const topOffset=window.matchMedia&&window.matchMedia('(max-width:560px)').matches?1:0;
  const scroller=getAppScroller();
  scroller.scrollTo({top:topOffset,behavior:'auto'});
}
function show(id){document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');const p=pages.find(x=>x[0]===id)||['resumo','Resumo',''];title.textContent=p[1];subtitle.textContent=p[2];updateNav(id);updateSectionMinHeight();scrollAppTop();}
function updateNav(id){document.querySelectorAll('button[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===id));const actions=document.getElementById('userActions');if(actions)actions.hidden=id!=='inicio';}
function updatePhonebarHeight(){
  const bar=document.getElementById('phonebar');
  const visible=bar&&getComputedStyle(bar).display!=='none';
  const measured=visible?Math.ceil(bar.getBoundingClientRect().height||bar.offsetHeight||0):0;
  const isTabletOrPhone=window.matchMedia&&window.matchMedia('(max-width:980px)').matches;
  const height=visible?Math.max(measured,isTabletOrPhone?96:0):0;
  document.documentElement.style.setProperty('--phonebar-height',`${height}px`);
  updateSectionMinHeight();
}
function updateSectionMinHeight(){
  const main=document.querySelector('.main');
  if(!main) return;
  const styles=getComputedStyle(main);
  const padTop=parseFloat(styles.paddingTop)||0;
  const padBottom=parseFloat(styles.paddingBottom)||0;
  const header=main.querySelector(':scope > .top');
  const headerStyles=header?getComputedStyle(header):null;
  const headerHeight=header?(header.getBoundingClientRect().height+(parseFloat(headerStyles.marginBottom)||0)):0;
  const viewportHeight=Math.round((window.visualViewport&&window.visualViewport.height)||window.innerHeight||document.documentElement.clientHeight||0);
  const minHeight=Math.max(0,viewportHeight-padTop-padBottom-headerHeight);
  document.documentElement.style.setProperty('--section-min-height',`${minHeight}px`);
}
function installPhonebarInset(){
  updatePhonebarHeight();
  window.addEventListener('resize',updatePhonebarHeight,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(updatePhonebarHeight,250),{passive:true});
  if(window.visualViewport) window.visualViewport.addEventListener('resize',updatePhonebarHeight,{passive:true});
  if(window.ResizeObserver){
    const bar=document.getElementById('phonebar');
    if(bar){
      window.__phonebarResizeObserver=new ResizeObserver(updatePhonebarHeight);
      window.__phonebarResizeObserver.observe(bar);
    }
  }
}
function chartBarHeights(el,desktopMax=165,desktopMin=34){
  const rect=el.getBoundingClientRect();
  const styles=getComputedStyle(el);
  const padTop=parseFloat(styles.paddingTop)||0;
  const padBottom=parseFloat(styles.paddingBottom)||0;
  const usable=Math.max(80,(rect.height||el.clientHeight||270)-padTop-padBottom);
  return {
    max:Math.min(desktopMax,Math.max(44,usable*0.82)),
    min:Math.min(desktopMin,Math.max(14,usable*0.16))
  };
}
function installZoomLock(){
  document.addEventListener('wheel',ev=>{
    if(ev.ctrlKey || ev.metaKey) ev.preventDefault();
  },{passive:false});
  document.addEventListener('keydown',ev=>{
    const key=String(ev.key||'').toLowerCase();
    if((ev.ctrlKey||ev.metaKey) && ['+','=','-','_','0'].includes(key)){
      ev.preventDefault();
    }
  });
  ['gesturestart','gesturechange','gestureend'].forEach(type=>{
    document.addEventListener(type,ev=>ev.preventDefault(),{passive:false});
  });
  document.addEventListener('touchmove',ev=>{
    if(ev.touches && ev.touches.length>1) ev.preventDefault();
  },{passive:false});
}
function formatDateTimePT(date){
  return date.toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',','');
}
function updateBackupTimestamp(){
  const el=document.getElementById('cfgLastBackup');
  if(!el) return;
  const parsed=new Date(document.lastModified);
  el.textContent=!isNaN(parsed)?formatDateTimePT(parsed):APP_VERSION;
}

function downloadTextFile(filename,content,type='text/csv;charset=utf-8'){
  const blob=new Blob(['\ufeff'+content],{type});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function xmlEscape(value){
  return String(value??'').replace(/[<>&'"]/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[ch]));
}

function excelCell(value){
  if(value===null||value===undefined) return '<Cell><Data ss:Type="String"></Data></Cell>';
  const n=typeof value==='number'?value:Number(value);
  if(value!=='' && Number.isFinite(n) && String(value).trim()!=='') return `<Cell><Data ss:Type="Number">${n}</Data></Cell>`;
  return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

function safeSheetName(name){
  return String(name).replace(/[:\\/?*\[\]]/g,' ').slice(0,31);
}

function buildExportWorkbookXml(data){
  const tableLabels={
    faturacao_historica:'Faturacao historica',
    faturacao_diaria:'Faturacao diaria',
    fornecedores_historico:'Fornecedores',
    ordenados:'Ordenados',
    despesas_fixas:'Despesas fixas',
    investimentos:'Investimentos'
  };
  const worksheets=RESTAURANT_TABLES.map(table=>{
    const rows=data[table]||[];
    const columns=[...new Set(rows.flatMap(row=>Object.keys(row||{})))];
    const header=columns.length ? `<Row>${columns.map(excelCell).join('')}</Row>` : '<Row><Cell><Data ss:Type="String">Sem dados</Data></Cell></Row>';
    const body=rows.map(row=>`<Row>${columns.map(col=>excelCell(row[col])).join('')}</Row>`).join('');
    return `<Worksheet ss:Name="${xmlEscape(safeSheetName(tableLabels[table]||table))}"><Table>${header}${body}</Table></Worksheet>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Dona Maria Deck Export</Title>
  <Created>${new Date().toISOString()}</Created>
  <Version>${xmlEscape(APP_VERSION)}</Version>
 </DocumentProperties>
 ${worksheets}
</Workbook>`;
}

async function exportRestaurantData(){
  try{
    notify('A preparar exportação dos dados...','info');
    const data=await loadRestaurantData(true);
    const workbook=buildExportWorkbookXml(data);
    const stamp=APP_VERSION.replace(/[^\d]/g,'').slice(0,12);
    downloadTextFile(`dona-maria-deck-export-${stamp}.xls`,workbook,'application/vnd.ms-excel;charset=utf-8');
    notify('Exportação Excel descarregada com várias folhas.','good');
  }catch(error){
    console.error(error);
    notify('Erro ao exportar dados: '+(error.message||String(error)),'bad',6500);
  }
}
window.exportRestaurantData=exportRestaurantData;
function runIfExists(name){
  try{ if(typeof window[name]==='function') return window[name](); }catch(e){ console.warn('Erro ao atualizar '+name,e); }
  return null;
}
async function refreshAppData(){
  invalidateRestaurantData();
  renderRecords();
  updateBackupTimestamp();
  const tasks=[
    typeof loadListsFromSupabase==='function'?loadListsFromSupabase():null,
    typeof loadFaturacaoAtualReal==='function'?loadFaturacaoAtualReal():null,
    typeof loadResultadosReais==='function'?loadResultadosReais():null,
    typeof loadAnalisesReais==='function'?loadAnalisesReais():null,
    typeof loadV39==='function'?loadV39():null,
    runIfExists('loadFornecedoresReais'),
    runIfExists('loadDespesasFixasConsulta'),
    runIfExists('loadInicioV48'),
    runIfExists('loadFaturacaoHistoricoV48'),
    runIfExists('loadResumoAlertasV611')
  ].filter(Boolean);
  await Promise.allSettled(tasks);
}
function addMonths(dateStr,months){const d=dateStr?new Date(dateStr):new Date();d.setMonth(d.getMonth()+months);return d;}
function monthLabel(d){return meses[d.getMonth()]+' '+d.getFullYear();}
function updateAmortizacaoPreview(f){if(!f||f.dataset.type!=='Investimento')return;const val=parseCurrency(f.valor?.value||0);const months=Number(f.amortizacao?.value||1);const start=f.data?.value?new Date(f.data.value):null;const mensal=months?val/months:val;const fim=start?addMonths(f.data.value,months-1):null;document.getElementById('amortValorMensal').textContent=fmt.format(mensal||0);document.getElementById('amortPeriodo').textContent=start?`${monthLabel(start)} → ${monthLabel(fim)}`:'—';document.getElementById('amortResultado').textContent=months===1?'Custo pontual':'Repartido por '+months+' meses';}
async function launchRecord(ev){
  ev.preventDefault();
  const f=ev.target;
  const fd=new FormData(f);
  const val=parseCurrency(fd.get('valor')||0);
  const date=fd.get('data')||fd.get('mes')||'';
  const cat=fd.get('categoria')||'';
  let desc=fd.get('descricao')||cat;

  try{
    if(f.dataset.type==='Faturação'){
      const onlineRow=await saveFaturacaoDiariaOnline(date,val);
      const d=getAnoMesDiaFromDate(date);
      const payload={"Data":date,"Ano":d.ano,"Mês":d.mes,"Dia":d.dia,"Valor":val};
      addRecentRecord({type:'Faturação',date,cat,desc:'Gravado no Supabase',value:val,online:{table:'faturacao_diaria',payload,row:onlineRow}});

    }else if(f.dataset.type==='Fornecedor'){
      const d=getAnoMesDiaFromDate(date);
      const payload={
        "Ano":d.ano,
        "Mês":d.mes,
        "Fornecedor":cat,
        "Valor":val
      };
      const onlineRow=await insertOnline('fornecedores_historico',payload);
      addRecentRecord({type:'Fornecedor',date,cat,desc:'Gravado no Supabase',value:val,online:{table:'fornecedores_historico',payload,row:onlineRow}});

    }else if(f.dataset.type==='Ordenados'){
      const mes=fd.get('mes');
      await assertNoOrdenadoDuplicate(currentYear(),mes,cat);
      const payload={
        "Ano":currentYear(),
        "Mês":mes,
        "Funcionário":cat,
        "Valor":val
      };
      const onlineRow=await insertOnline('ordenados',payload);
      addRecentRecord({type:'Ordenados',date:mes,cat,desc:'Gravado no Supabase',value:val,online:{table:'ordenados',payload,row:onlineRow}});

    }else if(f.dataset.type==='Fixa'){
      const mes=fd.get('mes');
      await assertNoDespesaFixaDuplicate(currentYear(),mes,cat);
      const payload={
        "Ano":currentYear(),
        "Mês":mes,
        "Tipo":cat,
        "Valor":val
      };
      const onlineRow=await insertOnline('despesas_fixas',payload);
      addRecentRecord({type:'Despesa fixa',date:mes,cat,desc:'Gravado no Supabase',value:val,online:{table:'despesas_fixas',payload,row:onlineRow}});

    }else if(f.dataset.type==='Investimento'){
      const months=Number(fd.get('amortizacao')||1);
      const mensal=months?val/months:val;
      desc=`${cat} · ${months} ${months===1?'mês':'meses'} · ${fmt.format(mensal)}/mês`;
      const payload={
        "Data":date,
        "Descrição":cat,
        "Valor Total":val,
        "Meses Amortização":months
      };
      const onlineRow=await insertOnline('investimentos',payload);
      addRecentRecord({type:'Investimento',date,cat,desc:'Gravado no Supabase · '+desc,value:val,months,monthly:mensal,online:{table:'investimentos',payload,row:onlineRow}});
    }

    saveRecentRecords();
    f.reset();
    f.querySelectorAll('.currency-input').forEach(i=>i.value='');
    updateAmortizacaoPreview(f);
    await refreshAppData();
    notify('Registo guardado na base de dados.','good');
  }catch(error){
    console.error(error);
    const msg=error.message||String(error);
    if(msg.includes('já foi registad') || msg.includes('já existe')){
      notify(msg,'warn',5200);
    }else{
      notify('Erro ao gravar no Supabase: '+msg,'bad',6200);
    }
  }
}
function inferOnlineRecord(record){
  if(record.online?.table && record.online?.payload) return record.online;
  const value=Number(record.value)||0;
  if(record.type==='Faturação' && record.date){
    const d=getAnoMesDiaFromDate(record.date);
    return {table:'faturacao_diaria',payload:{"Data":record.date,"Ano":d.ano,"Mês":d.mes,"Dia":d.dia,"Valor":value}};
  }
  if(record.type==='Fornecedor' && record.date){
    const d=getAnoMesDiaFromDate(record.date);
    return {table:'fornecedores_historico',payload:{"Ano":d.ano,"Mês":d.mes,"Fornecedor":record.cat,"Valor":value}};
  }
  if(record.type==='Ordenados'){
    return {table:'ordenados',payload:{"Ano":currentYear(),"Mês":record.date,"Funcionário":record.cat,"Valor":value}};
  }
  if(record.type==='Despesa fixa'){
    return {table:'despesas_fixas',payload:{"Ano":currentYear(),"Mês":record.date,"Tipo":record.cat,"Valor":value}};
  }
  if(record.type==='Investimento' && record.date){
    return {table:'investimentos',payload:{"Data":record.date,"Descrição":record.cat,"Valor Total":value,"Meses Amortização":Number(record.months||1)}};
  }
  return null;
}

async function deleteOnlineRecord(record){
  if(!db) throw new Error('Supabase não carregou no browser.');
  const spec=inferOnlineRecord(record);
  if(!spec) throw new Error('Este registo não tem informação suficiente para apagar no Supabase.');
  const row=spec.row||{};
  const rowId=row.id ?? row.ID ?? row.Id;
  let query=db.from(spec.table).delete();
  if(rowId!==undefined && rowId!==null){
    query=query.eq(Object.prototype.hasOwnProperty.call(row,'id')?'id':Object.prototype.hasOwnProperty.call(row,'ID')?'ID':'Id',rowId);
  }else{
    Object.entries(spec.payload).forEach(([column,value])=>{query=query.eq(column,value);});
  }
  const {data,error}=await query.select('*');
  if(error) throw error;
  if(!data || data.length===0) throw new Error(`O Supabase não apagou nenhuma linha em "${spec.table}". Verifica se este registo ainda existe ou se a policy DELETE está ativa.`);
  invalidateRestaurantData();
}

async function deleteRecord(id){
  const record=records.find(r=>r.id===id);
  if(!record) return;
  if(!confirm('Apagar este registo também da base de dados?')) return;
  try{
    await deleteOnlineRecord(record);
    records=records.filter(r=>r.id!==id);
    saveRecentRecords();
    notify('Registo apagado da base de dados.','good');
    await refreshAppData();
  }catch(error){
    console.error(error);
    const msg=error.message||String(error);
    notify(msg.includes('row-level security') ? 'O Supabase bloqueou o apagamento por RLS. É preciso criar policies de DELETE para estas tabelas.' : 'Erro ao apagar no Supabase: '+msg,'bad',6500);
  }
}
function renderRecords(){const el=document.getElementById('allRecords');if(!el)return;saveRecentRecords();const rows=records.map(r=>`<tr><td><span class="tag">${r.type}</span></td><td>${r.date||'—'}</td><td>${r.cat}${r.desc&&r.desc!==r.cat?' · '+r.desc:''}</td><td class="money"><b>${fmt.format(r.value)}</b></td><td><button class="delete" onclick="deleteRecord(${r.id})">Apagar</button></td></tr>`).join('');el.innerHTML=rows||'<tr><td colspan="5" class="empty">Ainda não existem registos lançados nas últimas 24 horas.</td></tr>';}
function makeBars(id,vals,labels,mode='gold'){const el=document.getElementById(id);if(!el)return;el.innerHTML='';const max=Math.max(...vals,1);const h=chartBarHeights(el,el.classList.contains('chart-large')?245:165,el.classList.contains('chart-large')?62:34);vals.forEach((v,i)=>{const d=document.createElement('div');d.className='bar '+(mode==='red'&&i%2?'red':mode==='blue'?'blue':'');d.style.height=(h.min+v/max*h.max)+'px';d.title=(labels[i]?('Dia '+labels[i]+' · '):'')+fmt.format(id==='chartDias'?v*1000:v*1000);d.innerHTML='<span>'+labels[i]+'</span>';el.appendChild(d);});}
function makeSignedBars(id,vals,labels){
  const el=document.getElementById(id);if(!el)return;
  el.classList.remove('chart');el.classList.add('signed-chart');
  el.innerHTML='';
  const maxAbs=Math.max(1,...vals.map(v=>Math.abs(Number(v)||0)));
  const h=chartBarHeights(el,88,8);
  vals.forEach((v,i)=>{
    const n=Number(v)||0;
    const wrap=document.createElement('div');wrap.className='signed-wrap';
    const bar=document.createElement('div');bar.className='signed-bar '+(n<0?'negative':'positive');
    bar.style.height=(Math.max(h.min,Math.abs(n)/maxAbs*h.max))+'px';
    bar.title=(labels[i]||'')+' · '+fmt.format(n*1000);
    const sp=document.createElement('span');sp.textContent=labels[i]||'';
    wrap.appendChild(bar);wrap.appendChild(sp);el.appendChild(wrap);
  });
}
function makeCalendar(){const calendar=document.getElementById('calendar');if(!calendar)return;calendar.innerHTML='';daily.forEach((v,i)=>{const d=document.createElement('div');d.className='day '+(v>2300?'good':v<1300?'bad':'');d.innerHTML='<small>'+(i+1)+'/06</small><b>'+fmt.format(v)+'</b>';calendar.appendChild(d);});}
function makeDailyTable(){if(dailyTable)dailyTable.innerHTML='<tr><td colspan="5" class="empty">A carregar dados reais...</td></tr>';}
function changeSupplier(){
  const select=document.getElementById('supplierSelect');
  if(!select) return;
  const name=select.value || '__all';
  const rows=fornecedoresCache||[];
  const currentDate=new Date();
  const currentMonthLimit=currentDate.getMonth();
  const years=[...new Set(rows.map(r=>Number(getTableValue(r,['Ano','ano']))).filter(Boolean))].sort((a,b)=>a-b);
  const year=years.includes(currentDate.getFullYear())?currentDate.getFullYear():(years[years.length-1]||currentDate.getFullYear());
  const prevYear=year-1;
  const monthName=meses[currentMonthLimit];
  const rowsYearFull=supplierRowsForYear(rows,year);
  const rowsYearYtd=supplierRowsForYearUntilMonth(rows,year,currentMonthLimit);
  const rowsPrevFull=supplierRowsForYear(rows,prevYear);
  const rowsPrevYtd=supplierRowsForYearUntilMonth(rows,prevYear,currentMonthLimit);
  const bySupplier={}, byPrevYtd={}, byPrevFull={};
  rowsYearYtd.forEach(r=>{ const f=String(getTableValue(r,['Fornecedor','fornecedor'])||'—'); addToMap(bySupplier,f,Number(getTableValue(r,['Valor','valor'])||0)); });
  rowsPrevYtd.forEach(r=>{ const f=String(getTableValue(r,['Fornecedor','fornecedor'])||'—'); addToMap(byPrevYtd,f,Number(getTableValue(r,['Valor','valor'])||0)); });
  rowsPrevFull.forEach(r=>{ const f=String(getTableValue(r,['Fornecedor','fornecedor'])||'—'); addToMap(byPrevFull,f,Number(getTableValue(r,['Valor','valor'])||0)); });
  const ranking=Object.entries(bySupplier).sort((a,b)=>b[1]-a[1]);
  const totalYtd=sum(ranking.map(x=>x[1]));
  const totalPrevYtd=sum(Object.values(byPrevYtd));
  const totalPrevFull=sum(Object.values(byPrevFull));
  const top=ranking[0]||['—',0];
  setText('fornTotalTitle',`Total fornecedores ${year} até ${monthName}`); setText('fornTotalAno',fmt.format(name==='__all'?totalYtd:(bySupplier[name]||0)));
  const compCurrent=name==='__all'?totalYtd:(bySupplier[name]||0);
  const compPrev=name==='__all'?totalPrevYtd:(byPrevYtd[name]||0);
  setText('fornTotalDelta', compPrev?percentDelta(compCurrent,compPrev)+` vs ${prevYear} até ${monthName}`:'Sem dados suficientes');
  setText('fornMaiorNome',top[0]); setText('fornMaiorPeso',totalYtd?`${pctText(top[1]/totalYtd*100)} do total até ${monthName}`:'—');
  setText('fornAtivos',String(ranking.length));
  setText('fornAlertaNome',top[0]); setText('fornAlertaTexto', totalYtd?`${pctText(top[1]/totalYtd*100)} do custo de fornecedores até ${monthName}`:'—');
  setText('supplierCompareNote',`Comparação justa: ${year} até ${monthName} vs ${prevYear} até ${monthName}. A primeira coluna mantém o total completo de ${prevYear}.`);
  if(name==='__all'){
    supplierChartTitle.textContent=`Evolução mensal — fornecedores ${year}`;
    supplierInsightTitle.textContent='Leitura global';
    const vals=supplierMonthlyMap(rows,'__all',year); makeBars('chartSupplier',vals.map(v=>v/1000),shortMonthLabels(),'blue');
    supplierInsights.innerHTML=`<div class="alert good">Foram encontrados ${ranking.length} fornecedores ativos em ${year} até ${monthName}.</div><div class="alert">O maior fornecedor até ${monthName} é <b>${top[0]}</b>, com ${fmt.format(top[1])}.</div><div class="alert ${top[1]/(totalYtd||1)>0.35?'bad':'good'}">Comparativo correto: ${fmt.format(totalYtd)} em ${year} vs ${fmt.format(totalPrevYtd)} em ${prevYear} até ${monthName}.</div>`;
    supplierTable.innerHTML=ranking.map(([f,v])=>{ const prevYtd=byPrevYtd[f]||0; const prevFull=byPrevFull[f]||0; const peso=totalYtd?v/totalYtd*100:null; const estado=prevYtd? (v>prevYtd*1.15?'<span class="tag warn">A subir</span>':v<prevYtd*.9?'<span class="tag good">A descer</span>':'<span class="tag">Estável</span>'):'<span class="tag soft">Sem dados</span>'; return `<tr><td>${f}</td><td class="money">${prevFull?fmt.format(prevFull):'<span class="empty">—</span>'}</td><td class="money">${prevYtd?fmt.format(prevYtd):'<span class="empty">—</span>'}</td><td class="money"><b>${fmt.format(v)}</b></td><td class="money">${pctText(peso)}</td><td>${estado}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Sem dados de fornecedores.</td></tr>';
  }else{
    const vals=supplierMonthlyMap(rows,name,year); const total=sum(vals.slice(0,currentMonthLimit+1)); const prevYtd=byPrevYtd[name]||0; const prevFull=byPrevFull[name]||0;
    supplierChartTitle.textContent=`Despesas mensais — ${name}`; supplierInsightTitle.textContent=`Ficha individual — ${name}`; makeBars('chartSupplier',vals.map(v=>v/1000),shortMonthLabels(),'red');
    supplierInsights.innerHTML=`<div class="alert good">Total ${year} até ${monthName}: <b>${fmt.format(total)}</b>.</div><div class="alert">Comparativo ${prevYear} até ${monthName}: ${prevYtd?fmt.format(prevYtd):'sem dados suficientes'}. Total completo ${prevYear}: ${prevFull?fmt.format(prevFull):'—'}.</div><div class="alert ${prevYtd&&total>prevYtd*1.15?'bad':'good'}">${prevYtd?percentDelta(total,prevYtd)+` vs ${prevYear} até ${monthName}`:'Sem dados suficientes para comparação'}.</div>`;
    supplierTable.innerHTML=`<tr><td>${name}</td><td class="money">${prevFull?fmt.format(prevFull):'<span class="empty">—</span>'}</td><td class="money">${prevYtd?fmt.format(prevYtd):'<span class="empty">—</span>'}</td><td class="money"><b>${fmt.format(total)}</b></td><td class="money">${pctText(total/(totalYtd||1)*100)}</td><td>${prevYtd?comparisonBadge(total,prevYtd,`vs ${prevYear} até ${monthName}`):'<span class="tag soft">Sem dados</span>'}</td></tr>`;
  }
}

function comparisonBadge(current, previous, suffix='vs ano anterior'){
  const c=Number(current||0);
  const p=Number(previous||0);
  if(c<=0 || p<=0){
    return '<span class="tag" title="A variação será calculada quando existirem dados válidos para este período.">Sem dados suficientes</span>';
  }
  const pct=((c-p)/p)*100;
  const sign=pct>=0?'+':'';
  const cls=pct>=0?'tag good':'tag bad';
  return `<span class="${cls}">${sign}${pct.toFixed(1).replace('.',',')}% ${suffix}</span>`;
}
function comparisonText(current, previous, suffix='vs ano anterior'){
  const c=Number(current||0);
  const p=Number(previous||0);
  if(c<=0 || p<=0) return 'Sem dados suficientes';
  const pct=((c-p)/p)*100;
  const sign=pct>=0?'+':'';
  return `${sign}${pct.toFixed(1).replace('.',',')}% ${suffix}`;
}
function percentDelta(current, previous){
  const c=Number(current||0);
  const p=Number(previous||0);
  if(c<=0 || p<=0) return 'Sem dados suficientes';
  const pct=((c-p)/p)*100;
  const sign=pct>=0?'+':'';
  return `${sign}${pct.toFixed(1).replace('.',',')}%`;
}
function formatDatePT(dateStr){
  const d=new Date(String(dateStr)+'T00:00:00');
  return isNaN(d)?'—':d.toLocaleDateString('pt-PT');
}
function weekdayPT(dateStr){
  const d=new Date(String(dateStr)+'T00:00:00');
  return isNaN(d)?'—':d.toLocaleDateString('pt-PT',{weekday:'short'}).replace('.','');
}
async function loadFaturacaoAtualReal(){
  const sec=document.getElementById('fat-mes');
  const tbody=document.getElementById('dailyTable');
  const note=sec?.querySelector('.screen-note');
  const monthSelect=document.getElementById('fatAtualMonthSelect');
  function showFaturacaoMessage(message){
    if(note) note.textContent=message;
    if(tbody) tbody.innerHTML=`<tr><td colspan="5" class="empty">${message}</td></tr>`;
  }
  if(!db){ showFaturacaoMessage('Supabase não carregou no browser.'); return; }
  const {data,error}=await db.from('faturacao_diaria').select('*');
  if(error){ console.warn('Erro ao carregar faturação diária',error); showFaturacaoMessage('Erro ao carregar dados reais da tabela faturacao_diaria.'); return; }
  const parsed=(data||[]).map(r=>{
    let dataStr=getTableValue(r,['Data','data']);
    if(dataStr) dataStr=String(dataStr).slice(0,10);
    if(!dataStr){
      const ano=Number(getTableValue(r,['Ano','ano']));
      const mesIndex=monthIndexFromName(getTableValue(r,['Mês','mes']));
      const dia=Number(getTableValue(r,['Dia','dia']));
      if(ano && mesIndex>=0 && dia) dataStr=`${ano}-${String(mesIndex+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    }
    const rawValor=getTableValue(r,['Valor','valor']);
    const valor=typeof rawValor==='number'?rawValor:parseCurrency(rawValor);
    const d=new Date(String(dataStr)+'T00:00:00');
    return {raw:r,data:dataStr,valor,d,ano:d.getFullYear(),mesIndex:d.getMonth(),dia:d.getDate()};
  }).filter(r=>r.data && !isNaN(r.d) && Number.isFinite(r.valor));
  const registered=parsed.filter(r=>r.valor>0);
  if(!registered.length){ showFaturacaoMessage('Sem faturação registada na tabela faturacao_diaria.'); return; }

  const currentYear=new Date().getFullYear();
  const currentYearRows=registered.filter(r=>r.ano===currentYear);
  if(!currentYearRows.length){
    if(monthSelect) monthSelect.innerHTML='<option>Sem meses disponíveis</option>';
    showFaturacaoMessage(`Sem faturação registada em ${currentYear}.`);
    return;
  }
  const availableMonths=[...new Set(currentYearRows.map(r=>r.mesIndex))].sort((a,b)=>a-b);
  const selectedRaw=monthSelect?.value;
  const selectedMonth=selectedRaw!==undefined && selectedRaw!=='' ? Number(selectedRaw) : NaN;
  const latest=currentYearRows.reduce((a,b)=> b.d>a.d ? b : a, currentYearRows[0]);
  const targetYear=currentYear;
  const targetMonth=availableMonths.includes(selectedMonth) ? selectedMonth : latest.mesIndex;
  if(monthSelect){
    monthSelect.innerHTML=availableMonths.map(mi=>`<option value="${mi}">${meses[mi]} ${targetYear}</option>`).join('');
    monthSelect.value=String(targetMonth);
  }
  const monthRows=parsed.filter(r=>r.ano===targetYear && r.mesIndex===targetMonth && r.valor>0).sort((a,b)=>a.d-b.d);
  const dailyRows=[...monthRows.reduce((map,r)=>{
    const key=String(r.data).slice(0,10);
    const existing=map.get(key);
    if(existing) existing.valor+=r.valor;
    else map.set(key,{...r,data:key});
    return map;
  },new Map()).values()].sort((a,b)=>a.d-b.d);
  const prevMonth=targetMonth===0?11:targetMonth-1;
  const prevYear=targetMonth===0?targetYear-1:targetYear;
  const prevRows=parsed.filter(r=>r.ano===prevYear && r.mesIndex===prevMonth && r.valor>0);

  const total=monthRows.reduce((s,r)=>s+r.valor,0);
  const avg=dailyRows.length?total/dailyRows.length:0;
  const maxRow=dailyRows.reduce((a,b)=> b.valor>a.valor ? b : a, dailyRows[0]);
  const below=dailyRows.filter(r=>r.valor<avg).length;
  const prevTotal=prevRows.reduce((s,r)=>s+r.valor,0);

  if(!sec) return;
  const bigSmall=sec.querySelector('.big-total small');
  const bigValue=sec.querySelector('.big-total b');
  const bigDelta=sec.querySelector('.big-total .delta');
  if(bigSmall) bigSmall.textContent=`Total faturado em ${meses[targetMonth]} ${targetYear}`;
  if(bigValue) bigValue.textContent=fmt.format(total);
  if(bigDelta) bigDelta.textContent=(prevTotal?percentDelta(total,prevTotal)+' · ':'')+'dados reais Supabase';

  const kpis=sec.querySelectorAll('.mini-kpi b');
  if(kpis[0]) kpis[0].textContent=fmt.format(avg);
  if(kpis[1]) kpis[1].textContent=maxRow?fmt.format(maxRow.valor):'—';
  if(kpis[2]) kpis[2].textContent=String(below);

  if(note) note.textContent='Evolução diária carregada diretamente da tabela faturacao_diaria no Supabase.';

  makeBars('chartDias',dailyRows.map(r=>r.valor/1000),dailyRows.map(r=>r.dia),'red');

  if(tbody){
    let runningTotal=0;
    tbody.innerHTML=dailyRows.map(r=>{
      runningTotal+=r.valor;
      const estado=r.valor>avg*1.15?'<span class="tag good">Acima média</span>':r.valor<avg*.85?'<span class="tag bad">Baixo</span>':'<span class="tag">Normal</span>';
      return `<tr><td>${formatDatePT(r.data)}</td><td>${weekdayPT(r.data)}</td><td class="money"><b>${fmt.format(r.valor)}</b></td><td class="money">${fmt.format(runningTotal)}</td><td class="status-cell">${estado}</td></tr>`;
    }).join('')||'<tr><td colspan="5" class="empty">Sem faturação registada neste mês.</td></tr>';
  }
}

function monthKey(ano,mesIndex){ return `${ano}-${String(mesIndex+1).padStart(2,'0')}`; }
function addToMap(map,key,value){ map[key]=(map[key]||0)+(Number(value)||0); }
function monthIndexFromName(m){
  const target=normalizeKey(m);
  return meses.findIndex(x=>{
    const month=normalizeKey(x);
    return month===target || (target && month.slice(0,3)===target.slice(0,3));
  });
}
function moneyClass(v){ return v>=0?'money-positive':'money-negative'; }
function pctText(value){ return Number.isFinite(value)?`${value.toFixed(1).replace('.',',')}%`:'—'; }
function getTableValue(row,names){ for(const n of names){ if(row && row[n]!==undefined && row[n]!==null) return row[n]; } return null; }
async function fetchAll(table){
  if(!db) return [];
  if(RESTAURANT_TABLES.includes(table)){
    try{
      const data=await loadRestaurantData();
      return data[table]||[];
    }catch(error){
      console.warn('Erro ao carregar cache '+table,error);
    }
  }
  const {data,error}=await db.from(table).select('*');
  if(error){ console.warn('Erro ao carregar '+table,error); return []; }
  return data||[];
}
function investimentoMeses(row){
  const dateStr=getTableValue(row,['Data','data']);
  const total=Number(getTableValue(row,['Valor Total','valor_total','valor'])||0);
  const months=Number(getTableValue(row,['Meses Amortização','meses_amortizacao'])||1);
  const d=new Date(String(dateStr)+'T00:00:00');
  if(!dateStr || isNaN(d) || !total || !months) return [];
  const monthly=total/months;
  const arr=[];
  for(let i=0;i<months;i++){
    const x=new Date(d);
    x.setMonth(x.getMonth()+i);
    arr.push({ano:x.getFullYear(),mesIndex:x.getMonth(),valor:monthly});
  }
  return arr;
}
function buildRestaurantMetrics(source,date=new Date()){
  const data=source||{};
  const fatHist=data.faturacao_historica||[];
  const fatDia=data.faturacao_diaria||[];
  const forn=data.fornecedores_historico||[];
  const ord=data.ordenados||[];
  const fix=data.despesas_fixas||[];
  const inv=data.investimentos||[];
  const currentYear=date.getFullYear();
  const currentMonth=date.getMonth();
  const currentMonthName=meses[currentMonth];
  const faturacaoHist={}, faturacaoDia={}, faturacao={}, despesas={}, yearFat={}, yearDesp={};
  const buckets={Fornecedores:{},Ordenados:{},'Despesas Fixas':{},Amortizações:{}};
  const fornecedoresAll={}, fixasAll={}, ordenadosAll={}, investimentosAll={};
  const fornecedoresYtd={}, fixasYtd={};

  const addNested=(target,key,name,value)=>{
    if(!target[key]) target[key]={};
    addToMap(target[key],name,value);
  };
  const addExpense=(rows,bucket,typeNames,keepNested)=>{
    rows.forEach(row=>{
      const type=typeNames ? getTableValue(row,typeNames) : null;
      if(bucket==='Despesas Fixas' && isAggregateFixedType(type)) return;
      const ano=Number(getTableValue(row,['Ano','ano']));
      const mi=monthIndexFromName(getTableValue(row,['Mês','mes','Mes']));
      const valor=dmNumber(getTableValue(row,['Valor','valor']));
      if(!ano || mi<0) return;
      const key=monthKey(ano,mi);
      addToMap(despesas,key,valor);
      addToMap(buckets[bucket],key,valor);
      addToMap(yearDesp,ano,valor);
      if(keepNested){
        const label=String(type||'—').trim()||'—';
        addNested(keepNested,key,label,valor);
        if(ano===currentYear && mi<=currentMonth){
          if(bucket==='Fornecedores') addToMap(fornecedoresYtd,label,valor);
          if(bucket==='Despesas Fixas') addToMap(fixasYtd,label,valor);
        }
      }
    });
  };

  fatHist.forEach(row=>{
    const ano=Number(getTableValue(row,['Ano','ano']));
    const mi=monthIndexFromName(getTableValue(row,['Mês','mes','Mes']));
    const valor=dmNumber(getTableValue(row,['Valor','valor']));
    if(!ano || mi<0) return;
    const key=monthKey(ano,mi);
    addToMap(faturacaoHist,key,valor);
  });
  fatDia.forEach(row=>{
    const dateValue=dmDate(getTableValue(row,['Data','data']));
    const ano=Number(getTableValue(row,['Ano','ano'])) || (dateValue&&!isNaN(dateValue)?dateValue.getFullYear():0);
    const monthRaw=getTableValue(row,['Mês','mes','Mes']);
    const mi=monthRaw!==null && monthRaw!==undefined ? monthIndexFromName(monthRaw) : (dateValue&&!isNaN(dateValue)?dateValue.getMonth():-1);
    const valor=dmNumber(getTableValue(row,['Valor','valor']));
    if(!ano || mi<0) return;
    const key=monthKey(ano,mi);
    addToMap(faturacaoDia,key,valor);
  });
  Object.assign(faturacao,faturacaoHist);
  Object.entries(faturacaoDia).forEach(([key,value])=>{ faturacao[key]=value; });
  Object.entries(faturacao).forEach(([key,value])=>addToMap(yearFat,Number(key.slice(0,4)),value));

  addExpense(forn,'Fornecedores',['Fornecedor','fornecedor'],fornecedoresAll);
  addExpense(ord,'Ordenados',['Funcionário','Funcionário/a','Funcionario','funcionario'],ordenadosAll);
  addExpense(fix,'Despesas Fixas',['Tipo','tipo'],fixasAll);
  inv.forEach(row=>{
    const label=String(getTableValue(row,['Descrição','Descricao','descricao'])||'Investimento').trim()||'Investimento';
    investimentoMeses(row).forEach(item=>{
      const key=monthKey(item.ano,item.mesIndex);
      addToMap(despesas,key,item.valor);
      addToMap(buckets.Amortizações,key,item.valor);
      addToMap(yearDesp,item.ano,item.valor);
      addNested(investimentosAll,key,label,item.valor);
    });
  });

  const estimate=computeRevenueEstimate(fatDia,date);
  const expenseEstimateForMonth=(year,month)=>{
    const cur=monthKey(year,month);
    const prev=monthKey(year-1,month);
    return (buckets.Fornecedores[cur] || buckets.Fornecedores[prev] || 0)
      +(buckets.Ordenados[cur] || buckets.Ordenados[prev] || 0)
      +(buckets['Despesas Fixas'][cur] || buckets['Despesas Fixas'][prev] || 0)
      +(buckets.Amortizações[cur] || buckets.Amortizações[prev] || 0);
  };
  const monthly=meses.map((mes,mi)=>{
    const key=monthKey(currentYear,mi);
    const fat=faturacao[key]||0;
    const desp=mi<=currentMonth ? expenseEstimateForMonth(currentYear,mi) : (despesas[key]||0);
    const lucro=fat-desp;
    return {ano:currentYear,mes,short:mes.slice(0,3),mi,fat,desp,lucro,margem:fat?lucro/fat*100:null};
  });

  return {
    currentYear,currentMonth,currentMonthName,meses,
    fatHist,fatDia,forn,ord,fix,inv,
    faturacaoHist,faturacaoDia,faturacao,despesas,buckets,
    fornecedoresAll,fixasAll,ordenadosAll,investimentosAll,
    fornecedoresYtd,fixasYtd,yearFat,yearDesp,
    estimate,monthly,expenseEstimateForMonth
  };
}
async function getRestaurantMetrics(force=false,date=new Date()){
  const data=await loadRestaurantData(force);
  return buildRestaurantMetrics(data,date);
}
function runRestaurantDataSmokeChecks(){
  const sampleDate=new Date(2026,5,30);
  const sample=buildRestaurantMetrics({
    faturacao_historica:[{"Ano":2025,"Mês":"Junho","Valor":3000},{"Ano":2026,"Mês":"Junho","Valor":1000}],
    faturacao_diaria:[{"Data":"2026-06-01","Valor":100},{"Data":"2026-06-02","Valor":200}],
    fornecedores_historico:[{"Ano":2026,"Mês":"Junho","Fornecedor":"Teste","Valor":50}],
    ordenados:[{"Ano":2026,"Mês":"Junho","Funcionário":"Pessoa","Valor":20}],
    despesas_fixas:[{"Ano":2026,"Mês":"Junho","Tipo":"Total","Valor":999},{"Ano":2026,"Mês":"Junho","Tipo":"Energia","Valor":30}],
    investimentos:[{"Data":"2026-06-01","Descrição":"Forno","Valor Total":120,"Meses Amortização":3}]
  },sampleDate);
  const juneKey=monthKey(2026,5);
  const checks=[
    ['faturacao_diaria_prevalece',sample.faturacao[juneKey]===300],
    ['fixas_total_excluido',sample.buckets['Despesas Fixas'][juneKey]===30],
    ['amortizacao_repartida',sample.buckets.Amortizações[juneKey]===40],
    ['estimativa_diaria',sample.estimate.observedDays===2 && sample.estimate.observedTotal===300]
  ];
  const failed=checks.filter(([,ok])=>!ok).map(([name])=>name);
  if(failed.length) throw new Error('Smoke checks falharam: '+failed.join(', '));
  console.info('[Smoke] métricas do restaurante OK',checks.map(([name])=>name));
  return true;
}
window.buildRestaurantMetrics=buildRestaurantMetrics;
window.getRestaurantMetrics=getRestaurantMetrics;
window.runRestaurantDataSmokeChecks=runRestaurantDataSmokeChecks;
async function loadResultadosReais(){
  if(!db) return;
  const [fatHist,fatDia,forn,ords,fixas,invs]=await Promise.all([
    fetchAll('faturacao_historica'),fetchAll('faturacao_diaria'),fetchAll('fornecedores_historico'),fetchAll('ordenados'),fetchAll('despesas_fixas'),fetchAll('investimentos')
  ]);
  const faturacao={}, despesas={}, yearFat={}, yearDesp={}, despBuckets={Fornecedores:{},Ordenados:{},'Despesas Fixas':{},Amortizações:{}};

  fatHist.forEach(r=>{
    const ano=Number(getTableValue(r,['Ano','ano']));
    const mi=monthIndexFromName(getTableValue(r,['Mês','mes']));
    const v=Number(getTableValue(r,['Valor','valor'])||0);
    if(ano && mi>=0){ addToMap(faturacao,monthKey(ano,mi),v); addToMap(yearFat,ano,v); }
  });
  fatDia.forEach(r=>{
    const ds=getTableValue(r,['Data','data']);
    const v=Number(getTableValue(r,['Valor','valor'])||0);
    const d=new Date(String(ds)+'T00:00:00');
    if(ds && !isNaN(d)){ addToMap(faturacao,monthKey(d.getFullYear(),d.getMonth()),v); addToMap(yearFat,d.getFullYear(),v); }
  });
  function addMonthlyExpense(rows,bucket){
    rows.forEach(r=>{
      const ano=Number(getTableValue(r,['Ano','ano']));
      const mi=monthIndexFromName(getTableValue(r,['Mês','mes']));
      const v=Number(getTableValue(r,['Valor','valor'])||0);
      if(ano && mi>=0){ const k=monthKey(ano,mi); addToMap(despesas,k,v); addToMap(despBuckets[bucket],k,v); addToMap(yearDesp,ano,v); }
    });
  }
  addMonthlyExpense(forn,'Fornecedores');
  addMonthlyExpense(ords,'Ordenados');
  addMonthlyExpense(fixas,'Despesas Fixas');
  invs.forEach(r=>{
    investimentoMeses(r).forEach(x=>{ const k=monthKey(x.ano,x.mesIndex); addToMap(despesas,k,x.valor); addToMap(despBuckets.Amortizações,k,x.valor); addToMap(yearDesp,x.ano,x.valor); });
  });

  const today=new Date();
  const targetYear=today.getFullYear();
  const targetMonth=today.getMonth();
  const currentKey=monthKey(targetYear,targetMonth);
  const currentMonthName=meses[targetMonth];
  const estimate=computeRevenueEstimate(fatDia,today);
  const daysInCurrentMonth=estimate.daysInMonth;
  const fatAtual=estimate.observedTotal;
  const observedDays=estimate.observedDays;
  const dailyAverage=estimate.dailyAverage;
  const fatEstimada=estimate.estimated;

  const estimatedDespForMonth=i=>{
    const cur=monthKey(targetYear,i), prev=monthKey(targetYear-1,i);
    const fornecedores=despBuckets.Fornecedores[cur] || despBuckets.Fornecedores[prev] || 0;
    const ordenados=despBuckets.Ordenados[cur] || despBuckets.Ordenados[prev] || 0;
    const fixas=despBuckets['Despesas Fixas'][cur] || despBuckets['Despesas Fixas'][prev] || 0;
    const amort=despBuckets.Amortizações[cur] || despBuckets.Amortizações[prev] || 0;
    return fornecedores+ordenados+fixas+amort;
  };
  const months=meses.map((m,i)=>{
    const key=monthKey(targetYear,i);
    const fat=faturacao[key]||0;
    const desp=i<=targetMonth?estimatedDespForMonth(i):(despesas[key]||0);
    const lucro=fat-desp;
    const margem=fat?lucro/fat*100:null;
    return {mes:m,mesShort:m.slice(0,3),fat,desp,lucro,margem};
  });
  const withData=months.filter(x=>x.fat||x.desp);
  const fatYtd=months.reduce((s,x)=>s+x.fat,0);
  const despYtd=months.reduce((s,x)=>s+x.desp,0);
  const lucroYtd=fatYtd-despYtd;
  const margemYtd=fatYtd?lucroYtd/fatYtd*100:null;
  const currentMonthData=months[targetMonth];
  const prevMonthData=targetMonth>0?months[targetMonth-1]:null;
  const prevMonthFat=prevMonthData?prevMonthData.fat:0;

  const set=(id,text)=>{ const el=document.getElementById(id); if(el) el.textContent=text; };
  set('resFatEstTitle',`Faturação Estimada — ${currentMonthName} ${targetYear}`);
  set('resFatEstimada',fmt.format(fatEstimada||0));
  set('resFatEstDelta', observedDays ? `Média ${fmt.format(dailyAverage)}/dia · ${observedDays} dias observados de ${daysInCurrentMonth}` : 'Sem faturação diária registada este mês');
  set('resFatAtualTitle',`Faturação registada — ${currentMonthName}`);
  set('resFatAtual',fmt.format(fatAtual||0));
  set('resFatAtualDelta', prevMonthFat ? `${percentDelta(fatAtual,prevMonthFat)} vs mês anterior fechado` : 'Dados reais Supabase');
  set('resYtd',fmt.format(lucroYtd));
  set('resResultadoDelta',`Faturação YTD ${fmt.format(fatYtd)} · Despesas YTD ${fmt.format(despYtd)}`);
  set('resMargemMedia',pctText(margemYtd));
  set('resMargemYtd','Margem média com despesas estimadas quando faltam dados');
  const ytdEl=document.getElementById('resYtd'); if(ytdEl){ ytdEl.classList.toggle('money-positive',lucroYtd>=0); ytdEl.classList.toggle('money-negative',lucroYtd<0); }
  const margemEl=document.getElementById('resMargemMedia'); if(margemEl){ margemEl.classList.toggle('money-positive',margemYtd>=20); margemEl.classList.toggle('money-warn',margemYtd<20); }

  makeSignedBars('chartLucroMes',months.map(x=>x.lucro/1000),months.map(x=>x.mesShort));
  const allYears=[...new Set([...Object.keys(yearFat),...Object.keys(yearDesp)].map(Number).filter(Boolean))].sort((a,b)=>a-b);
  const yearLabels=allYears.slice(-6).map(String);
  const yearVals=allYears.slice(-6).map(y=>((yearFat[y]||0)-(yearDesp[y]||0))/1000);
  makeSignedBars('chartLucroAnos',yearVals,yearLabels);
  set('resChartNote','Faturação real Supabase. Despesas usam o ano anterior quando faltar alguma categoria no mês atual.');
  set('resYearNote','Comparativo calculado com o histórico disponível. Atenção: alguns anos podem ter apenas faturação, sem histórico completo de despesas.');

  const tbody=document.getElementById('resultadosTable');
  if(tbody){
    tbody.innerHTML=withData.map(x=>{
      const isCurrent=x.mes===currentMonthName;
      const estado=x.lucro<0?'<span class="tag bad">Negativo</span>':(x.margem!==null && x.margem<20?'<span class="tag warn">Vigiar</span>':'<span class="tag good">Positivo</span>');
      const mesLabel=isCurrent?`${x.mes} <span class="tag good">Atual</span>`:x.mes;
      return `<tr><td>${mesLabel}</td><td class="money">${fmt.format(x.fat)}</td><td class="money">${fmt.format(x.desp)}</td><td class="money"><b class="${moneyClass(x.lucro)}">${fmt.format(x.lucro)}</b></td><td class="money">${pctText(x.margem)}</td><td>${estado}</td></tr>`;
    }).join('') || '<tr><td colspan="6" class="empty">Ainda não existem dados suficientes para calcular resultados.</td></tr>';
  }
  const alertBox=document.getElementById('resultadosAlertas');
  if(alertBox){
    const conf=observedDays>=20?'good':(observedDays>=10?'':'bad');
    const confText=observedDays>=20?'Estimativa muito fiável':(observedDays>=10?'Estimativa razoável':'Estimativa ainda pouco fiável');
    const costWeight=fatYtd?despYtd/fatYtd*100:null;
    alertBox.innerHTML=`<div class="alert ${conf}"><b>Faturação estimada — ${currentMonthName}</b><span class="amount">${fmt.format(fatEstimada||0)}</span><br>${confText}: baseada em ${observedDays} dias observados.</div><div class="alert ${lucroYtd>=0?'good':'bad'}"><b>Resultado acumulado ${targetYear}</b><span class="amount">${fmt.format(lucroYtd)}</span><br>Margem acumulada: ${pctText(margemYtd)}.</div><div class="alert ${costWeight && costWeight>75?'bad':'good'}"><b>Peso das despesas</b><span class="amount">${pctText(costWeight)}</span><br>Inclui fornecedores, ordenados, despesas fixas e amortizações.</div>`;
  }
}

function askAI(text){
  const input=document.getElementById('aiInput');
  const q=(text || (input?input.value:'' ) || '').trim();
  if(!q)return;
  const win=document.getElementById('chatWindow');
  win.insertAdjacentHTML('beforeend',`<div class="msg user">${q}</div>`);
  const answer='Nesta versão de demonstração, esta pergunta seria enviada ao Assistente IA. Na app final, a resposta será calculada com base na faturação, despesas, fornecedores, ordenados, fixas, investimentos e histórico importado.';
  win.insertAdjacentHTML('beforeend',`<div class="msg ai"><b>Análise preliminar</b><br>${answer}<br><br><span class="tag good">Pronto para ligação à base de dados</span></div>`);
  if(input)input.value='';
  win.scrollTop=win.scrollHeight;
}



// ============================== V39 REAL DATA LAYER ==============================
let fornecedoresCache=[];
let resultadosCache=null;
let dashboardCache=null;

function setText(id,text){ const el=document.getElementById(id); if(el) el.textContent=text; }
function shortMonthLabels(){ return meses.map(m=>m.slice(0,3)); }
function groupByMonth(rows, valueName='Valor'){
  const vals=Array(12).fill(0);
  rows.forEach(r=>{
    const mi=monthIndexFromName(getTableValue(r,['Mês','mes']));
    const v=Number(getTableValue(r,[valueName,'Valor','valor'])||0);
    if(mi>=0) vals[mi]+=v;
  });
  return vals;
}
function currentContext(){ const d=new Date(); return {year:d.getFullYear(),monthIndex:d.getMonth(),monthName:meses[d.getMonth()],daysInMonth:new Date(d.getFullYear(),d.getMonth()+1,0).getDate()}; }
function sum(arr){ return arr.reduce((a,b)=>a+(Number(b)||0),0); }

async function computeAllRealData(){
  const [fatHist,fatDia,forn,ords,fixas,invs]=await Promise.all([
    fetchAll('faturacao_historica'),fetchAll('faturacao_diaria'),fetchAll('fornecedores_historico'),fetchAll('ordenados'),fetchAll('despesas_fixas'),fetchAll('investimentos')
  ]);
  const ctx=currentContext();
  const faturacaoMensal={}, despesasMensal={}, yearFat={}, yearDesp={}, despesasPorTipo={fornecedores:{},ordenados:{},fixas:{},amortizacoes:{}};
  const addMonth=(map,ano,mi,val)=>{ if(ano && mi>=0) addToMap(map,monthKey(ano,mi),Number(val)||0); };
  fatHist.forEach(r=>{ const ano=Number(getTableValue(r,['Ano','ano'])); const mi=monthIndexFromName(getTableValue(r,['Mês','mes'])); const v=Number(getTableValue(r,['Valor','valor'])||0); addMonth(faturacaoMensal,ano,mi,v); if(ano) addToMap(yearFat,ano,v); });
  fatDia.forEach(r=>{ const ds=getTableValue(r,['Data','data']); const v=Number(getTableValue(r,['Valor','valor'])||0); const d=new Date(String(ds)+'T00:00:00'); if(ds&&!isNaN(d)){ addMonth(faturacaoMensal,d.getFullYear(),d.getMonth(),v); addToMap(yearFat,d.getFullYear(),v); }});
  function addExpenseRows(rows, bucketName){
    rows.forEach(r=>{ const ano=Number(getTableValue(r,['Ano','ano'])); const mi=monthIndexFromName(getTableValue(r,['Mês','mes'])); const v=Number(getTableValue(r,['Valor','valor'])||0); addMonth(despesasMensal,ano,mi,v); if(ano) addToMap(yearDesp,ano,v); if(ano && mi>=0) addMonth(despesasPorTipo[bucketName],ano,mi,v); });
  }
  addExpenseRows(forn,'fornecedores'); addExpenseRows(ords,'ordenados'); addExpenseRows(fixas,'fixas');
  invs.forEach(r=>investimentoMeses(r).forEach(x=>{ addMonth(despesasMensal,x.ano,x.mesIndex,x.valor); addToMap(yearDesp,x.ano,x.valor); addMonth(despesasPorTipo.amortizacoes,x.ano,x.mesIndex,x.valor); }));
  const monthly=meses.map((m,i)=>{ const key=monthKey(ctx.year,i); const fat=faturacaoMensal[key]||0; const desp=despesasMensal[key]||0; const lucro=fat-desp; return {ano:ctx.year,mes:m,mi:i,fat,desp,lucro,margem:fat?lucro/fat*100:null}; });
  const estimate=computeRevenueEstimate(fatDia,ctx.today);
  const currentRows=(fatDia||[]).filter(r=>{ const d=dmDate(getTableValue(r,['Data','data'])); return d && !isNaN(d) && d.getFullYear()===ctx.year && d.getMonth()===ctx.monthIndex && d<=ctx.today; });
  const fatAtual=estimate.observedTotal;
  const observedDays=estimate.observedDays;
  const dailyAverage=estimate.dailyAverage;
  const fatEstimada=estimate.estimated;
  return {ctx,fatHist,fatDia,forn,ords,fixas,invs,faturacaoMensal,despesasMensal,yearFat,yearDesp,despesasPorTipo,monthly,currentRows,fatAtual,observedDays,dailyAverage,fatEstimada};
}

async function loadDashboardReal(){
  const data=dashboardCache || (dashboardCache=await computeAllRealData());
  const {ctx,monthly,fatAtual,fatEstimada,observedDays,dailyAverage,faturacaoMensal,despesasMensal,yearFat,yearDesp,despesasPorTipo}=data;
  const ytdFat=sum(monthly.map(x=>x.fat));
  const ytdDesp=sum(monthly.map(x=>x.desp));
  const ytdLucro=ytdFat-ytdDesp;
  const current=monthly[ctx.monthIndex]||{desp:0};
  const prev=ctx.monthIndex>0?monthly[ctx.monthIndex-1]:null;
  const margin=ytdFat?ytdLucro/ytdFat*100:null;

  const resumo=document.getElementById('resumo');
  if(resumo){
    const cards=resumo.querySelectorAll('.metric');
    if(cards[0]){ cards[0].querySelector('small').textContent=`Faturação estimada — ${ctx.monthName} ${ctx.year}`; cards[0].querySelector('b').textContent=fmt.format(fatEstimada); cards[0].querySelector('.delta').textContent=observedDays?`Média ${fmt.format(dailyAverage)}/dia · ${observedDays} dias observados`:'Sem dados observados este mês'; }
    if(cards[1]){ cards[1].querySelector('small').textContent=`Faturação registada — ${ctx.monthName}`; cards[1].querySelector('b').textContent=fmt.format(fatAtual); cards[1].querySelector('.delta').textContent=prev&&prev.fat?percentDelta(fatAtual,prev.fat):'Dados reais Supabase'; }
    if(cards[2]){ cards[2].querySelector('small').textContent=`Despesas registadas — ${ctx.monthName}`; cards[2].querySelector('b').textContent=fmt.format(current.desp||0); cards[2].querySelector('.delta').textContent='Fornecedores + ordenados + fixas + amortizações'; }
    if(cards[3]){ cards[3].querySelector('small').textContent='Resultado acumulado do ano'; cards[3].querySelector('b').textContent=fmt.format(ytdLucro); cards[3].querySelector('b').classList.toggle('money-negative',ytdLucro<0); cards[3].querySelector('.delta').textContent=`Margem ${pctText(margin)}`; }
    makeBars('chartAno',monthly.map(x=>x.fat/1000),shortMonthLabels(),'gold');
    const indicator=resumo.querySelector('table tbody');
    if(indicator){ indicator.innerHTML=`<tr><td>Faturação observada</td><td class="money"><b class="money-positive">${fmt.format(fatAtual)}</b></td><td class="money">${prev?fmt.format(prev.fat):'—'}</td><td><span class="tag good">Real</span></td></tr><tr><td>Faturação estimada</td><td class="money"><b>${fmt.format(fatEstimada)}</b></td><td class="money">—</td><td><span class="tag ${observedDays>=10?'good':'warn'}">${observedDays} dias</span></td></tr><tr><td>Despesas registadas</td><td class="money"><b class="money-negative">${fmt.format(current.desp||0)}</b></td><td class="money">${prev?fmt.format(prev.desp):'—'}</td><td><span class="tag warn">Acompanhar</span></td></tr><tr><td>Resultado YTD</td><td class="money"><b class="${moneyClass(ytdLucro)}">${fmt.format(ytdLucro)}</b></td><td class="money">—</td><td><span class="tag ${ytdLucro>=0?'good':'bad'}">${ytdLucro>=0?'Positivo':'Negativo'}</span></td></tr>`; }
    const alertList=resumo.querySelector('.card.wide:nth-of-type(7) .list') || resumo.querySelectorAll('.list')[0];
    if(alertList){
      const costWeight=fatAtual?current.desp/fatAtual*100:null;
      alertList.innerHTML=`<div class="alert ${observedDays>=10?'good':'bad'}"><b>Estimativa de faturação</b><span class="amount">${fmt.format(fatEstimada)}</span><br>Baseada em ${observedDays} dias observados no mês atual.</div><div class="alert ${costWeight&&costWeight>70?'bad':'good'}"><b>Peso de despesas do mês</b><span class="amount">${pctText(costWeight)}</span><br>Comparação entre despesas registadas e faturação observada.</div><div class="alert ${ytdLucro>=0?'good':'bad'}"><b>Resultado acumulado do ano</b><span class="amount">${fmt.format(ytdLucro)}</span><br>Calculado com os dados reais já importados no Supabase.</div>`;
    }
  }
  // home cards
  const home=document.querySelector('[data-home-dashboard="revenue"]');
  if(home && home.dataset.homeDashboard==='revenue'){
    if(typeof loadInicioV48==='function') loadInicioV48();
  }else if(home){
    const bs=home.querySelectorAll('b');
    const labels=home.querySelectorAll('small');
    const curKey=monthKey(ctx.year,ctx.monthIndex);
    const fornecedoresMes=(despesasPorTipo?.fornecedores?.[curKey])||0;
    const fixasMes=(despesasPorTipo?.fixas?.[curKey])||0;
    if(labels[0])labels[0].textContent='Faturação mês';
    if(labels[1])labels[1].textContent='Fornecedores mês';
    if(labels[2])labels[2].textContent='Despesas Fixas mês';
    if(bs[0])bs[0].textContent=fmt.format(fatAtual);
    if(bs[1])bs[1].textContent=fmt.format(fornecedoresMes);
    if(bs[2])bs[2].textContent=fmt.format(fixasMes);
  }
}

function supplierRowsForYear(rows,year){ return rows.filter(r=>Number(getTableValue(r,['Ano','ano']))===year); }
function supplierMonthlyMap(rows, supplier, year){
  const vals=Array(12).fill(0);
  rows.forEach(r=>{ const y=Number(getTableValue(r,['Ano','ano'])); const name=String(getTableValue(r,['Fornecedor','fornecedor'])||''); if(year && y!==year) return; if(supplier && supplier!=='__all' && name!==supplier) return; const mi=monthIndexFromName(getTableValue(r,['Mês','mes'])); const v=Number(getTableValue(r,['Valor','valor'])||0); if(mi>=0) vals[mi]+=v; });
  return vals;
}
async function loadFornecedoresReais(){
  if(!db) return;
  fornecedoresCache=await fetchAll('fornecedores_historico');
  changeSupplier();
}


async function loadAnalisesReais(){
  const data=dashboardCache || (dashboardCache=await computeAllRealData());
  const {ctx,monthly,despesasPorTipo,forn}=data;
  makeBars('chartAnalisesFat',monthly.map(x=>x.fat/1000),shortMonthLabels(),'gold');
  const despVals=monthly.map(x=>x.desp/1000); makeBars('chartAnalisesDesp',despVals,shortMonthLabels(),'blue');
  makeBars('chartAnalisesMargem',monthly.map(x=>Math.max(0,x.margem||0)),shortMonthLabels(),'gold');
  const metrics=document.querySelectorAll('#analises .card.metric');
  const best=monthly.reduce((a,b)=>b.fat>a.fat?b:a,monthly[0]);
  const totalFat=sum(monthly.map(x=>x.fat)); const totalDesp=sum(monthly.map(x=>x.desp)); const margem=totalFat?(totalFat-totalDesp)/totalFat*100:null;
  if(metrics[0]){metrics[0].querySelector('b').textContent=best?best.mes:'—'; metrics[0].querySelector('.delta').textContent=best?`${fmt.format(best.fat)} de faturação`:'—';}
  if(metrics[1]){metrics[1].querySelector('b').textContent=pctText(margem); metrics[1].querySelector('.delta').textContent='Dados reais do ano atual';}
  const despCat={Fornecedores:0,Ordenados:0,'Despesas Fixas':0,Amortizações:0};
  Object.values(despesasPorTipo.fornecedores).forEach(v=>despCat.Fornecedores+=v); Object.values(despesasPorTipo.ordenados).forEach(v=>despCat.Ordenados+=v); Object.values(despesasPorTipo.fixas).forEach(v=>despCat['Despesas Fixas']+=v); Object.values(despesasPorTipo.amortizacoes).forEach(v=>despCat.Amortizações+=v);
  const topCat=Object.entries(despCat).sort((a,b)=>b[1]-a[1])[0]||['—',0];
  if(metrics[2]){metrics[2].querySelector('b').textContent=topCat[0]; metrics[2].querySelector('.delta').textContent=`${fmt.format(topCat[1])} no ano`;}
  const bySup={}; forn.filter(r=>Number(getTableValue(r,['Ano','ano']))===ctx.year).forEach(r=>addToMap(bySup,String(getTableValue(r,['Fornecedor','fornecedor'])||'—'),Number(getTableValue(r,['Valor','valor'])||0))); const rankingSup=Object.entries(bySup).sort((a,b)=>b[1]-a[1]); const topSup=rankingSup[0]||['—',0];
  if(metrics[3]){metrics[3].querySelector('b').textContent=topSup[0]; metrics[3].querySelector('.delta').textContent=`${fmt.format(topSup[1])} no ano`;}
  const topBody=document.getElementById('analisesTopFornecedores');
  const totalSup=sum(rankingSup.map(x=>x[1]));
  if(topBody){
    topBody.innerHTML=rankingSup.slice(0,8).map(([f,v],i)=>{
      const peso=totalSup?v/totalSup*100:null;
      const tag=i===0?'<span class="tag warn">Maior peso</span>':(peso&&peso>15?'<span class="tag warn">Vigiar</span>':'<span class="tag good">Normal</span>');
      return `<tr><td>${f}</td><td class="money">${fmt.format(v)}</td><td class="money">${pctText(peso)}</td><td>${tag}</td></tr>`;
    }).join('') || '<tr><td colspan="4" class="empty">Sem dados de fornecedores no ano atual.</td></tr>';
  }
  const pesoBody=document.getElementById('analisesPesoCustos');
  if(pesoBody){
    const totalCustos=Object.values(despCat).reduce((a,b)=>a+b,0);
    pesoBody.innerHTML=Object.entries(despCat).sort((a,b)=>b[1]-a[1]).map(([cat,v])=>{
      const peso=totalCustos?v/totalCustos*100:null;
      const tag=peso&&peso>45?'<span class="tag warn">Vigiar</span>':'<span class="tag good">Controlado</span>';
      return `<tr><td>${cat}</td><td class="money">${fmt.format(v)}</td><td class="money">${pctText(peso)}</td><td>${tag}</td></tr>`;
    }).join('');
  }
}


let fixasCache=[];
async function loadDespesasFixasConsulta(){
  if(!db) return;
  fixasCache=await fetchAll('despesas_fixas');
  changeFixedExpense();
}
function fixedRowsForYear(rows,year){ return rows.filter(r=>Number(getTableValue(r,['Ano','ano']))===year && !isAggregateFixedType(getTableValue(r,['Tipo','tipo']))); }
function fixedRowsForYearUntilMonth(rows,year,monthLimit){
  return rows.filter(r=>{
    const y=Number(getTableValue(r,['Ano','ano']));
    const mi=monthIndexFromName(getTableValue(r,['Mês','mes']));
    return y===year && mi>=0 && mi<=monthLimit && !isAggregateFixedType(getTableValue(r,['Tipo','tipo']));
  });
}
function fixedMonthlyMap(rows,tipo,year){
  const vals=Array(12).fill(0);
  rows.forEach(r=>{
    const y=Number(getTableValue(r,['Ano','ano']));
    const name=String(getTableValue(r,['Tipo','tipo'])||'—');
    if(isAggregateFixedType(name)) return;
    if(year && y!==year) return;
    if(tipo && tipo!=='__all' && name!==tipo) return;
    const mi=monthIndexFromName(getTableValue(r,['Mês','mes']));
    const v=Number(getTableValue(r,['Valor','valor'])||0);
    if(mi>=0) vals[mi]+=v;
  });
  return vals;
}
function changeFixedExpense(){
  const select=document.getElementById('fixedExpenseSelect');
  if(!select) return;
  let tipo=select.value||'__all';
  if(isAggregateFixedType(tipo)){ select.value='__all'; tipo='__all'; }
  const rows=(fixasCache||[]).filter(r=>!isAggregateFixedType(getTableValue(r,['Tipo','tipo'])));
  const currentDate=new Date();
  const currentMonthLimit=currentDate.getMonth();
  const monthName=meses[currentMonthLimit];
  const years=[...new Set(rows.map(r=>Number(getTableValue(r,['Ano','ano']))).filter(Boolean))].sort((a,b)=>a-b);
  const year=years.includes(currentDate.getFullYear())?currentDate.getFullYear():(years[years.length-1]||currentDate.getFullYear());
  const prevYear=year-1;
  const rowsYearFull=fixedRowsForYear(rows,year);
  const rowsYearYtd=fixedRowsForYearUntilMonth(rows,year,currentMonthLimit);
  const rowsPrevFull=fixedRowsForYear(rows,prevYear);
  const rowsPrevYtd=fixedRowsForYearUntilMonth(rows,prevYear,currentMonthLimit);
  const byTipo={}, byPrevYtd={}, byPrevFull={};
  rowsYearYtd.forEach(r=>addToMap(byTipo,String(getTableValue(r,['Tipo','tipo'])||'—'),Number(getTableValue(r,['Valor','valor'])||0)));
  rowsPrevYtd.forEach(r=>addToMap(byPrevYtd,String(getTableValue(r,['Tipo','tipo'])||'—'),Number(getTableValue(r,['Valor','valor'])||0)));
  rowsPrevFull.forEach(r=>addToMap(byPrevFull,String(getTableValue(r,['Tipo','tipo'])||'—'),Number(getTableValue(r,['Valor','valor'])||0)));
  const ranking=Object.entries(byTipo).sort((a,b)=>b[1]-a[1]);
  const total=sum(ranking.map(x=>x[1]));
  const prevYtdTotal=sum(Object.values(byPrevYtd));
  const prevFullTotal=sum(Object.values(byPrevFull));
  const top=ranking[0]||['—',0];
  const currentVal=tipo==='__all'?total:(byTipo[tipo]||0);
  const prevYtdVal=tipo==='__all'?prevYtdTotal:(byPrevYtd[tipo]||0);
  setText('fixasTotalTitle',`Total despesas fixas ${year} até ${monthName}`);
  setText('fixasTotalAno',formatEuroAmount(currentVal));
  setText('fixasTotalDelta',prevYtdVal?percentDelta(currentVal,prevYtdVal)+` vs ${prevYear} até ${monthName}`:'Sem dados suficientes');
  setText('fixasMaiorTipo',top[0]);
  setText('fixasMaiorPeso',total?`${pctText(top[1]/total*100)} do total até ${monthName}`:'—');
  setText('fixasMediaMensal',formatEuroAmount(currentVal/(currentMonthLimit+1)));
  setText('fixasTiposAtivos',String(ranking.length));
  setText('fixasCompareNote',`Comparação justa: ${year} até ${monthName} vs ${prevYear} até ${monthName}. A primeira coluna mantém o total completo de ${prevYear}.`);
  if(tipo==='__all'){
    setText('fixasChartTitle',`Evolução mensal — despesas fixas ${year}`);
    setText('fixasInsightTitle','Leitura global');
    makeBars('chartFixas',fixedMonthlyMap(rows,'__all',year).map(v=>v/1000),shortMonthLabels(),'blue');
    const topPct=total?top[1]/total*100:null;
    document.getElementById('fixasInsights').innerHTML=`<div class="alert good">Total de despesas fixas em ${year} até ${monthName}: <b>${formatEuroAmount(total)}</b>.</div><div class="alert">Maior despesa fixa até ${monthName}: <b>${top[0]}</b>, com ${formatEuroAmount(top[1])}.</div><div class="alert ${topPct&&topPct>35?'bad':'good'}">Comparativo correto: ${formatEuroAmount(total)} em ${year} vs ${formatEuroAmount(prevYtdTotal)} em ${prevYear} até ${monthName}.</div>`;
    document.getElementById('fixasTable').innerHTML=ranking.map(([name,v])=>{ const prevYtd=byPrevYtd[name]||0; const prevFull=byPrevFull[name]||0; const peso=total?v/total*100:null; const estado=prevYtd?comparisonBadge(v,prevYtd,`vs ${prevYear} até ${monthName}`):'<span class="tag soft">Sem dados suficientes</span>'; return `<tr><td>${name}</td><td class="money">${prevFull?formatEuroAmount(prevFull):'<span class="empty">—</span>'}</td><td class="money">${prevYtd?formatEuroAmount(prevYtd):'<span class="empty">—</span>'}</td><td class="money"><b>${formatEuroAmount(v)}</b></td><td class="money">${pctText(peso)}</td><td>${estado}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Sem despesas fixas registadas.</td></tr>';
  }else{
    const vals=fixedMonthlyMap(rows,tipo,year); const val=sum(vals.slice(0,currentMonthLimit+1)); const prevYtd=byPrevYtd[tipo]||0; const prevFull=byPrevFull[tipo]||0;
    setText('fixasChartTitle',`Evolução mensal — ${tipo}`);
    setText('fixasInsightTitle',`Ficha individual — ${tipo}`);
    makeBars('chartFixas',vals.map(v=>v/1000),shortMonthLabels(),'blue');
    document.getElementById('fixasInsights').innerHTML=`<div class="alert good">Total ${year} até ${monthName}: <b>${formatEuroAmount(val)}</b>.</div><div class="alert">Comparativo ${prevYear} até ${monthName}: ${prevYtd?formatEuroAmount(prevYtd):'sem dados suficientes'}. Total completo ${prevYear}: ${prevFull?formatEuroAmount(prevFull):'—'}.</div><div class="alert">Esta vista permite validar custos recorrentes e identificar desvios.</div>`;
    document.getElementById('fixasTable').innerHTML=`<tr><td>${tipo}</td><td class="money">${prevFull?formatEuroAmount(prevFull):'<span class="empty">—</span>'}</td><td class="money">${prevYtd?formatEuroAmount(prevYtd):'<span class="empty">—</span>'}</td><td class="money"><b>${formatEuroAmount(val)}</b></td><td class="money">${pctText(val/(total||1)*100)}</td><td>${prevYtd?comparisonBadge(val,prevYtd,`vs ${prevYear} até ${monthName}`):'<span class="tag soft">Sem dados suficientes</span>'}</td></tr>`;
  }
}

let histFatData=null;
function monthIndexPt(m){
  const s=String(m||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const arr=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const i=arr.indexOf(s);
  return i>=0?i:0;
}
function setText(id,val){const el=document.getElementById(id); if(el) el.textContent=val;}
function renderDualBars(id,prev,curr,labels){
  const el=document.getElementById(id); if(!el)return; el.innerHTML='';
  const max=Math.max(1,...prev,...curr);
  const h=chartBarHeights(el,205,34);
  labels.forEach((lab,i)=>{
    const wrap=document.createElement('div');
    wrap.style.flex='1';wrap.style.display='flex';wrap.style.gap='4px';wrap.style.alignItems='flex-end';wrap.style.justifyContent='center';wrap.style.position='relative';wrap.style.height='100%';
    const b1=document.createElement('div'); b1.className='bar blue'; b1.style.flex='0 0 42%'; b1.style.height=(h.min+(prev[i]/max)*h.max)+'px'; b1.title='Ano anterior · '+fmt.format(prev[i]||0);
    const b2=document.createElement('div'); b2.className='bar'; b2.style.flex='0 0 42%'; b2.style.height=(h.min+(curr[i]/max)*h.max)+'px'; b2.title='Ano selecionado · '+fmt.format(curr[i]||0);
    const sp=document.createElement('span'); sp.textContent=lab; sp.style.position='absolute'; sp.style.bottom='-38px'; sp.style.left='50%'; sp.style.transform='translateX(-50%)'; sp.style.fontSize='12px'; sp.style.color='var(--muted)'; sp.style.fontWeight='900';
    wrap.appendChild(b1);wrap.appendChild(b2);wrap.appendChild(sp);el.appendChild(wrap);
  });
}
async function loadFaturacaoHistorico(){
  if(!db)return;
  try{
    const [{data:hist,error:err1},{data:diaria,error:err2}]=await Promise.all([
      db.from('faturacao_historica').select('*'),
      db.from('faturacao_diaria').select('*')
    ]);
    if(err1)throw err1; if(err2)throw err2;
    const byYear={}, byYearMonth={};
    (hist||[]).forEach(r=>{
      const ano=Number(r['Ano']||r.ano); const mes=String(r['Mês']||r.mes||''); const valor=Number(r['Valor']||r.valor||0);
      if(!ano||!mes)return;
      const mi=monthIndexPt(mes); const key=ano+'-'+mi;
      byYear[ano]=(byYear[ano]||0)+valor;
      byYearMonth[key]=(byYearMonth[key]||0)+valor;
    });
    (diaria||[]).forEach(r=>{
      const dataStr=r['Data']||r.data; const d=dataStr?new Date(dataStr):null;
      const ano=Number(r['Ano']||r.ano||(d?d.getFullYear():0));
      const mi=(r['Mês']||r.mes)?monthIndexPt(r['Mês']||r.mes):(d?d.getMonth():0);
      const valor=Number(r['Valor']||r.valor||0);
      if(!ano)return;
      const key=ano+'-'+mi;
      byYear[ano]=(byYear[ano]||0)+valor;
      byYearMonth[key]=(byYearMonth[key]||0)+valor;
    });
    const years=Object.keys(byYear).map(Number).sort((a,b)=>a-b);
    histFatData={years,byYear,byYearMonth};
    const sel=document.getElementById('histYearSelect');
    if(sel){
      sel.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');
      sel.value=String(years[years.length-1]||new Date().getFullYear());
    }
    const total=Object.values(byYear).reduce((a,b)=>a+b,0);
    const bestYear=years.reduce((best,y)=>byYear[y]>(byYear[best]||0)?y:best,years[0]);
    let bestKey=null,bestVal=-1;
    Object.entries(byYearMonth).forEach(([k,v])=>{if(v>bestVal){bestVal=v;bestKey=k;}});
    const parts=bestKey?bestKey.split('-').map(Number):[null,null]; const bestY=parts[0], bestM=parts[1];
    const monthVals=Object.values(byYearMonth).filter(v=>v>0);
    setText('histTotal',fmt.format(total));
    setText('histTotalNote',years.length?`Período ${years[0]}-${years[years.length-1]}`:'—');
    setText('histBestYear',bestYear?String(bestYear):'—');
    setText('histBestYearValue',bestYear?fmt.format(byYear[bestYear]||0):'—');
    setText('histBestMonth',bestY?`${meses[bestM]} ${bestY}`:'—');
    setText('histBestMonthValue',bestY?fmt.format(bestVal):'—');
    setText('histAvgMonth',monthVals.length?fmt.format(monthVals.reduce((a,b)=>a+b,0)/monthVals.length):'—');
    makeBars('chartHistAnnual',years.map(y=>(byYear[y]||0)/1000),years.map(String),'blue');
    renderFaturacaoHistoricoAno();
  }catch(e){
    console.error('Erro histórico faturação',e);
    const tbody=document.getElementById('histMonthlyTable');
    if(tbody)tbody.innerHTML='<tr><td colspan="5" class="empty">Não foi possível carregar a faturação histórica. Confirma permissões/RLS no Supabase.</td></tr>';
  }
}
function renderFaturacaoHistoricoAno(){
  if(!histFatData)return;
  const sel=document.getElementById('histYearSelect');
  const year=Number(sel?.value||histFatData.years?.[histFatData.years.length-1]||new Date().getFullYear());
  const prev=year-1;
  const currVals=meses.map((_,i)=>histFatData.byYearMonth[year+'-'+i]||0);
  const prevVals=meses.map((_,i)=>histFatData.byYearMonth[prev+'-'+i]||0);
  setText('histMonthlyTitle',`Evolução mensal — ${year} vs ${prev}`);
  setText('histMonthlyNote','Barras azuis: ano anterior. Barras verdes: ano selecionado.');
  setText('histYearPrevHead',String(prev));
  setText('histYearCurrentHead',String(year));
  renderDualBars('chartHistMonthly',prevVals,currVals,meses.map(m=>m.slice(0,3)));
  const tbody=document.getElementById('histMonthlyTable');
  if(tbody){
    tbody.innerHTML=meses.map((m,i)=>{
      const diff=currVals[i]-prevVals[i];
      const hasComparison=currVals[i]>0 && prevVals[i]>0;
      const diffHtml=hasComparison?`<b class="${diff>=0?'money-positive':'money-negative'}">${fmt.format(diff)}</b>`:'<span class="empty">—</span>';
      return `<tr><td>${m}</td><td class="money">${prevVals[i]>0?fmt.format(prevVals[i]):'<span class="empty">—</span>'}</td><td class="money"><b>${currVals[i]>0?fmt.format(currVals[i]):'<span class="empty">—</span>'}</b></td><td class="money">${diffHtml}</td><td>${comparisonBadge(currVals[i],prevVals[i],'vs ano anterior')}</td></tr>`;
    }).join('');
  }
  const lastMonthIndex=Math.max(0,...currVals.map((v,i)=>v>0?i:-1));
  const totalCurr=currVals.slice(0,lastMonthIndex+1).reduce((a,b)=>a+b,0), totalPrev=prevVals.slice(0,lastMonthIndex+1).reduce((a,b)=>a+b,0);
  const bestIdx=currVals.indexOf(Math.max(...currVals));
  const insight=document.getElementById('histInsights');
  if(insight){
    insight.innerHTML=`<div class="alert ${totalCurr>=totalPrev?'good':'bad'}"><b>YTD ${year} vs YTD ${prev}</b><span class="amount">${comparisonText(totalCurr,totalPrev,`vs ${prev} até ${meses[lastMonthIndex]}`)}</span><br>${year} até ${meses[lastMonthIndex]}: ${fmt.format(totalCurr)}. ${prev} até ${meses[lastMonthIndex]}: ${fmt.format(totalPrev)}.</div><div class="alert good"><b>Melhor mês de ${year}</b><span class="amount">${fmt.format(currVals[bestIdx]||0)}</span><br>${meses[bestIdx]} é o mês com maior faturação no ano selecionado.</div><div class="alert"><b>Comparação justa</b><br>O comparativo principal usa sempre o acumulado até ao mesmo mês nos dois anos.</div>`;
  }
}

async function loadV39(){
  dashboardCache=null;
  await loadDashboardReal();
  await loadResultadosReais();
  await loadFornecedoresReais();
  await loadAnalisesReais();
  await loadDespesasFixasConsulta();
  await loadFaturacaoHistorico();
}

build();installPageFooters();installPhonebarInset();installZoomLock();updateBackupTimestamp();document.querySelectorAll('form[data-type="Investimento"]').forEach(updateAmortizacaoPreview);loadFaturacaoAtualReal();loadV39();
