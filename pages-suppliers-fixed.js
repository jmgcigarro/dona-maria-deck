// ============================== V47 — REPARAÇÃO FORNECEDORES + DESPESAS FIXAS + V48 INICIO/HISTORICO ==============================
(function(){
  const URL='https://hrlfwpwzciljwpgejmha.supabase.co';
  const KEY='sb_publishable_2VSqW87Rn7f4OwC1EXDSoQ_CInkq7mK';
  const supa = window.supabase ? window.supabase.createClient(URL, KEY) : null;
  const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const EUR=createEuroFormatter();
  const short=MESES.map(m=>m.slice(0,3));
  const norm=s=>String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const mi=m=>MESES.findIndex(x=>norm(x)===norm(m));
  const val=(r,names)=>{for(const n of names){if(r && r[n]!==undefined && r[n]!==null)return r[n]}return null};
  const add=(map,k,v)=>{map[k]=(map[k]||0)+(Number(v)||0)};
  const sum=o=>Object.values(o).reduce((a,b)=>a+(Number(b)||0),0);
  const pct=v=>Number.isFinite(v)?`${v.toFixed(1).replace('.',',')}%`:'—';
  const text=(id,t)=>{const e=document.getElementById(id); if(e)e.textContent=t};
  const isTotal=s=>['total','totais','subtotal','sub total'].includes(norm(s));
  const comparisonBadge=(c,p)=>{
    c=Number(c||0); p=Number(p||0);
    if(c<=0 || p<=0) return '<span class="tag">Sem dados suficientes</span>';
    const d=(c-p)/p*100;
    return `<span class="tag ${d>=0?'warn':'good'}">${d>=0?'+':''}${d.toFixed(1).replace('.',',')}%</span>`;
  };
  function renderBars(id, values, labels, mode='blue'){
    const el=document.getElementById(id); if(!el)return;
    el.innerHTML='';
    const max=Math.max(1,...values.map(v=>Number(v)||0));
    const h=chartBarHeights(el,230,34);
    values.forEach((v,i)=>{
      const b=document.createElement('div');
      b.className='bar '+(mode==='green'?'':mode);
      b.style.height=(h.min+(Number(v||0)/max)*h.max)+'px';
      b.title=`${labels[i]} · ${EUR.format((Number(v)||0)*1000)}`;
      b.innerHTML=`<span>${labels[i]}</span>`;
      el.appendChild(b);
    });
  }
  async function fetchRows(table){
    if(!supa) return {rows:[],error:'Supabase não carregou'};
    const {data,error}=await supa.from(table).select('*');
    if(error){console.error('Erro Supabase '+table,error); return {rows:[],error:error.message||String(error)}}
    return {rows:data||[],error:null};
  }
  function getYearAndMonth(rows){
    const now=new Date();
    const years=[...new Set(rows.map(r=>Number(val(r,['Ano','ano']))).filter(Boolean))].sort((a,b)=>a-b);
    const y=years.includes(now.getFullYear())?now.getFullYear():(years.at(-1)||now.getFullYear());
    const m=y===now.getFullYear()?now.getMonth():11;
    return {year:y,prev:y-1,monthLimit:m,monthName:MESES[m]};
  }
  function fixedMissingAlert(rows,tipo,ctx){
    const entries=(rows||[])
      .map(r=>({
        year:Number(val(r,['Ano','ano'])),
        month:mi(val(r,['Mês','mes'])),
        type:String(val(r,['Tipo','tipo'])||'').trim()
      }))
      .filter(r=>r.type===tipo && r.month>=0 && r.year);
    const currentYearMonths=entries
      .filter(r=>r.year===ctx.year && r.month<=ctx.monthLimit)
      .map(r=>r.month);
    const lastCurrentMonth=currentYearMonths.length ? Math.max(...currentYearMonths) : null;
    if(lastCurrentMonth!==null){
      if(lastCurrentMonth>=ctx.monthLimit){
        return `<div class="alert good"><b>Registo em dia</b><br>${tipo} tem registo até ${ctx.monthName}.</div>`;
      }
      const missingMonths=ctx.monthLimit-lastCurrentMonth;
      return `<div class="alert ${missingMonths>1?'bad':'warn'}"><b>Registos em falta</b><br>${tipo} não tem registos desde ${MESES[lastCurrentMonth]}.</div>`;
    }
    const last=entries.sort((a,b)=>(b.year-a.year)||(b.month-a.month))[0];
    if(last){
      return `<div class="alert bad"><b>Registos em falta</b><br>${tipo} não tem registos em ${ctx.year}. Último registo: ${MESES[last.month]} ${last.year}.</div>`;
    }
    return `<div class="alert bad"><b>Registos em falta</b><br>${tipo} ainda não tem registos lançados.</div>`;
  }
  let SUPPLIERS=[];
  async function loadSuppliersV47(){
    const {rows,error}=await fetchRows('fornecedores_historico');
    SUPPLIERS=rows;
    const select=document.getElementById('supplierSelect');
    if(select){
      const names=[...new Set(rows.map(r=>String(val(r,['Fornecedor','fornecedor'])||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt'));
      const previous=select.value;
      select.innerHTML='<option value="__all">Todos os fornecedores</option>'+names.map(n=>`<option>${n}</option>`).join('');
      if(names.includes(previous))select.value=previous;
    }
    if(error){
      const el=document.getElementById('supplierInsights');
      if(el)el.innerHTML=`<div class="alert bad"><b>Erro ao carregar fornecedores</b><br>${error}</div>`;
      return;
    }
    renderSuppliersV47();
  }
  function renderSuppliersV47(){
    const select=document.getElementById('supplierSelect');
    const chosen=select ? select.value : '__all';
    const rows=SUPPLIERS||[];
    const ctx=getYearAndMonth(rows);
    const cur={}, prevYtd={}, prevFull={}, monthly=Array(12).fill(0);
    rows.forEach(r=>{
      const y=Number(val(r,['Ano','ano']));
      const m=mi(val(r,['Mês','mes']));
      const f=String(val(r,['Fornecedor','fornecedor'])||'—').trim();
      const v=Number(val(r,['Valor','valor'])||0);
      if(!f || m<0) return;
      if(y===ctx.year && m<=ctx.monthLimit){add(cur,f,v)}
      if(y===ctx.prev && m<=ctx.monthLimit){add(prevYtd,f,v)}
      if(y===ctx.prev){add(prevFull,f,v)}
      if(y===ctx.year && (chosen==='__all'||chosen===f)){monthly[m]+=v}
    });
    const ranking=Object.entries(cur).sort((a,b)=>b[1]-a[1]);
    const total=sum(cur), prevTotal=sum(prevYtd), top=ranking[0]||['—',0];
    const currentVal=chosen==='__all'?total:(cur[chosen]||0);
    const previousVal=chosen==='__all'?prevTotal:(prevYtd[chosen]||0);
    text('fornTotalTitle',`Total fornecedores ${ctx.year} até ${ctx.monthName}`);
    text('fornTotalAno',EUR.format(currentVal));
    text('fornTotalDelta',previousVal?`${pct((currentVal-previousVal)/previousVal*100)} vs ${ctx.prev} até ${ctx.monthName}`:'Sem dados suficientes');
    text('fornMaiorNome',top[0]);
    text('fornMaiorPeso',total?`${pct(top[1]/total*100)} do total até ${ctx.monthName}`:'—');
    text('fornAtivos',String(ranking.length));
    text('fornAlertaNome',top[0]);
    text('fornAlertaTexto',total?`${pct(top[1]/total*100)} do custo de fornecedores`:'—');
    text('supplierCompareNote',`Comparação justa: ${ctx.year} até ${ctx.monthName} vs ${ctx.prev} até ${ctx.monthName}. A primeira coluna mantém o total completo de ${ctx.prev}.`);
    text('supplierChartTitle',chosen==='__all'?`Evolução mensal — fornecedores ${ctx.year}`:`Despesas mensais — ${chosen}`);
    text('supplierInsightTitle',chosen==='__all'?'Leitura global':`Ficha individual — ${chosen}`);
    renderBars('chartSupplier',monthly.map(v=>v/1000),short,'blue');
    const insights=document.getElementById('supplierInsights');
    if(insights){
      if(chosen==='__all') insights.innerHTML=`<div class="alert good">Foram encontrados ${ranking.length} fornecedores ativos em ${ctx.year} até ${ctx.monthName}.</div><div class="alert">Maior fornecedor: <b>${top[0]}</b>, com ${EUR.format(top[1])}.</div><div class="alert ${previousVal&&currentVal>previousVal*1.15?'bad':'good'}">Comparativo YTD: ${EUR.format(currentVal)} em ${ctx.year} vs ${previousVal?EUR.format(previousVal):'sem dados suficientes'} em ${ctx.prev}.</div>`;
      else insights.innerHTML=`<div class="alert good">Total ${ctx.year} até ${ctx.monthName}: <b>${EUR.format(currentVal)}</b>.</div><div class="alert">Comparativo ${ctx.prev} até ${ctx.monthName}: ${previousVal?EUR.format(previousVal):'sem dados suficientes'}.</div><div class="alert">Total completo ${ctx.prev}: ${prevFull[chosen]?EUR.format(prevFull[chosen]):'—'}.</div>`;
    }
    const table=document.getElementById('supplierTable');
    if(table){
      if(chosen==='__all'){
        table.innerHTML=ranking.map(([f,v])=>`<tr><td>${f}</td><td class="money">${prevFull[f]?EUR.format(prevFull[f]):'<span class="empty">—</span>'}</td><td class="money">${prevYtd[f]?EUR.format(prevYtd[f]):'<span class="empty">—</span>'}</td><td class="money"><b>${EUR.format(v)}</b></td><td class="money">${total?pct(v/total*100):'—'}</td><td>${comparisonBadge(v,prevYtd[f]).replace('Sem dados suficientes','Sem dados')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Sem dados de fornecedores.</td></tr>';
      } else {
        table.innerHTML=`<tr><td>${chosen}</td><td class="money">${prevFull[chosen]?EUR.format(prevFull[chosen]):'<span class="empty">—</span>'}</td><td class="money">${prevYtd[chosen]?EUR.format(prevYtd[chosen]):'<span class="empty">—</span>'}</td><td class="money"><b>${EUR.format(currentVal)}</b></td><td class="money">${total?pct(currentVal/total*100):'—'}</td><td>${comparisonBadge(currentVal,prevYtd[chosen]).replace('Sem dados suficientes','Sem dados')}</td></tr>`;
      }
    }
  }
  let FIXAS=[];
  async function loadFixasV47(){
    const {rows,error}=await fetchRows('despesas_fixas');
    FIXAS=(rows||[]).filter(r=>!isTotal(val(r,['Tipo','tipo'])));
    const select=document.getElementById('fixedExpenseSelect');
    if(select){
      const names=[...new Set(FIXAS.map(r=>String(val(r,['Tipo','tipo'])||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt'));
      const previous=select.value;
      select.innerHTML='<option value="__all">Todas as Despesas</option>'+names.map(n=>`<option>${n}</option>`).join('');
      if(names.includes(previous))select.value=previous;
    }
    if(error){
      const el=document.getElementById('fixasInsights');
      if(el)el.innerHTML=`<div class="alert bad"><b>Erro ao carregar despesas fixas</b><br>${error}</div>`;
      return;
    }
    renderFixasV47();
  }
  function renderFixasV47(){
    const select=document.getElementById('fixedExpenseSelect');
    const chosen=select ? select.value : '__all';
    const rows=FIXAS||[];
    const ctx=getYearAndMonth(rows);
    const cur={}, prevYtd={}, prevFull={}, monthly=Array(12).fill(0);
    rows.forEach(r=>{
      const y=Number(val(r,['Ano','ano'])); const m=mi(val(r,['Mês','mes'])); const t=String(val(r,['Tipo','tipo'])||'—').trim(); const v=Number(val(r,['Valor','valor'])||0);
      if(!t || m<0 || isTotal(t))return;
      if(y===ctx.year && m<=ctx.monthLimit){add(cur,t,v)}
      if(y===ctx.prev && m<=ctx.monthLimit){add(prevYtd,t,v)}
      if(y===ctx.prev){add(prevFull,t,v)}
      if(y===ctx.year && (chosen==='__all'||chosen===t)){monthly[m]+=v}
    });
    const ranking=Object.entries(cur).sort((a,b)=>b[1]-a[1]);
    const total=sum(cur), prevTotal=sum(prevYtd), top=ranking[0]||['—',0];
    const currentVal=chosen==='__all'?total:(cur[chosen]||0);
    const previousVal=chosen==='__all'?prevTotal:(prevYtd[chosen]||0);
    text('fixasTotalTitle',`Total despesas fixas ${ctx.year} até ${ctx.monthName}`);
    text('fixasTotalAno',formatEuroAmount(currentVal));
    text('fixasTotalDelta',previousVal?`${pct((currentVal-previousVal)/previousVal*100)} vs ${ctx.prev} até ${ctx.monthName}`:'Sem dados suficientes');
    text('fixasMaiorTipo',top[0]);
    text('fixasMaiorPeso',total?`${pct(top[1]/total*100)} do total até ${ctx.monthName}`:'—');
    text('fixasMediaMensal',formatEuroAmount(currentVal/(ctx.monthLimit+1)));
    text('fixasTiposAtivos',String(ranking.length));
    text('fixasCompareNote',`Comparação justa: ${ctx.year} até ${ctx.monthName} vs ${ctx.prev} até ${ctx.monthName}. A primeira coluna mantém o total completo de ${ctx.prev}.`);
    text('fixasChartTitle',chosen==='__all'?`Evolução mensal — despesas fixas ${ctx.year}`:`Evolução mensal — ${chosen}`);
    text('fixasInsightTitle',chosen==='__all'?'Leitura rápida':`Ficha individual — ${chosen}`);
    renderBars('chartFixas',monthly.map(v=>v/1000),short,'blue');
    const insights=document.getElementById('fixasInsights');
    if(insights){
      if(chosen==='__all') insights.innerHTML=`<div class="alert good">Total de despesas fixas em ${ctx.year} até ${ctx.monthName}: <b>${formatEuroAmount(total)}</b>.</div><div class="alert">Maior despesa fixa: <b>${top[0]}</b>, com ${formatEuroAmount(top[1])}.</div><div class="alert">A categoria Total foi excluída automaticamente da análise.</div>`;
      else insights.innerHTML=`<div class="alert good">Total ${ctx.year} até ${ctx.monthName}: <b>${formatEuroAmount(currentVal)}</b>.</div><div class="alert">Comparativo ${ctx.prev} até ${ctx.monthName}: ${previousVal?formatEuroAmount(previousVal):'sem dados suficientes'}.</div><div class="alert">Total completo ${ctx.prev}: ${prevFull[chosen]?formatEuroAmount(prevFull[chosen]):'—'}.</div>${fixedMissingAlert(rows,chosen,ctx)}`;
    }
    const table=document.getElementById('fixasTable');
    if(table){
      if(chosen==='__all'){
        table.innerHTML=ranking.map(([t,v])=>`<tr><td>${t}</td><td class="money">${prevFull[t]?formatEuroAmount(prevFull[t]):'<span class="empty">—</span>'}</td><td class="money">${prevYtd[t]?formatEuroAmount(prevYtd[t]):'<span class="empty">—</span>'}</td><td class="money"><b>${formatEuroAmount(v)}</b></td><td class="money">${total?pct(v/total*100):'—'}</td><td>${comparisonBadge(v,prevYtd[t])}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Sem despesas fixas registadas.</td></tr>';
      } else {
        table.innerHTML=`<tr><td>${chosen}</td><td class="money">${prevFull[chosen]?formatEuroAmount(prevFull[chosen]):'<span class="empty">—</span>'}</td><td class="money">${prevYtd[chosen]?formatEuroAmount(prevYtd[chosen]):'<span class="empty">—</span>'}</td><td class="money"><b>${formatEuroAmount(currentVal)}</b></td><td class="money">${total?pct(currentVal/total*100):'—'}</td><td>${comparisonBadge(currentVal,prevYtd[chosen])}</td></tr>`;
      }
    }
  }
  window.changeSupplier=renderSuppliersV47;
  window.changeFixedExpense=renderFixasV47;
  window.loadFornecedoresReais=loadSuppliersV47;
  window.loadDespesasFixasConsulta=loadFixasV47;
  setTimeout(()=>{loadSuppliersV47(); loadFixasV47();},600);
})();

