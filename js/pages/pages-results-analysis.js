// ============================== V49 — Resultados e Análises estabilizados ==============================
(function(){
  const URL='https://hrlfwpwzciljwpgejmha.supabase.co';
  const KEY='sb_publishable_2VSqW87Rn7f4OwC1EXDSoQ_CInkq7mK';
  const client = (typeof window.supabase !== 'undefined') ? window.supabase.createClient(URL, KEY) : null;
  const MESES_V49=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const SHORT_V49=MESES_V49.map(m=>m.slice(0,3));
  const EUR_V49=createEuroFormatter();
  let analisesExpenseFilter='Fornecedores';

  function normTxt(v){ return String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function cell(r,names){ for(const n of names){ if(r && Object.prototype.hasOwnProperty.call(r,n)) return r[n]; } return null; }
  function mesIndex(v){ const s=normTxt(v); return MESES_V49.findIndex(m=>normTxt(m)===s || normTxt(m).slice(0,3)===s.slice(0,3)); }
  function key(y,m){ return `${y}-${String(m+1).padStart(2,'0')}`; }
  function add(map,k,v){ map[k]=(map[k]||0)+(Number(v)||0); }
  function sum(a){ return a.reduce((x,y)=>x+(Number(y)||0),0); }
  function fmtPct(v){ return Number.isFinite(v) ? `${v>=0?'+':''}${v.toFixed(1).replace('.',',')}%` : 'Sem dados suficientes'; }
  function pct(v){ return Number.isFinite(v) ? `${v.toFixed(1).replace('.',',')}%` : '—'; }
  function moneyClass(v){ return (Number(v)||0) >= 0 ? 'money-positive' : 'money-negative'; }
  function isTotalTipo(v){ const s=normTxt(v); return ['total','totais','subtotal','sub total'].includes(s); }
  function setText(id,t){ const el=document.getElementById(id); if(el) el.textContent=t; }
  async function all(table){
    if(!client) throw new Error('Supabase não carregou.');
    const {data,error}=await client.from(table).select('*');
    if(error) throw error;
    return data || [];
  }
  function diasMes(y,m){ return new Date(y,m+1,0).getDate(); }
  function amortizacoes(inv){
    const data=cell(inv,['Data','data']); if(!data) return [];
    const d=new Date(String(data)+'T00:00:00'); if(isNaN(d)) return [];
    const total=Number(cell(inv,['Valor Total','valor_total','ValorTotal','valor'])||0);
    const meses=Number(cell(inv,['Meses Amortização','meses_amortizacao','MesesAmortizacao'])||1) || 1;
    const mensal=total/meses; const rows=[];
    for(let i=0;i<meses;i++){
      const x=new Date(d); x.setMonth(d.getMonth()+i);
      rows.push({ano:x.getFullYear(),mes:x.getMonth(),valor:mensal});
    }
    return rows;
  }
  function renderBarsV49(id,vals,labels,mode='gold'){
    const el=document.getElementById(id); if(!el) return;
    el.classList.remove('signed-chart'); el.classList.add('chart');
    el.innerHTML='';
    const max=Math.max(1,...vals.map(v=>Math.abs(Number(v)||0)));
    const isLarge=el.classList.contains('chart-large');
    const h=chartBarHeights(el,isLarge?245:165,isLarge?42:28);
    vals.forEach((v,i)=>{
      const n=Number(v)||0;
      const d=document.createElement('div');
      d.className='bar '+(mode==='blue'?'blue':mode==='red'&&i%2?'red':'');
      d.style.height=(h.min+(Math.max(0,n)/max)*h.max)+'px';
      d.title=`${labels[i]||''} · ${EUR_V49.format(n*1000)}`;
      d.innerHTML=`<span>${labels[i]||''}</span>`;
      el.appendChild(d);
    });
  }
  function renderSignedV49(id,vals,labels){
    const el=document.getElementById(id); if(!el) return;
    el.classList.remove('chart'); el.classList.add('signed-chart');
    el.innerHTML='';
    const maxAbs=Math.max(1,...vals.map(v=>Math.abs(Number(v)||0)));
    const h=chartBarHeights(el,88,8);
    vals.forEach((v,i)=>{
      const n=Number(v)||0;
      const wrap=document.createElement('div'); wrap.className='signed-wrap';
      const bar=document.createElement('div'); bar.className='signed-bar '+(n<0?'negative':'positive');
      bar.style.height=(Math.max(h.min,Math.abs(n)/maxAbs*h.max))+'px';
      bar.title=`${labels[i]||''} · ${EUR_V49.format(n*1000)}`;
      const sp=document.createElement('span'); sp.textContent=labels[i]||'';
      wrap.appendChild(bar); wrap.appendChild(sp); el.appendChild(wrap);
    });
  }
  async function computeV49(){
    if(typeof window.getRestaurantMetrics==='function'){
      const d=await window.getRestaurantMetrics(false,new Date());
      return {
        year:d.currentYear,
        month:d.currentMonth,
        monthName:d.currentMonthName,
        fatEstimada:d.estimate.estimated,
        fatAtual:d.estimate.observedTotal,
        observedDays:d.estimate.observedDays,
        dailyAverage:d.estimate.dailyAverage,
        monthly:d.monthly.map(row=>({mes:row.mes,short:row.short,fat:row.fat,desp:row.desp,lucro:row.lucro,margem:row.margem})),
        forn:d.forn,
        despBuckets:d.buckets,
        yearFat:d.yearFat,
        yearDesp:d.yearDesp
      };
    }
    const source=window.loadRestaurantData ? await window.loadRestaurantData() : null;
    const [fatHist,fatDia,forn,ord,fix,inv]=source ? [
      source.faturacao_historica,source.faturacao_diaria,source.fornecedores_historico,source.ordenados,source.despesas_fixas,source.investimentos
    ] : await Promise.all([
      all('faturacao_historica'),all('faturacao_diaria'),all('fornecedores_historico'),all('ordenados'),all('despesas_fixas'),all('investimentos')
    ]);
    const today=new Date();
    const year=today.getFullYear();
    const month=today.getMonth();
    const hist={}, daily={}, despesas={}, despBuckets={Fornecedores:{},Ordenados:{},'Despesas Fixas':{},Amortizações:{}};
    const yearFat={}, yearDesp={};

    fatHist.forEach(r=>{ const y=Number(cell(r,['Ano','ano'])); const m=mesIndex(cell(r,['Mês','mes'])); const v=Number(cell(r,['Valor','valor'])||0); if(y&&m>=0){ add(hist,key(y,m),v); add(yearFat,y,v); }});
    fatDia.forEach(r=>{ const ds=cell(r,['Data','data']); const d=ds?new Date(String(ds)+'T00:00:00'):null; const y=Number(cell(r,['Ano','ano']) || (d&&!isNaN(d)?d.getFullYear():0)); const m=(cell(r,['Mês','mes'])!==null && cell(r,['Mês','mes'])!==undefined) ? mesIndex(cell(r,['Mês','mes'])) : (d&&!isNaN(d)?d.getMonth():-1); const v=Number(cell(r,['Valor','valor'])||0); if(y&&m>=0){ add(daily,key(y,m),v); }});

    // Recalcula ano de faturação preferindo diária quando existe informação diária nesse mês.
    Object.keys(hist).forEach(k=>{ const y=Number(k.slice(0,4)); if(!daily[k]) add(yearFat,y,0); });
    Object.keys(daily).forEach(k=>{ const y=Number(k.slice(0,4)); add(yearFat,y,daily[k]); });

    function addExpense(rows,bucket){
      rows.forEach(r=>{
        if(bucket==='Despesas Fixas' && isTotalTipo(cell(r,['Tipo','tipo']))) return;
        const y=Number(cell(r,['Ano','ano'])); const m=mesIndex(cell(r,['Mês','mes'])); const v=Number(cell(r,['Valor','valor'])||0);
        if(y&&m>=0){ const k=key(y,m); add(despesas,k,v); add(despBuckets[bucket],k,v); add(yearDesp,y,v); }
      });
    }
    addExpense(forn,'Fornecedores'); addExpense(ord,'Ordenados'); addExpense(fix,'Despesas Fixas');
    inv.forEach(r=>amortizacoes(r).forEach(x=>{ const k=key(x.ano,x.mes); add(despesas,k,x.valor); add(despBuckets.Amortizações,k,x.valor); add(yearDesp,x.ano,x.valor); }));

    const estimate=computeRevenueEstimate(fatDia,today);
    const fatAtual=estimate.observedTotal;
    const observedDays=estimate.observedDays;
    const dailyAverage=estimate.dailyAverage;
    const fatEstimada=estimate.estimated;
    const estimatedDespForMonth=i=>{
      const cur=key(year,i), prev=key(year-1,i);
      const fornecedores=despBuckets.Fornecedores[cur] || despBuckets.Fornecedores[prev] || 0;
      const ordenados=despBuckets.Ordenados[cur] || despBuckets.Ordenados[prev] || 0;
      const fixas=despBuckets['Despesas Fixas'][cur] || despBuckets['Despesas Fixas'][prev] || 0;
      const amort=despBuckets.Amortizações[cur] || despBuckets.Amortizações[prev] || 0;
      return fornecedores+ordenados+fixas+amort;
    };
    const monthly=MESES_V49.map((m,i)=>{ const k=key(year,i); const fat=(daily[k]!==undefined && daily[k]>0) ? daily[k] : (hist[k]||0); const desp=i<=month?estimatedDespForMonth(i):(despesas[k]||0); const lucro=fat-desp; return {mes:m,short:m.slice(0,3),fat,desp,lucro,margem:fat?lucro/fat*100:null}; });
    return {year,month,monthName:MESES_V49[month],fatEstimada,fatAtual,observedDays,dailyAverage,monthly,forn,despBuckets,yearFat,yearDesp};
  }

  async function loadResultadosV49(){
    try{
      const d=await computeV49();
      const fatYtd=sum(d.monthly.slice(0,d.month+1).map(x=>x.fat));
      const despYtd=sum(d.monthly.slice(0,d.month+1).map(x=>x.desp));
      const lucroYtd=fatYtd-despYtd; const margemYtd=fatYtd?lucroYtd/fatYtd*100:null;
      setText('resFatEstTitle',`Faturação Estimada — ${d.monthName} ${d.year}`);
      setText('resFatEstimada',EUR_V49.format(d.fatEstimada));
      setText('resFatEstDelta',d.observedDays?`Média ${EUR_V49.format(d.dailyAverage)}/dia · ${d.observedDays} dias observados`:'Sem faturação diária registada este mês');
      setText('resFatAtualTitle',`Faturação registada — ${d.monthName}`);
      setText('resFatAtual',EUR_V49.format(d.fatAtual));
      setText('resFatAtualDelta','Dados reais do Supabase');
      setText('resYtd',EUR_V49.format(lucroYtd));
      setText('resResultadoDelta',`Faturação YTD ${EUR_V49.format(fatYtd)} · Despesas YTD ${EUR_V49.format(despYtd)}`);
      setText('resMargemMedia',pct(margemYtd));
      setText('resMargemYtd','Margem acumulada com despesas estimadas quando faltam dados');
      const ytdEl=document.getElementById('resYtd'); if(ytdEl){ ytdEl.classList.toggle('money-positive',lucroYtd>=0); ytdEl.classList.toggle('money-negative',lucroYtd<0); }
      renderSignedV49('chartLucroMes',d.monthly.map(x=>x.lucro/1000),d.monthly.map(x=>x.short));
      const years=[...new Set([...Object.keys(d.yearFat),...Object.keys(d.yearDesp)].map(Number).filter(Boolean))].sort((a,b)=>a-b);
      renderSignedV49('chartLucroAnos',years.slice(-6).map(y=>((d.yearFat[y]||0)-(d.yearDesp[y]||0))/1000),years.slice(-6).map(String));
      setText('resChartNote','Barras verdes = lucro positivo. Barras vermelhas = lucro negativo. Despesas podem usar o ano anterior quando faltam dados.');
      const tbody=document.getElementById('resultadosTable');
      if(tbody){
        tbody.innerHTML=d.monthly.slice(0,d.month+1).map(x=>{
          const estado=x.lucro<0?'<span class="tag bad">Negativo</span>':(x.margem!==null&&x.margem<20?'<span class="tag warn">Vigiar</span>':'<span class="tag good">Positivo</span>');
          return `<tr><td>${x.mes}${x.mes===d.monthName?' <span class="tag good">Atual</span>':''}</td><td class="money">${EUR_V49.format(x.fat)}</td><td class="money">${EUR_V49.format(x.desp)}</td><td class="money"><b class="${moneyClass(x.lucro)}">${EUR_V49.format(x.lucro)}</b></td><td class="money">${pct(x.margem)}</td><td>${estado}</td></tr>`;
        }).join('') || '<tr><td colspan="6" class="empty">Sem dados suficientes.</td></tr>';
      }
      const alertBox=document.getElementById('resultadosAlertas');
      if(alertBox){
        alertBox.innerHTML=`<div class="alert ${d.observedDays>=10?'good':'bad'}"><b>Faturação estimada</b><span class="amount">${EUR_V49.format(d.fatEstimada)}</span><br>Baseada em ${d.observedDays} dias observados no mês atual.</div><div class="alert ${lucroYtd>=0?'good':'bad'}"><b>Resultado acumulado ${d.year}</b><span class="amount">${EUR_V49.format(lucroYtd)}</span><br>Margem acumulada: ${pct(margemYtd)}.</div><div class="alert"><b>Critério de leitura</b><br>O acumulado considera apenas meses até ${d.monthName}, para não comparar períodos futuros sem dados.</div>`;
      }
      console.info('[V49] Resultados carregados');
    }catch(e){ console.error('[V49] Erro Resultados',e); const tbody=document.getElementById('resultadosTable'); if(tbody) tbody.innerHTML='<tr><td colspan="6" class="empty">Erro ao carregar resultados. Ver consola.</td></tr>'; }
  }

  async function loadAnalisesV49(){
    try{
      const d=await computeV49();
      const months=d.monthly.slice(0,d.month+1);
      renderBarsV49('chartAnalisesFat',months.map(x=>x.fat/1000),months.map(x=>x.short),'gold');
      const filterMap=d.despBuckets[analisesExpenseFilter]||{};
      const expenseVals=months.map((x,i)=>filterMap[key(d.year,i)]||0);
      renderBarsV49('chartAnalisesDesp',expenseVals.map(v=>v/1000),months.map(x=>x.short),'blue');
      setText('analisesDespTitle',`Evolução das despesas — ${analisesExpenseFilter}`);
      document.querySelectorAll('[data-expense-filter]').forEach(btn=>btn.classList.toggle('active',btn.dataset.expenseFilter===analisesExpenseFilter));
      const metrics=document.querySelectorAll('#analises .card.metric');
      const best=months.reduce((a,b)=>b.fat>a.fat?b:a,months[0]||{mes:'—',fat:0});
      const totalFat=sum(months.map(x=>x.fat)), totalDesp=sum(months.map(x=>x.desp)); const margem=totalFat?(totalFat-totalDesp)/totalFat*100:null;
      if(metrics[0]){ metrics[0].querySelector('b').textContent=best.mes; metrics[0].querySelector('.delta').textContent=`${EUR_V49.format(best.fat)} de faturação`; }
      if(metrics[1]){ metrics[1].querySelector('b').textContent=pct(margem); metrics[1].querySelector('.delta').textContent='Margem acumulada do ano'; }
      const custos={Fornecedores:0,Ordenados:0,'Despesas Fixas':0,Amortizações:0};
      Object.entries(d.despBuckets).forEach(([cat,map])=>{ Object.entries(map).forEach(([k,v])=>{ const y=Number(k.slice(0,4)); const m=Number(k.slice(5,7))-1; if(y===d.year && m<=d.month) custos[cat]+=v; }); });
      const topCat=Object.entries(custos).sort((a,b)=>b[1]-a[1])[0]||['—',0];
      if(metrics[2]){ metrics[2].querySelector('b').textContent=topCat[0]; metrics[2].querySelector('.delta').textContent=`${EUR_V49.format(topCat[1])} até ${d.monthName}`; }
      const bySup={};
      d.forn.forEach(r=>{ const y=Number(cell(r,['Ano','ano'])); const m=mesIndex(cell(r,['Mês','mes'])); if(y===d.year && m>=0 && m<=d.month) add(bySup,String(cell(r,['Fornecedor','fornecedor'])||'—'),Number(cell(r,['Valor','valor'])||0)); });
      const ranking=Object.entries(bySup).sort((a,b)=>b[1]-a[1]); const totalSup=sum(ranking.map(x=>x[1]));
      if(metrics[3]){ const top=ranking[0]||['—',0]; metrics[3].querySelector('b').textContent=top[0]; metrics[3].querySelector('.delta').textContent=`${EUR_V49.format(top[1])} até ${d.monthName}`; }
      const topBody=document.getElementById('analisesTopFornecedores');
      if(topBody){ topBody.innerHTML=ranking.slice(0,8).map(([f,v],i)=>`<tr><td>${f}</td><td class="money">${EUR_V49.format(v)}</td><td class="money">${pct(totalSup?v/totalSup*100:null)}</td><td>${i===0?'<span class="tag warn">Maior peso</span>':'<span class="tag good">Normal</span>'}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Sem fornecedores no ano atual.</td></tr>'; }
      const pesoBody=document.getElementById('analisesPesoCustos');
      if(pesoBody){ const totalC=sum(Object.values(custos)); pesoBody.innerHTML=Object.entries(custos).sort((a,b)=>b[1]-a[1]).map(([cat,v])=>`<tr><td>${cat}</td><td class="money">${EUR_V49.format(v)}</td><td class="money">${pct(totalC?v/totalC*100:null)}</td><td>${totalC && v/totalC>0.45?'<span class="tag warn">Vigiar</span>':'<span class="tag good">Controlado</span>'}</td></tr>`).join(''); }
      const insights=document.querySelector('#analises .analysis-list');
      if(insights){
        const top=ranking[0]||['—',0];
        insights.innerHTML=`<div class="insight"><b>Melhor mês</b><span class="up">${best.mes}: ${EUR_V49.format(best.fat)}.</span></div><div class="insight"><b>Maior peso de custos</b><span class="warn">${topCat[0]}: ${EUR_V49.format(topCat[1])}.</span></div><div class="insight"><b>Fornecedor com maior peso</b><span class="warn">${top[0]} representa ${pct(totalSup?top[1]/totalSup*100:null)} dos fornecedores até ${d.monthName}.</span></div><div class="insight"><b>Margem acumulada</b><span class="${margem>=20?'up':'warn'}">${pct(margem)} até ${d.monthName}.</span></div>`;
      }
      console.info('[V49] Análises carregadas');
    }catch(e){ console.error('[V49] Erro Análises',e); const tb=document.getElementById('analisesTopFornecedores'); if(tb) tb.innerHTML='<tr><td colspan="4" class="empty">Erro ao carregar análises. Ver consola.</td></tr>'; }
  }

  window.loadResultadosReais=loadResultadosV49;
  window.loadAnalisesReais=loadAnalisesV49;
  window.setAnalisesExpenseFilter=function(type){
    analisesExpenseFilter=type;
    loadAnalisesV49();
  };
  function runV49(){ loadResultadosV49(); loadAnalisesV49(); }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(runV49,900));
  setTimeout(runV49,2200);
})();

