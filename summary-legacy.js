// ============================== V61 — Resumo / Alertas inteligentes ==============================
(function(){
  window.loadResumoAlertasV61=function(){
    return typeof window.loadResumoAlertasV611==='function' ? window.loadResumoAlertasV611() : null;
  };
  return;
  const URL='https://hrlfwpwzciljwpgejmha.supabase.co';
  const KEY='sb_publishable_2VSqW87Rn7f4OwC1EXDSoQ_CInkq7mK';
  const client=(typeof db!=='undefined' && db) ? db : (window.supabase ? window.supabase.createClient(URL,KEY) : null);
  const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const EUR=createEuroFormatter();
  const norm=s=>String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const monthIndex=m=>MESES.findIndex(x=>norm(x)===norm(m) || norm(x).slice(0,3)===norm(m).slice(0,3));
  const val=(r,names)=>{for(const n of names){if(r && Object.prototype.hasOwnProperty.call(r,n) && r[n]!==null && r[n]!==undefined)return r[n]} return null;};
  const add=(map,k,v)=>{map[k]=(map[k]||0)+(Number(v)||0)};
  const sum=arr=>arr.reduce((a,b)=>a+(Number(b)||0),0);
  const pct=v=>Number.isFinite(v)?`${v.toFixed(1).replace('.',',')}%`:'—';
  const pctSigned=v=>Number.isFinite(v)?`${v>=0?'+':''}${v.toFixed(1).replace('.',',')}%`:'Sem dados';
  const money=v=>{
    const n=Number(v)||0;
    const sign=n<0?'-':'';
    const [whole,dec]=Math.abs(n).toFixed(1).split('.');
    return `${sign}${whole.replace(/\B(?=(\d{3})+(?!\d))/g,' ')},${dec} €`;
  };
  const key=(y,m)=>`${y}-${String(m+1).padStart(2,'0')}`;
  const isAggregate=v=>['total','totais','subtotal','sub total'].includes(norm(v));
  const setText=(el,text)=>{ if(el) el.textContent=text; };
  async function all(table){
    if(!client) return [];
    const {data,error}=await client.from(table).select('*');
    if(error){ console.warn('[V61] Erro ao carregar '+table,error); return []; }
    return data||[];
  }
  function amortRows(r){
    const ds=val(r,['Data','data']); if(!ds) return [];
    const d=new Date(String(ds)+'T00:00:00'); if(isNaN(d)) return [];
    const total=Number(val(r,['Valor Total','valor_total','ValorTotal','valor'])||0);
    const months=Number(val(r,['Meses Amortização','meses_amortizacao','MesesAmortizacao'])||1)||1;
    const monthly=total/months;
    const out=[];
    for(let i=0;i<months;i++){ const x=new Date(d); x.setMonth(d.getMonth()+i); out.push({y:x.getFullYear(),m:x.getMonth(),v:monthly}); }
    return out;
  }
  function renderBars(id,vals,labels){
    const el=document.getElementById(id); if(!el) return;
    el.classList.remove('signed-chart'); el.classList.add('chart'); el.innerHTML='';
    const max=Math.max(1,...vals.map(v=>Number(v)||0));
    const h=chartBarHeights(el,165,34);
    vals.forEach((v,i)=>{ const b=document.createElement('div'); b.className='bar'; b.style.height=(h.min+(Number(v||0)/max)*h.max)+'px'; b.title=`${labels[i]} · ${money((Number(v)||0)*1000)}`; b.innerHTML=`<span>${labels[i]}</span>`; el.appendChild(b); });
  }
  function tag(state,text){ return `<span class="tag ${state}">${text}</span>`; }

  async function loadResumoV61(){
    const sec=document.getElementById('resumo'); if(!sec) return;
    try{
      const [fatHist,fatDia,forn,ords,fixas,invs]=await Promise.all([
        all('faturacao_historica'),all('faturacao_diaria'),all('fornecedores_historico'),all('ordenados'),all('despesas_fixas'),all('investimentos')
      ]);
      const now=new Date();
      const year=now.getFullYear();
      const month=now.getMonth();
      const prevMonth=month===0?11:month-1;
      const prevYear=month===0?year-1:year;
      const daysInMonth=new Date(year,month+1,0).getDate();
      const monthName=MESES[month];
      const curKey=key(year,month);
      const prevKey=key(prevYear,prevMonth);
      const samePrevKey=key(year-1,month);
      const fatByMonth={}, expensesByMonth={}, fornecedoresByMonth={}, fixasByMonth={}, ordsByMonth={}, amortByMonth={}, topSuppliers={}, topFixas={};

      fatHist.forEach(r=>{ const y=Number(val(r,['Ano','ano'])); const m=monthIndex(val(r,['Mês','mes'])); const v=Number(val(r,['Valor','valor'])||0); if(y&&m>=0)add(fatByMonth,key(y,m),v); });
      fatDia.forEach(r=>{ const ds=val(r,['Data','data']); const d=ds?new Date(String(ds)+'T00:00:00'):null; const y=Number(val(r,['Ano','ano']) || (d&&!isNaN(d)?d.getFullYear():0)); const m=(val(r,['Mês','mes'])!==null && val(r,['Mês','mes'])!==undefined)?monthIndex(val(r,['Mês','mes'])):(d&&!isNaN(d)?d.getMonth():-1); const v=Number(val(r,['Valor','valor'])||0); if(y&&m>=0)add(fatByMonth,key(y,m),v); });
      forn.forEach(r=>{ const y=Number(val(r,['Ano','ano'])); const m=monthIndex(val(r,['Mês','mes'])); const v=Number(val(r,['Valor','valor'])||0); const f=String(val(r,['Fornecedor','fornecedor'])||'—'); if(y&&m>=0){add(fornecedoresByMonth,key(y,m),v); add(expensesByMonth,key(y,m),v); if(y===year && m<=month)add(topSuppliers,f,v);} });
      ords.forEach(r=>{ const y=Number(val(r,['Ano','ano'])); const m=monthIndex(val(r,['Mês','mes'])); const v=Number(val(r,['Valor','valor'])||0); if(y&&m>=0){add(ordsByMonth,key(y,m),v); add(expensesByMonth,key(y,m),v);} });
      fixas.forEach(r=>{ const tipo=String(val(r,['Tipo','tipo'])||'—'); if(isAggregate(tipo)) return; const y=Number(val(r,['Ano','ano'])); const m=monthIndex(val(r,['Mês','mes'])); const v=Number(val(r,['Valor','valor'])||0); if(y&&m>=0){add(fixasByMonth,key(y,m),v); add(expensesByMonth,key(y,m),v); if(y===year && m<=month)add(topFixas,tipo,v);} });
      invs.forEach(r=>amortRows(r).forEach(x=>{ add(amortByMonth,key(x.y,x.m),x.v); add(expensesByMonth,key(x.y,x.m),x.v); }));

      const estimate=computeRevenueEstimate(fatDia,now);
      const observedDays=estimate.observedDays;
      const fatObserved=estimate.observedTotal;
      const dailyAvg=estimate.dailyAverage;
      const fatEstimated=estimate.estimated;
      let monthlyGoal=0;
      Object.entries(fatByMonth).forEach(([monthKey,total])=>{
        const [goalYear,goalMonth]=monthKey.split('-').map(Number);
        if(goalMonth===month+1 && goalYear!==year && total>monthlyGoal) monthlyGoal=total;
      });
      if(!monthlyGoal && fatByMonth[curKey]) monthlyGoal=fatByMonth[curKey];
      const monthlyGoalProgress=monthlyGoal ? Math.min(100,Math.max(0,(fatEstimated/monthlyGoal)*100)) : null;
      const fatMonth=fatObserved || (fatByMonth[curKey]||0);
      const fatPrev=fatByMonth[prevKey]||0;
      const fatSamePrev=fatByMonth[samePrevKey]||0;
      const suppliersMonth=fornecedoresByMonth[curKey]||0;
      const fixasMonth=fixasByMonth[curKey]||0;
      const ordsMonth=ordsByMonth[curKey]||0;
      const amortMonth=amortByMonth[curKey]||0;
      const expensesMonth=suppliersMonth+fixasMonth+ordsMonth+amortMonth;
      const expensesPrev=expensesByMonth[prevKey]||0;
      const expensesEstimatedForMonth=i=>{
        const cur=key(year,i), prev=key(year-1,i);
        const suppliers=fornecedoresByMonth[cur] || fornecedoresByMonth[prev] || 0;
        const fixed=fixasByMonth[cur] || fixasByMonth[prev] || 0;
        const salaries=ordsByMonth[cur] || ordsByMonth[prev] || 0;
        const amort=amortByMonth[cur] || amortByMonth[prev] || 0;
        return suppliers+fixed+salaries+amort;
      };
      const expensesEstimated=expensesEstimatedForMonth(month);
      const hasEstimatedExpensesHistory=!!expensesByMonth[samePrevKey];
      const resultEstimated=fatEstimated-expensesEstimated;
      const marginEstimated=fatEstimated?resultEstimated/fatEstimated*100:null;
      const fatYtd=sum(MESES.slice(0,month+1).map((_,i)=>fatByMonth[key(year,i)]||0));
      const expYtd=sum(MESES.slice(0,month+1).map((_,i)=>expensesEstimatedForMonth(i)));
      const resultYtd=fatYtd-expYtd;
      const marginYtd=fatYtd?resultYtd/fatYtd*100:null;
      const topSupplier=Object.entries(topSuppliers).sort((a,b)=>b[1]-a[1])[0]||['—',0];
      const topFixa=Object.entries(topFixas).sort((a,b)=>b[1]-a[1])[0]||['—',0];
      const costPressure=fatMonth?expensesMonth/fatMonth*100:null;

      const metrics=sec.querySelectorAll('.metric');
      if(metrics[0]){
        setText(metrics[0].querySelector('small'),`Faturação estimada — ${monthName}`);
        const b=metrics[0].querySelector('b'); setText(b,money(fatEstimated)); if(b){b.className='money-positive';}
        setText(metrics[0].querySelector('.delta'),`Objetivo do mês ${monthlyGoal?money(monthlyGoal):'—'} · Conclusão ${pct(monthlyGoalProgress)}`);
        const chips=metrics[0].closest('.card').querySelector('.status-row');
        if(chips){ chips.innerHTML=`<span class="status-chip">${resultEstimated>=0?'🟢 Resultado positivo':'🔴 Resultado negativo'}</span><span class="status-chip">📅 ${observedDays}/${daysInMonth} dias</span><span class="status-chip">${costPressure&&costPressure>70?'⚠️ Custos a vigiar':'✅ Custos controlados'}</span>`; }
      }
      if(metrics[1]){ setText(metrics[1].querySelector('small'),`Faturação registada — ${monthName}`); setText(metrics[1].querySelector('b'),money(fatMonth)); setText(metrics[1].querySelector('.delta'),fatPrev?`${pctSigned((fatMonth-fatPrev)/fatPrev*100)} vs mês anterior`:'Dados reais Supabase'); }
      if(metrics[2]){ setText(metrics[2].querySelector('small'),`Despesas registadas — ${monthName}`); setText(metrics[2].querySelector('b'),money(expensesMonth)); setText(metrics[2].querySelector('.delta'),expensesPrev?`${pctSigned((expensesMonth-expensesPrev)/expensesPrev*100)} vs mês anterior`:'Fornecedores + ordenados + fixas'); }
      if(metrics[3]){ setText(metrics[3].querySelector('small'),'Margem estimada'); setText(metrics[3].querySelector('b'),pct(marginEstimated)); setText(metrics[3].querySelector('.delta'),marginEstimated!==null?(hasEstimatedExpensesHistory?`Despesas estimadas ${money(expensesEstimated)}`:'Sem histórico; usadas despesas registadas'):'Sem dados suficientes'); }
      if(metrics[4]){ setText(metrics[4].querySelector('small'),`Resultado acumulado ${year}`); setText(metrics[4].querySelector('b'),money(resultYtd)); setText(metrics[4].querySelector('.delta'),`Margem YTD ${pct(marginYtd)} · despesas estimadas`); }

      const notes=sec.querySelector('.dashboard-note');
      if(notes){
        const fatVsPrev=fatPrev?((fatMonth-fatPrev)/fatPrev*100):null;
        notes.innerHTML=`<div class="note-box"><b class="${fatVsPrev===null||fatVsPrev>=0?'money-positive':'money-negative'}">Faturação do mês</b><span>${fatPrev?`${pctSigned(fatVsPrev)} face ao mês anterior.`:`${money(fatMonth)} registados no mês atual.`} Estimativa mensal: ${money(fatEstimated)}.</span></div><div class="note-box"><b class="${costPressure&&costPressure>70?'money-negative':'money-positive'}">Custos principais</b><span>Fornecedores: ${money(suppliersMonth)}. Despesas fixas: ${money(fixasMonth)}. Maior fornecedor YTD: ${topSupplier[0]}.</span></div><div class="note-box"><b>Leitura do dono</b><span>${resultEstimated>=0?'O mês aponta para resultado positivo.':'O mês exige atenção porque o resultado estimado está negativo.'} A margem estimada é ${pct(marginEstimated)} com despesas estimadas de ${money(expensesEstimated)}.</span></div>`;
      }

      const alerts=sec.querySelectorAll('.list')[0];
      if(alerts){
        const supplierWeight=expensesMonth?suppliersMonth/expensesMonth*100:null;
        const samePrevText=fatSamePrev?`${pctSigned((fatMonth-fatSamePrev)/fatSamePrev*100)} vs ${monthName} ${year-1}`:'Sem histórico comparável';
        alerts.innerHTML=`<div class="alert ${fatSamePrev && fatMonth<fatSamePrev?'bad':'good'}"><b>Faturação comparável</b><span class="amount">${samePrevText}</span><br>Compara o mês atual com o mesmo mês do ano anterior, quando existe histórico.</div><div class="alert ${supplierWeight&&supplierWeight>55?'bad':'warn'}"><b>Fornecedores no mês</b><span class="amount">${pct(supplierWeight)}</span><br>${money(suppliersMonth)} em fornecedores. Maior peso acumulado: <b>${topSupplier[0]}</b>.</div><div class="alert ${topFixa[1]&&fixasMonth>0?'good':''}"><b>Despesas fixas</b><span class="amount">${money(fixasMonth)}</span><br>Maior despesa fixa acumulada: <b>${topFixa[0]}</b>, com ${money(topFixa[1])}.</div>`;
      }

      renderBars('chartAno',MESES.map((_,i)=>(fatByMonth[key(year,i)]||0)/1000),MESES.map(m=>m.slice(0,3)));

      const tbody=sec.querySelector('table tbody');
      if(tbody){
        const statusFat=fatPrev?((fatMonth-fatPrev)>=0?tag('good','Melhorou'):tag('bad','Desceu')):tag('','Sem comparação');
        const statusFor=suppliersMonth>0?tag(suppliersMonth>(fornecedoresByMonth[prevKey]||0)&&fornecedoresByMonth[prevKey]?'warn':'good','Acompanhar'):tag('','Sem dados');
        const statusFix=fixasMonth>0?tag('good','Registado'):tag('','Sem dados');
        const statusRes=resultEstimated>=0?tag('good','Positivo'):tag('bad','Negativo');
        tbody.innerHTML=`<tr><td>Faturação</td><td class="money"><b class="money-positive">${money(fatMonth)}</b></td><td class="money">${fatPrev?money(fatPrev):'—'}</td><td>${statusFat}</td></tr><tr><td>Fornecedores</td><td class="money"><b class="money-negative">${money(suppliersMonth)}</b></td><td class="money">${fornecedoresByMonth[prevKey]?money(fornecedoresByMonth[prevKey]):'—'}</td><td>${statusFor}</td></tr><tr><td>Despesas Fixas</td><td class="money"><b class="money-negative">${money(fixasMonth)}</b></td><td class="money">${fixasByMonth[prevKey]?money(fixasByMonth[prevKey]):'—'}</td><td>${statusFix}</td></tr><tr><td>Resultado estimado</td><td class="money"><b class="${resultEstimated>=0?'money-positive':'money-negative'}">${money(resultEstimated)}</b></td><td class="money">—</td><td>${statusRes}</td></tr>`;
      }
      console.info('[V61] Resumo / Alertas atualizado');
    }catch(e){ console.error('[V61] Erro ao atualizar Resumo / Alertas',e); }
  }
  window.loadResumoAlertasV61=loadResumoV61;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(loadResumoV61,1400));
  setTimeout(loadResumoV61,2600);
})();

