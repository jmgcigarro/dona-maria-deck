// ============================== V62 — Assistente IA com dados reais ==============================
(function(){
  const URL='https://hrlfwpwzciljwpgejmha.supabase.co';
  const KEY='sb_publishable_2VSqW87Rn7f4OwC1EXDSoQ_CInkq7mK';
  const aiDb=(typeof db!=='undefined' && db) ? db : (window.supabase ? window.supabase.createClient(URL,KEY) : null);
  const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const EUR=createEuroFormatter();
  const norm=s=>String(s??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const get=(r,names)=>{for(const n of names){if(r && Object.prototype.hasOwnProperty.call(r,n))return r[n];}return null;};
  const add=(m,k,v)=>{m[k]=(m[k]||0)+(Number(v)||0)};
  const sum=a=>a.reduce((x,y)=>x+(Number(y)||0),0);
  const monthIndex=m=>MESES.findIndex(x=>norm(x)===norm(m)||norm(x).slice(0,3)===norm(m).slice(0,3));
  const monthKey=(y,m)=>`${y}-${String(m+1).padStart(2,'0')}`;
  const pct=v=>Number.isFinite(v)?`${v.toFixed(1).replace('.',',')}%`:'—';
  const isTotal=s=>['total','totais','subtotal','sub total'].includes(norm(s));
  let aiCache=null;

  function addMsg(kind,html){
    const win=document.getElementById('chatWindow');
    if(!win)return;
    win.insertAdjacentHTML('beforeend',`<div class="msg ${kind}">${html}</div>`);
    win.scrollTop=win.scrollHeight;
  }
  async function table(name){
    if(!aiDb) throw new Error('Supabase não carregou.');
    const {data,error}=await aiDb.from(name).select('*');
    if(error) throw error;
    return data||[];
  }
  function invMonths(r){
    const ds=get(r,['Data','data']);
    const d=ds?new Date(String(ds)+'T00:00:00'):null;
    if(!d||isNaN(d))return [];
    const total=Number(get(r,['Valor Total','valor_total','ValorTotal','valor'])||0);
    const meses=Number(get(r,['Meses Amortização','meses_amortizacao','MesesAmortizacao'])||1)||1;
    const mensal=total/meses;
    return Array.from({length:meses},(_,i)=>{const x=new Date(d);x.setMonth(d.getMonth()+i);return {ano:x.getFullYear(),mes:x.getMonth(),valor:mensal};});
  }
  async function computeAI(force=false){
    if(aiCache && !force)return aiCache;
    if(typeof window.getRestaurantMetrics==='function'){
      const d=await window.getRestaurantMetrics(force,new Date());
      aiCache={
        currentYear:d.currentYear,
        currentMonth:d.currentMonth,
        currentMonthName:d.currentMonthName,
        monthly:d.monthly,
        fatAtual:d.estimate.observedTotal,
        diasObs:d.estimate.observedDays,
        diasMes:d.estimate.daysInMonth,
        mediaDia:d.estimate.dailyAverage,
        fatEstimada:d.estimate.estimated,
        fornecedoresYtd:d.fornecedoresYtd,
        fixasYtd:d.fixasYtd,
        buckets:d.buckets,
        faturacao:d.faturacao,
        despesas:d.despesas,
        fornecedoresAll:d.fornecedoresAll,
        fixasAll:d.fixasAll,
        ordenadosAll:d.ordenadosAll,
        investimentosAll:d.investimentosAll,
        fatHist:d.fatHist,
        fatDia:d.fatDia,
        forn:d.forn,
        ord:d.ord,
        fix:d.fix,
        inv:d.inv
      };
      return aiCache;
    }
    const source=window.loadRestaurantData ? await window.loadRestaurantData(force) : null;
    const [fatHist,fatDia,forn,ord,fix,inv]=source ? [
      source.faturacao_historica,source.faturacao_diaria,source.fornecedores_historico,source.ordenados,source.despesas_fixas,source.investimentos
    ] : await Promise.all([
      table('faturacao_historica'), table('faturacao_diaria'), table('fornecedores_historico'), table('ordenados'), table('despesas_fixas'), table('investimentos')
    ]);
    const now=new Date();
    const currentYear=now.getFullYear();
    const currentMonth=now.getMonth();
    const faturacao={}, faturacaoHist={}, faturacaoDia={}, despesas={}, buckets={Fornecedores:{},Ordenados:{},'Despesas Fixas':{},Amortizações:{}};
    fatHist.forEach(r=>{const y=Number(get(r,['Ano','ano']));const m=monthIndex(get(r,['Mês','mes']));const v=Number(get(r,['Valor','valor'])||0);if(y&&m>=0){add(faturacaoHist,monthKey(y,m),v);add(faturacao,monthKey(y,m),v);}});
    fatDia.forEach(r=>{const ds=get(r,['Data','data']);const d=ds?new Date(String(ds)+'T00:00:00'):null;const y=Number(get(r,['Ano','ano'])||(d&&!isNaN(d)?d.getFullYear():0));const m=(get(r,['Mês','mes'])!==null&&get(r,['Mês','mes'])!==undefined)?monthIndex(get(r,['Mês','mes'])):(d&&!isNaN(d)?d.getMonth():-1);const v=Number(get(r,['Valor','valor'])||0);if(y&&m>=0){add(faturacaoDia,monthKey(y,m),v);}});
    Object.keys(faturacaoDia).forEach(k=>{faturacao[k]=faturacaoDia[k];});
    function addExp(rows,bucket,typeCol){
      rows.forEach(r=>{if(typeCol && isTotal(get(r,[typeCol,typeCol.toLowerCase()])))return; const y=Number(get(r,['Ano','ano']));const m=monthIndex(get(r,['Mês','mes']));const v=Number(get(r,['Valor','valor'])||0);if(y&&m>=0){const k=monthKey(y,m);add(despesas,k,v);add(buckets[bucket],k,v);}});
    }
    addExp(forn,'Fornecedores','Fornecedor'); addExp(ord,'Ordenados','Funcionário'); addExp(fix,'Despesas Fixas','Tipo');
    inv.forEach(r=>invMonths(r).forEach(x=>{const k=monthKey(x.ano,x.mes);add(despesas,k,x.valor);add(buckets.Amortizações,k,x.valor);}));
    const fornecedoresAll={}, fixasAll={}, ordenadosAll={}, investimentosAll={};
    forn.forEach(r=>{const y=Number(get(r,['Ano','ano']));const m=monthIndex(get(r,['Mês','mes']));const nome=String(get(r,['Fornecedor','fornecedor'])||'—');const v=Number(get(r,['Valor','valor'])||0);if(y&&m>=0)add(fornecedoresAll[monthKey(y,m)]||(fornecedoresAll[monthKey(y,m)]={}),nome,v);});
    fix.forEach(r=>{const y=Number(get(r,['Ano','ano']));const m=monthIndex(get(r,['Mês','mes']));const tipo=String(get(r,['Tipo','tipo'])||'—');const v=Number(get(r,['Valor','valor'])||0);if(!isTotal(tipo)&&y&&m>=0)add(fixasAll[monthKey(y,m)]||(fixasAll[monthKey(y,m)]={}),tipo,v);});
    ord.forEach(r=>{const y=Number(get(r,['Ano','ano']));const m=monthIndex(get(r,['Mês','mes']));const nome=String(get(r,['Funcionário','Funcionário/a','Funcionario','funcionario'])||'—');const v=Number(get(r,['Valor','valor'])||0);if(y&&m>=0)add(ordenadosAll[monthKey(y,m)]||(ordenadosAll[monthKey(y,m)]={}),nome,v);});
    inv.forEach(r=>{const ds=get(r,['Data','data']);const date=ds?new Date(String(ds)+'T00:00:00'):null;const y=date&&!isNaN(date)?date.getFullYear():Number(get(r,['Ano','ano']));const m=date&&!isNaN(date)?date.getMonth():monthIndex(get(r,['Mês','mes']));const nome=String(get(r,['Descrição','Descricao','descricao'])||'Investimento');const v=Number(get(r,['Valor Total','valor_total','ValorTotal','valor'])||0);if(y&&m>=0)add(investimentosAll[monthKey(y,m)]||(investimentosAll[monthKey(y,m)]={}),nome,v);});
    const monthly=MESES.map((m,i)=>{const k=monthKey(currentYear,i);const fat=faturacao[k]||0;const desp=despesas[k]||0;const lucro=fat-desp;return {ano:currentYear,mes:m,mi:i,fat,desp,lucro,margem:fat?lucro/fat*100:null};});
    const estimate=computeRevenueEstimate(fatDia,now);
    const fatAtual=estimate.observedTotal;
    const diasObs=estimate.observedDays;
    const diasMes=estimate.daysInMonth;
    const mediaDia=estimate.dailyAverage;
    const fatEstimada=estimate.estimated;
    const fornecedoresYtd={};
    forn.forEach(r=>{const y=Number(get(r,['Ano','ano']));const m=monthIndex(get(r,['Mês','mes']));if(y===currentYear&&m>=0&&m<=currentMonth){add(fornecedoresYtd,String(get(r,['Fornecedor','fornecedor'])||'—'),Number(get(r,['Valor','valor'])||0));}});
    const fixasYtd={};
    fix.forEach(r=>{const tipo=String(get(r,['Tipo','tipo'])||'—');const y=Number(get(r,['Ano','ano']));const m=monthIndex(get(r,['Mês','mes']));if(!isTotal(tipo)&&y===currentYear&&m>=0&&m<=currentMonth){add(fixasYtd,tipo,Number(get(r,['Valor','valor'])||0));}});
    aiCache={currentYear,currentMonth,currentMonthName:MESES[currentMonth],monthly,fatAtual,diasObs,diasMes,mediaDia,fatEstimada,fornecedoresYtd,fixasYtd,buckets,faturacao,despesas,fornecedoresAll,fixasAll,ordenadosAll,investimentosAll,fatHist,fatDia,forn,ord,fix,inv};
    return aiCache;
  }
  function rankObj(obj){return Object.entries(obj).sort((a,b)=>b[1]-a[1]);}
  function extractPeriod(q,d){
    const nq=norm(q);
    let year=null;
    const yearMatch=nq.match(/\b(20\d{2}|19\d{2})\b/);
    if(yearMatch) year=Number(yearMatch[1]);
    else if(nq.includes('ano passado')) year=d.currentYear-1;
    else if(nq.includes('este ano')||nq.includes('ano atual')||nq.includes('actual')) year=d.currentYear;
    let month=null;
    MESES.forEach((m,i)=>{
      const nm=norm(m);
      if(nq.includes(nm) || nq.includes(nm.slice(0,3))) month=i;
    });
    if(nq.includes('este mes')||nq.includes('este mês')||nq.includes('mes atual')||nq.includes('mês atual')) month=d.currentMonth;
    if(nq.includes('mes passado')||nq.includes('mês passado')){month=d.currentMonth-1; year=year||d.currentYear; if(month<0){month=11;year--;}}
    return {year,month,hasYear:year!==null,hasMonth:month!==null};
  }
  function periodLabel(period,d){
    if(period.hasMonth&&period.hasYear)return `${MESES[period.month]} de ${period.year}`;
    if(period.hasYear)return `o ano de ${period.year}`;
    if(period.hasMonth)return `${MESES[period.month]} de ${d.currentYear}`;
    return `até ${d.currentMonthName} de ${d.currentYear}`;
  }
  function sumMapForPeriod(map,period,d){
    const year=period.hasYear?period.year:d.currentYear;
    if(period.hasMonth)return map[monthKey(year,period.month)]||0;
    const limit=year===d.currentYear?d.currentMonth:11;
    let total=0;
    for(let i=0;i<=limit;i++) total+=map[monthKey(year,i)]||0;
    return total;
  }
  function rankNestedForPeriod(nested,period,d){
    const year=period.hasYear?period.year:d.currentYear;
    const result={};
    const addObj=obj=>Object.entries(obj||{}).forEach(([k,v])=>add(result,k,v));
    if(period.hasMonth)addObj(nested[monthKey(year,period.month)]);
    else{
      const limit=year===d.currentYear?d.currentMonth:11;
      for(let i=0;i<=limit;i++) addObj(nested[monthKey(year,i)]);
    }
    return rankObj(result);
  }
  function findSupplierQuestion(q,d){
    const nq=norm(q);
    const names=[...new Set([...(Object.keys(d.fornecedoresYtd||{})),...Object.values(d.fornecedoresAll||{}).flatMap(obj=>Object.keys(obj||{}))])].sort((a,b)=>b.length-a.length);
    return names.find(n=>nq.includes(norm(n)));
  }
  function nestedNames(nested){
    return [...new Set(Object.values(nested||{}).flatMap(obj=>Object.keys(obj||{})))].sort((a,b)=>b.length-a.length);
  }
  function findNestedName(q,nested){
    const nq=norm(q);
    return nestedNames(nested).find(name=>name && name!=='—' && nq.includes(norm(name)));
  }
  function yearsInQuestion(q){
    return [...new Set((norm(q).match(/\b(20\d{2}|19\d{2})\b/g)||[]).map(Number))];
  }
  function periodWithYear(period,year){
    return {...period,year,hasYear:true};
  }
  function topLines(ranking,total,limit=6){
    return ranking.slice(0,limit).map(([n,v],i)=>`${i+1}. <b>${n}</b>: ${EUR.format(v)} ${total?`(${pct(v/total*100)})`:''}`).join('<br>');
  }
  function answerFromData(q,d){
    const nq=norm(q);
    const period=extractPeriod(q,d);
    const label=periodLabel(period,d);
    const years=yearsInQuestion(q);
    const monthsUntil=d.monthly.slice(0,d.currentMonth+1);
    const fatYtd=sum(monthsUntil.map(x=>x.fat));
    const despYtd=sum(monthsUntil.map(x=>x.desp));
    const lucroYtd=fatYtd-despYtd;
    const margemYtd=fatYtd?lucroYtd/fatYtd*100:null;
    const best=monthsUntil.reduce((a,b)=>b.fat>a.fat?b:a,monthsUntil[0]||{mes:'—',fat:0});
    const supplier=findSupplierQuestion(q,d);
    const fixedType=findNestedName(q,d.fixasAll);
    const employee=findNestedName(q,d.ordenadosAll);
    const investment=findNestedName(q,d.investimentosAll);

    if((nq.includes('compara') || nq.includes('comparar') || nq.includes(' vs ') || nq.includes(' versus ')) && years.length>=2){
      const p1=periodWithYear(period,years[0]);
      const p2=periodWithYear(period,years[1]);
      const fat1=sumMapForPeriod(d.faturacao,p1,d), fat2=sumMapForPeriod(d.faturacao,p2,d);
      const desp1=sumMapForPeriod(d.despesas,p1,d), desp2=sumMapForPeriod(d.despesas,p2,d);
      const res1=fat1-desp1, res2=fat2-desp2;
      const diff=fat1-fat2;
      return `<b>Comparação — ${period.hasMonth?MESES[period.month]+' ':''}${years[0]} vs ${years[1]}</b><br>Faturação ${years[0]}: <b>${EUR.format(fat1)}</b>.<br>Faturação ${years[1]}: <b>${EUR.format(fat2)}</b>.<br>Diferença: <b>${EUR.format(diff)}</b>${fat2?` (${pct(diff/fat2*100)})`:''}.<br><br>Resultado ${years[0]}: <b>${EUR.format(res1)}</b>. Resultado ${years[1]}: <b>${EUR.format(res2)}</b>.`;
    }

    if((nq.includes('faturacao') || nq.includes('facturacao') || nq.includes('vendas') || nq.includes('venda')) && !nq.includes('estimad') && !nq.includes('previs')){
      const fat=sumMapForPeriod(d.faturacao,period,d);
      const desp=sumMapForPeriod(d.despesas,period,d);
      const res=fat-desp;
      const margem=fat?res/fat*100:null;
      const extra=desp?`<br>Despesas no mesmo período: <b>${EUR.format(desp)}</b>. Resultado: <b>${EUR.format(res)}</b>. Margem: <b>${pct(margem)}</b>.`:'';
      return `<b>Faturação — ${label}</b><br>A faturação registada foi <b>${EUR.format(fat)}</b>.${extra}${fat?'':'<br>Não encontrei faturação registada para esse período.'}`;
    }
    if(nq.includes('melhor') && (nq.includes('mes')||nq.includes('mês'))){
      const year=period.hasYear?period.year:d.currentYear;
      const limit=year===d.currentYear?d.currentMonth:11;
      const months=MESES.slice(0,limit+1).map((m,i)=>({mes:m,fat:d.faturacao[monthKey(year,i)]||0}));
      const bestPeriod=months.reduce((a,b)=>b.fat>a.fat?b:a,months[0]||{mes:'—',fat:0});
      return `<b>Melhor mês de ${year}</b><br>O melhor mês é <b>${bestPeriod.mes}</b>, com <b>${EUR.format(bestPeriod.fat)}</b> de faturação.`;
    }
    if(supplier){
      const ranking=rankNestedForPeriod(d.fornecedoresAll,period,d);
      const row=ranking.find(([name])=>norm(name)===norm(supplier));
      const total=row?row[1]:0;
      const totalSup=sum(ranking.map(x=>x[1]));
      return `<b>${supplier} — ${label}</b><br>Gastaste <b>${EUR.format(total)}</b> neste fornecedor.${totalSup?` Isso representa <b>${pct(total/totalSup*100)}</b> do total de fornecedores do período.`:''}`;
    }
    if(employee){
      const ranking=rankNestedForPeriod(d.ordenadosAll,period,d);
      const row=ranking.find(([name])=>norm(name)===norm(employee));
      const total=row?row[1]:0;
      const totalOrd=sum(ranking.map(x=>x[1]));
      return `<b>${employee} — ${label}</b><br>O total registado em ordenados/encargos foi <b>${EUR.format(total)}</b>.${totalOrd?` Peso no total de ordenados do período: <b>${pct(total/totalOrd*100)}</b>.`:''}`;
    }
    if(fixedType){
      const ranking=rankNestedForPeriod(d.fixasAll,period,d);
      const row=ranking.find(([name])=>norm(name)===norm(fixedType));
      const total=row?row[1]:0;
      const totalFix=sum(ranking.map(x=>x[1]));
      return `<b>${fixedType} — ${label}</b><br>O total registado nesta despesa fixa foi <b>${EUR.format(total)}</b>.${totalFix?` Peso nas despesas fixas do período: <b>${pct(total/totalFix*100)}</b>.`:''}`;
    }
    if(investment){
      const ranking=rankNestedForPeriod(d.investimentosAll,period,d);
      const row=ranking.find(([name])=>norm(name)===norm(investment));
      return `<b>${investment} — ${label}</b><br>Investimento registado: <b>${EUR.format(row?row[1]:0)}</b>.`;
    }
    if(nq.includes('fornecedor')){
      const ranking=rankNestedForPeriod(d.fornecedoresAll,period,d);
      const total=sum(ranking.map(x=>x[1]));
      const linhas=topLines(ranking,total,5);
      return `<b>Top fornecedores — ${label}</b><br>${linhas||'Ainda não existem dados de fornecedores para este período.'}`;
    }
    if(nq.includes('ordenado') || nq.includes('funcionario') || nq.includes('funcionário') || nq.includes('pessoal')){
      const ranking=rankNestedForPeriod(d.ordenadosAll,period,d);
      const total=sum(ranking.map(x=>x[1]));
      return `<b>Ordenados — ${label}</b><br>Total: <b>${EUR.format(total)}</b>.<br>${topLines(ranking,total)||'Ainda não existem ordenados registados para este período.'}`;
    }
    if(nq.includes('despesa fixa') || nq.includes('fixas') || nq.includes('renda') || nq.includes('energia') || nq.includes('agua') || nq.includes('água') || nq.includes('gas') || nq.includes('gás')){
      const ranking=rankNestedForPeriod(d.fixasAll,period,d);
      const total=sum(ranking.map(x=>x[1]));
      return `<b>Despesas fixas — ${label}</b><br>Total: <b>${EUR.format(total)}</b>.<br>${topLines(ranking,total)||'Ainda não existem despesas fixas registadas para este período.'}`;
    }
    if(nq.includes('amortizacao') || nq.includes('amortização') || nq.includes('amortizacoes') || nq.includes('amortizações')){
      const total=sumMapForPeriod(d.buckets.Amortizações,period,d);
      const invRank=rankNestedForPeriod(d.investimentosAll,period,d);
      return `<b>Amortizações — ${label}</b><br>Total amortizado no período: <b>${EUR.format(total)}</b>.<br>${invRank.length?`Investimentos registados no período:<br>${topLines(invRank,sum(invRank.map(x=>x[1])),5)}`:'Não encontrei investimentos registados diretamente neste período.'}`;
    }
    if(nq.includes('investimento') || nq.includes('investimentos')){
      const ranking=rankNestedForPeriod(d.investimentosAll,period,d);
      const total=sum(ranking.map(x=>x[1]));
      return `<b>Investimentos — ${label}</b><br>Total registado: <b>${EUR.format(total)}</b>.<br>${topLines(ranking,total)||'Ainda não existem investimentos registados para este período.'}`;
    }
    if(nq.includes('margem') || nq.includes('lucro') || nq.includes('resultado')){
      const fat=period.hasYear||period.hasMonth?sumMapForPeriod(d.faturacao,period,d):fatYtd;
      const desp=period.hasYear||period.hasMonth?sumMapForPeriod(d.despesas,period,d):despYtd;
      const lucro=fat-desp;
      const margem=fat?lucro/fat*100:null;
      return `<b>Resultado — ${period.hasYear||period.hasMonth?label:'acumulado'}</b><br>Faturação: <b>${EUR.format(fat)}</b>.<br>Despesas: <b>${EUR.format(desp)}</b>.<br>Resultado: <b>${EUR.format(lucro)}</b>.<br>Margem: <b>${pct(margem)}</b>.`;
    }
    if(nq.includes('estimad') || nq.includes('previs')){
      return `<b>Faturação estimada — ${d.currentMonthName}</b><br>Com ${d.diasObs} dias observados, a média diária é <b>${EUR.format(d.mediaDia)}</b>. A estimativa para o mês completo é <b>${EUR.format(d.fatEstimada)}</b>.`;
    }
    if(nq.includes('despesa') || nq.includes('custo') || nq.includes('acima da media') || nq.includes('acima da média')){
      const custos={Fornecedores:sumMapForPeriod(d.buckets.Fornecedores,period,d),Ordenados:sumMapForPeriod(d.buckets.Ordenados,period,d),'Despesas Fixas':sumMapForPeriod(d.buckets['Despesas Fixas'],period,d),Amortizações:sumMapForPeriod(d.buckets.Amortizações,period,d)};
      const ranking=rankObj(custos);
      return `<b>Peso dos custos — ${label}</b><br>${ranking.map(([n,v])=>`<b>${n}</b>: ${EUR.format(v)}`).join('<br>')}`;
    }
    if(nq.includes('compara') || nq.includes('ano passado') || nq.includes('2025')){
      const cur=monthsUntil[d.currentMonth]?.fat||0;
      const prevKey=monthKey(d.currentYear-1,d.currentMonth);
      let prev=0;
      d.fatHist.forEach(r=>{const y=Number(get(r,['Ano','ano']));const m=monthIndex(get(r,['Mês','mes']));if(y===d.currentYear-1&&m===d.currentMonth)prev+=Number(get(r,['Valor','valor'])||0);});
      const diff=cur-prev;
      return `<b>${d.currentMonthName} ${d.currentYear} vs ${d.currentMonthName} ${d.currentYear-1}</b><br>${d.currentMonthName} ${d.currentYear}: <b>${EUR.format(cur)}</b><br>${d.currentMonthName} ${d.currentYear-1}: <b>${prev?EUR.format(prev):'sem dados'}</b><br>${prev?`Diferença: <b>${EUR.format(diff)}</b> (${pct(diff/prev*100)}).`:'Não há dados suficientes para calcular a variação.'}`;
    }
    return `<b>Resumo rápido</b><br>Até ${d.currentMonthName}, a faturação acumulada é <b>${EUR.format(fatYtd)}</b>, as despesas acumuladas são <b>${EUR.format(despYtd)}</b> e o resultado acumulado é <b>${EUR.format(lucroYtd)}</b>.<br><br>Podes perguntar, por exemplo: “Quanto gastei na Aviludo este ano?”, “Qual foi o melhor mês?” ou “Qual é a margem acumulada?”.`;
  }

  window.askAI=async function(text){
    const input=document.getElementById('aiInput');
    const q=(text || (input?input.value:'') || '').trim();
    if(!q)return;
    addMsg('user',q.replace(/</g,'&lt;').replace(/>/g,'&gt;'));
    if(input)input.value='';
    addMsg('ai','<b>A analisar dados reais...</b><br>Estou a consultar a base de dados do Dona Maria Deck.');
    try{
      const d=await computeAI(true);
      const win=document.getElementById('chatWindow');
      if(win && win.lastElementChild && win.lastElementChild.classList.contains('ai')) win.lastElementChild.remove();
      addMsg('ai',answerFromData(q,d));
    }catch(e){
      console.error('[V62 IA] erro',e);
      const win=document.getElementById('chatWindow');
      if(win && win.lastElementChild && win.lastElementChild.classList.contains('ai')) win.lastElementChild.remove();
      addMsg('ai',`<b>Não consegui analisar os dados.</b><br>${(e&&e.message)?e.message:e}`);
    }
  };

  function updateAIText(){
    const section=document.getElementById('assistente');
    if(!section)return;
    const badge=section.querySelector('.tag.good'); if(badge) badge.textContent='Dados reais';
    const p=section.querySelector('.card.full p'); if(p) p.textContent='Faça perguntas sobre faturação, despesas, fornecedores, resultados e tendências com base nos dados reais do Supabase.';
    const note=section.querySelector('.screen-note'); if(note) note.textContent='O assistente responde localmente com cálculos sobre a base de dados. Não usa API externa nesta versão.';
    const win=document.getElementById('chatWindow');
    if(win){ win.innerHTML='<div class="msg ai"><b>Assistente Dona Maria Deck</b><br>Estou ligado aos dados reais do restaurante. Pergunta-me sobre faturação, fornecedores, despesas, ordenados, investimentos, resultados ou margem.</div><div class="msg ai">Exemplos: “Faturação em Janeiro de 2020?”, “Quanto gastei em energia este ano?”, “Ordenados em 2024”, “Amortizações este ano” ou “Compara 2026 com 2025”.</div>'; }
  }
  document.addEventListener('DOMContentLoaded',updateAIText);
  setTimeout(updateAIText,700);
})();

