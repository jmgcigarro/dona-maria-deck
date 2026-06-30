// ============================== V61.1 — Correção Resumo / Alertas com dados reais ==============================
(function(){
  const URL='https://hrlfwpwzciljwpgejmha.supabase.co';
  const KEY='sb_publishable_2VSqW87Rn7f4OwC1EXDSoQ_CInkq7mK';
  const client=(typeof db!=='undefined' && db) ? db : (window.supabase ? window.supabase.createClient(URL,KEY) : null);
  const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const EUR=createEuroFormatter();
  const norm=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const mi=v=>MESES.findIndex(m=>norm(m)===norm(v) || norm(m).slice(0,3)===norm(v).slice(0,3));
  const val=(r,names)=>{for(const n of names){if(r && Object.prototype.hasOwnProperty.call(r,n) && r[n]!==null && r[n]!==undefined)return r[n];}return null;};
  const money=v=>{
    const n=Number(v)||0;
    const sign=n<0?'-':'';
    const [whole,dec]=Math.abs(n).toFixed(1).split('.');
    return `${sign}${whole.replace(/\B(?=(\d{3})+(?!\d))/g,' ')},${dec} €`;
  };
  const pct=v=>Number.isFinite(v)?`${v>=0?'+':''}${v.toFixed(1).replace('.',',')}%`:'Sem dados';
  const pctPlain=v=>Number.isFinite(v)?`${v.toFixed(1).replace('.',',')}%`:'—';
  const k=(y,m)=>`${y}-${String(m+1).padStart(2,'0')}`;
  const add=(map,key,value)=>{map[key]=(map[key]||0)+(Number(value)||0);};
  const isTotal=v=>['total','totais','subtotal','sub total'].includes(norm(v));
  const setText=(el,text)=>{ if(el) el.textContent=text; };
  const sum=arr=>arr.reduce((a,b)=>a+(Number(b)||0),0);

  async function all(table){
    if(!client) return [];
    const {data,error}=await client.from(table).select('*');
    if(error){console.warn('[V61.1] erro '+table,error); return [];} 
    return data||[];
  }

  function renderResumoBars(values){
    const el=document.getElementById('chartAno');
    if(!el) return;
    el.classList.remove('signed-chart');
    el.classList.add('chart');
    el.innerHTML='';
    const max=Math.max(1,...values.map(v=>Number(v)||0));
    const h=chartBarHeights(el,165,34);
    MESES.forEach((m,i)=>{
      const v=Number(values[i]||0);
      const b=document.createElement('div');
      b.className='bar';
      b.style.height=(h.min+(v/max)*h.max)+'px';
      b.title=`${m} · ${money(v)}`;
      b.innerHTML=`<span>${m.slice(0,3)}</span>`;
      el.appendChild(b);
    });
  }

  function findResumoAlertsList(){
    const sec=document.getElementById('resumo');
    if(!sec) return null;
    const cards=[...sec.querySelectorAll('.card')];
    const card=cards.find(c=>(c.querySelector('h3')?.textContent||'').trim().toLowerCase().includes('alertas de desvios'));
    return card ? card.querySelector('.list') : null;
  }

  async function loadResumoV611(){
    const sec=document.getElementById('resumo');
    if(!sec) return;
    try{
      if(typeof window.getRestaurantMetrics==='function'){
        const d=await window.getRestaurantMetrics(false,new Date());
        const year=d.currentYear;
        const month=d.currentMonth;
        const prevMonth=month===0?11:month-1;
        const prevYear=month===0?year-1:year;
        const sameYear=year-1;
        const monthName=d.currentMonthName;
        const curKey=k(year,month), prevKey=k(prevYear,prevMonth), samePrevKey=k(sameYear,month);
        const monthlyFat=d.meses.map((_,i)=>d.faturacao[k(year,i)]||0);
        renderResumoBars(monthlyFat);

        const estimate=d.estimate;
        const fatCur=estimate.observedTotal || monthlyFat[month] || 0;
        const fatEstimated=estimate.estimated || fatCur;
        let monthlyGoal=0;
        Object.entries(d.faturacao).forEach(([monthKey,total])=>{
          const [goalYear,goalMonth]=monthKey.split('-').map(Number);
          if(goalMonth===month+1 && goalYear!==year && total>monthlyGoal) monthlyGoal=total;
        });
        if(!monthlyGoal && d.faturacao[curKey]) monthlyGoal=d.faturacao[curKey];
        const monthlyGoalProgress=monthlyGoal ? Math.min(100,Math.max(0,(fatEstimated/monthlyGoal)*100)) : null;
        const fatPrev=d.faturacao[prevKey]||0;
        const fatSamePrev=d.faturacao[samePrevKey] || 0;
        const supCur=d.buckets.Fornecedores[curKey]||0;
        const supPrev=d.buckets.Fornecedores[prevKey]||0;
        const fixCur=d.buckets['Despesas Fixas'][curKey]||0;
        const fixPrev=d.buckets['Despesas Fixas'][prevKey]||0;
        const totalCostCur=d.despesas[curKey]||0;
        const totalCostEstimated=d.expenseEstimateForMonth(year,month);
        const resultEstimated=fatEstimated-totalCostEstimated;
        const topSupplier=Object.entries(d.fornecedoresYtd).sort((a,b)=>b[1]-a[1])[0]||['—',0];
        const metrics=sec.querySelectorAll('.metric');
        if(metrics[0]){
          setText(metrics[0].querySelector('small'),`Faturação estimada — ${monthName}`);
          const b=metrics[0].querySelector('b');
          setText(b,money(fatEstimated));
          if(b) b.className='money-positive';
          setText(metrics[0].querySelector('.delta'),`Objetivo do mês ${monthlyGoal?money(monthlyGoal):'—'} · Conclusão ${pctPlain(monthlyGoalProgress)}`);
          const chips=metrics[0].closest('.card')?.querySelector('.status-row');
          if(chips){
            chips.innerHTML=`<span class="status-chip">${resultEstimated>=0?'Resultado positivo':'Resultado negativo'}</span><span class="status-chip">${estimate.observedDays}/${estimate.daysInMonth} dias observados</span><span class="status-chip">${totalCostCur?'Custos registados':'Custos por lançar'}</span>`;
          }
        }
        if(metrics[1]){
          setText(metrics[1].querySelector('small'),`Faturação registada — ${monthName}`);
          setText(metrics[1].querySelector('b'),money(fatCur));
          setText(metrics[1].querySelector('.delta'),`Estimativa mensal ${money(fatEstimated)}`);
        }

        const alerts=findResumoAlertsList();
        if(alerts){
          const fatDelta=fatSamePrev ? ((fatCur-fatSamePrev)/fatSamePrev*100) : null;
          const supDelta=supPrev ? ((supCur-supPrev)/supPrev*100) : null;
          const fixDelta=fixPrev ? ((fixCur-fixPrev)/fixPrev*100) : null;
          const costWeight=fatCur ? (totalCostCur/fatCur*100) : null;
          const a1Class=fatDelta===null?'':(fatDelta>=0?'good':'bad');
          const a2Class=supDelta===null?'':(supDelta>15?'bad':(supDelta>5?'warn':'good'));
          const a3Class=costWeight===null?'':(costWeight>75?'bad':(costWeight>60?'warn':'good'));
          alerts.innerHTML=`
            <div class="alert ${a1Class}"><b>Faturação vs mesmo mês do ano anterior</b><span class="amount">${fatDelta===null?'—':pct(fatDelta)}</span><br>${fatSamePrev?`${monthName} ${year}: ${money(fatCur)} · ${monthName} ${sameYear}: ${money(fatSamePrev)}.`:'Ainda não há histórico comparável para este mês.'}</div>
            <div class="alert ${a2Class}"><b>Fornecedores do mês</b><span class="amount">${money(supCur)}</span><br>${supPrev?`${pct(supDelta)} face ao mês anterior. `:'Sem comparação com mês anterior. '}Maior fornecedor acumulado: <b>${topSupplier[0]}</b>.</div>
            <div class="alert ${a3Class}"><b>Peso dos custos registados</b><span class="amount">${pctPlain(costWeight)}</span><br>Custos do mês: ${money(totalCostCur)}. Despesas fixas: ${money(fixCur)}${fixPrev?` (${pct(fixDelta)} vs mês anterior).`:'.'}</div>`;
        }

        const table=sec.querySelector('table tbody');
        if(table){
          const supDelta=supPrev ? ((supCur-supPrev)/supPrev*100) : null;
          const costWeight=fatCur ? (totalCostCur/fatCur*100) : null;
          table.innerHTML=`
            <tr><td>Faturação</td><td class="money"><b class="money-positive">${money(fatCur)}</b></td><td class="money">${fatPrev?money(fatPrev):'—'}</td><td><span class="tag ${fatPrev && fatCur<fatPrev?'bad':'good'}">${fatPrev?pct((fatCur-fatPrev)/fatPrev*100):'Real'}</span></td></tr>
            <tr><td>Faturação estimada</td><td class="money"><b class="money-positive">${money(fatEstimated)}</b></td><td class="money">—</td><td><span class="tag ${estimate.observedDays>=10?'good':'warn'}">${estimate.observedDays} dias</span></td></tr>
            <tr><td>Fornecedores</td><td class="money"><b class="money-negative">${money(supCur)}</b></td><td class="money">${supPrev?money(supPrev):'—'}</td><td><span class="tag ${supDelta!==null&&supDelta>15?'warn':'good'}">${supDelta!==null?pct(supDelta):'Real'}</span></td></tr>
            <tr><td>Despesas Fixas</td><td class="money"><b class="money-negative">${money(fixCur)}</b></td><td class="money">${fixPrev?money(fixPrev):'—'}</td><td><span class="tag good">Real</span></td></tr>
            <tr><td>Custos totais</td><td class="money"><b class="money-negative">${money(totalCostCur)}</b></td><td class="money">${d.despesas[prevKey]?money(d.despesas[prevKey]):'—'}</td><td><span class="tag ${costWeight&&costWeight>75?'warn':'good'}">${pctPlain(costWeight)} da faturação</span></td></tr>`;
        }
        console.info('[V61.1] Resumo / Alertas ligado ao núcleo de métricas', {fatCur,fatEstimated,supCur,fixCur,totalCostCur});
        return;
      }
      const [fatHist,fatDia,forn,ords,fixas,invs]=await Promise.all([
        all('faturacao_historica'), all('faturacao_diaria'), all('fornecedores_historico'), all('ordenados'), all('despesas_fixas'), all('investimentos')
      ]);
      const now=new Date();
      const year=now.getFullYear();
      const month=now.getMonth();
      const prevMonth=month===0?11:month-1;
      const prevYear=month===0?year-1:year;
      const sameYear=year-1;
      const monthName=MESES[month];
      const fatHistMonth={}, fatDailyMonth={}, suppliersMonth={}, fixasMonth={}, ordsMonth={}, amortMonth={}, expensesMonth={}, suppliersYtd={};

      fatHist.forEach(r=>{
        const y=Number(val(r,['Ano','ano']));
        const m=mi(val(r,['Mês','mes','Mes']));
        const v=Number(val(r,['Valor','valor'])||0);
        if(y && m>=0) add(fatHistMonth,k(y,m),v);
      });
      fatDia.forEach(r=>{
        const ds=val(r,['Data','data']);
        const d=ds?new Date(String(ds)+'T00:00:00'):null;
        const y=Number(val(r,['Ano','ano']) || (d&&!isNaN(d)?d.getFullYear():0));
        const mRaw=val(r,['Mês','mes','Mes']);
        const m=(mRaw!==null && mRaw!==undefined) ? mi(mRaw) : (d&&!isNaN(d)?d.getMonth():-1);
        const v=Number(val(r,['Valor','valor'])||0);
        if(y && m>=0) add(fatDailyMonth,k(y,m),v);
      });
      forn.forEach(r=>{
        const y=Number(val(r,['Ano','ano']));
        const m=mi(val(r,['Mês','mes','Mes']));
        const v=Number(val(r,['Valor','valor'])||0);
        const name=String(val(r,['Fornecedor','fornecedor'])||'—');
        if(y && m>=0){
          add(suppliersMonth,k(y,m),v);
          add(expensesMonth,k(y,m),v);
          if(y===year && m<=month) add(suppliersYtd,name,v);
        }
      });
      ords.forEach(r=>{
        const y=Number(val(r,['Ano','ano']));
        const m=mi(val(r,['Mês','mes','Mes']));
        const v=Number(val(r,['Valor','valor'])||0);
        if(y && m>=0){ add(ordsMonth,k(y,m),v); add(expensesMonth,k(y,m),v); }
      });
      fixas.forEach(r=>{
        const tipo=val(r,['Tipo','tipo']);
        if(isTotal(tipo)) return;
        const y=Number(val(r,['Ano','ano']));
        const m=mi(val(r,['Mês','mes','Mes']));
        const v=Number(val(r,['Valor','valor'])||0);
        if(y && m>=0){ add(fixasMonth,k(y,m),v); add(expensesMonth,k(y,m),v); }
      });
      invs.forEach(r=>{
        const ds=val(r,['Data','data']);
        const d=ds?new Date(String(ds)+'T00:00:00'):null;
        if(!d || isNaN(d)) return;
        const total=Number(val(r,['Valor Total','valor_total','ValorTotal','valor'])||0);
        const months=Number(val(r,['Meses Amortização','meses_amortizacao','MesesAmortizacao'])||1)||1;
        const monthly=total/months;
        for(let i=0;i<months;i++){
          const x=new Date(d); x.setMonth(d.getMonth()+i);
          add(amortMonth,k(x.getFullYear(),x.getMonth()),monthly);
          add(expensesMonth,k(x.getFullYear(),x.getMonth()),monthly);
        }
      });

      const monthlyFat=MESES.map((_,i)=> fatDailyMonth[k(year,i)] || fatHistMonth[k(year,i)] || 0);
      renderResumoBars(monthlyFat);
      const estimate=computeRevenueEstimate(fatDia,now);

      const curKey=k(year,month), prevKey=k(prevYear,prevMonth), samePrevKey=k(sameYear,month);
      const fatMonthTotals={};
      [...new Set([...Object.keys(fatHistMonth),...Object.keys(fatDailyMonth)])].forEach(monthKey=>{
        fatMonthTotals[monthKey]=fatDailyMonth[monthKey] || fatHistMonth[monthKey] || 0;
      });
      const fatCur=estimate.observedTotal || monthlyFat[month] || 0;
      const fatEstimated=estimate.estimated || fatCur;
      let monthlyGoal=0;
      Object.entries(fatMonthTotals).forEach(([monthKey,total])=>{
        const [goalYear,goalMonth]=monthKey.split('-').map(Number);
        if(goalMonth===month+1 && goalYear!==year && total>monthlyGoal) monthlyGoal=total;
      });
      if(!monthlyGoal && fatMonthTotals[curKey]) monthlyGoal=fatMonthTotals[curKey];
      const monthlyGoalProgress=monthlyGoal ? Math.min(100,Math.max(0,(fatEstimated/monthlyGoal)*100)) : null;
      const fatPrev=monthlyFat[prevMonth]||0;
      const fatSamePrev=fatDailyMonth[samePrevKey] || fatHistMonth[samePrevKey] || 0;
      const supCur=suppliersMonth[curKey]||0;
      const supPrev=suppliersMonth[prevKey]||0;
      const fixCur=fixasMonth[curKey]||0;
      const fixPrev=fixasMonth[prevKey]||0;
      const totalCostCur=(expensesMonth[curKey]||0);
      const totalCostEstimated=(supCur || suppliersMonth[samePrevKey] || 0)+(fixCur || fixasMonth[samePrevKey] || 0)+(ordsMonth[curKey] || ordsMonth[samePrevKey] || 0)+(amortMonth[curKey] || amortMonth[samePrevKey] || 0);
      const resultEstimated=fatEstimated-totalCostEstimated;
      const marginEstimated=fatEstimated ? resultEstimated/fatEstimated*100 : null;
      const topSupplier=Object.entries(suppliersYtd).sort((a,b)=>b[1]-a[1])[0]||['—',0];
      const metrics=sec.querySelectorAll('.metric');
      if(metrics[0]){
        setText(metrics[0].querySelector('small'),`Faturação estimada — ${monthName}`);
        const b=metrics[0].querySelector('b');
        setText(b,money(fatEstimated));
        if(b) b.className='money-positive';
        setText(metrics[0].querySelector('.delta'),`Objetivo do mês ${monthlyGoal?money(monthlyGoal):'—'} · Conclusão ${pctPlain(monthlyGoalProgress)}`);
        const chips=metrics[0].closest('.card')?.querySelector('.status-row');
        if(chips){
          chips.innerHTML=`<span class="status-chip">${resultEstimated>=0?'Resultado positivo':'Resultado negativo'}</span><span class="status-chip">${estimate.observedDays}/${estimate.daysInMonth} dias observados</span><span class="status-chip">${totalCostCur?'Custos registados':'Custos por lançar'}</span>`;
        }
      }
      if(metrics[1]){
        setText(metrics[1].querySelector('small'),`Faturação registada — ${monthName}`);
        setText(metrics[1].querySelector('b'),money(fatCur));
        setText(metrics[1].querySelector('.delta'),`Estimativa mensal ${money(fatEstimated)}`);
      }

      const alerts=findResumoAlertsList();
      if(alerts){
        const fatDelta=fatSamePrev ? ((fatCur-fatSamePrev)/fatSamePrev*100) : null;
        const supDelta=supPrev ? ((supCur-supPrev)/supPrev*100) : null;
        const fixDelta=fixPrev ? ((fixCur-fixPrev)/fixPrev*100) : null;
        const costWeight=fatCur ? (totalCostCur/fatCur*100) : null;
        const a1Class=fatDelta===null?'':(fatDelta>=0?'good':'bad');
        const a2Class=supDelta===null?'':(supDelta>15?'bad':(supDelta>5?'warn':'good'));
        const a3Class=costWeight===null?'':(costWeight>75?'bad':(costWeight>60?'warn':'good'));
        alerts.innerHTML=`
          <div class="alert ${a1Class}"><b>Faturação vs mesmo mês do ano anterior</b><span class="amount">${fatDelta===null?'—':pct(fatDelta)}</span><br>${fatSamePrev?`${monthName} ${year}: ${money(fatCur)} · ${monthName} ${sameYear}: ${money(fatSamePrev)}.`:'Ainda não há histórico comparável para este mês.'}</div>
          <div class="alert ${a2Class}"><b>Fornecedores do mês</b><span class="amount">${money(supCur)}</span><br>${supPrev?`${pct(supDelta)} face ao mês anterior. `:'Sem comparação com mês anterior. '}Maior fornecedor acumulado: <b>${topSupplier[0]}</b>.</div>
          <div class="alert ${a3Class}"><b>Peso dos custos registados</b><span class="amount">${pctPlain(costWeight)}</span><br>Custos do mês: ${money(totalCostCur)}. Despesas fixas: ${money(fixCur)}${fixPrev?` (${pct(fixDelta)} vs mês anterior).`:'.'}</div>`;
      }

      const table=sec.querySelector('table tbody');
      if(table){
        table.innerHTML=`
          <tr><td>Faturação</td><td class="money"><b class="money-positive">${money(fatCur)}</b></td><td class="money">${fatPrev?money(fatPrev):'—'}</td><td><span class="tag ${fatPrev && fatCur<fatPrev?'bad':'good'}">${fatPrev?pct((fatCur-fatPrev)/fatPrev*100):'Real'}</span></td></tr>
          <tr><td>Faturação estimada</td><td class="money"><b class="money-positive">${money(fatEstimated)}</b></td><td class="money">—</td><td><span class="tag ${estimate.observedDays>=10?'good':'warn'}">${estimate.observedDays} dias</span></td></tr>
          <tr><td>Fornecedores</td><td class="money"><b class="money-negative">${money(supCur)}</b></td><td class="money">${supPrev?money(supPrev):'—'}</td><td><span class="tag ${supDelta!==null&&supDelta>15?'warn':'good'}">${supDelta!==null?pct(supDelta):'Real'}</span></td></tr>
          <tr><td>Despesas Fixas</td><td class="money"><b class="money-negative">${money(fixCur)}</b></td><td class="money">${fixPrev?money(fixPrev):'—'}</td><td><span class="tag good">Real</span></td></tr>
          <tr><td>Custos totais</td><td class="money"><b class="money-negative">${money(totalCostCur)}</b></td><td class="money">${expensesMonth[prevKey]?money(expensesMonth[prevKey]):'—'}</td><td><span class="tag ${costWeight&&costWeight>75?'warn':'good'}">${pctPlain(costWeight)} da faturação</span></td></tr>`;
      }
      console.info('[V61.1] Resumo / Alertas ligado a dados reais', {fatCur,fatEstimated,supCur,fixCur,totalCostCur});
    }catch(e){
      console.error('[V61.1] Erro ao atualizar Resumo / Alertas',e);
    }
  }
  window.loadResumoAlertasV611=loadResumoV611;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(loadResumoV611,2200));
  setTimeout(loadResumoV611,3600);
  setTimeout(loadResumoV611,6000);
})();

