// ============================== V48 — REPARAÇÃO INÍCIO + FATURAÇÃO HISTÓRICO ==============================
(function(){
  const URL='https://hrlfwpwzciljwpgejmha.supabase.co';
  const KEY='sb_publishable_2VSqW87Rn7f4OwC1EXDSoQ_CInkq7mK';
  const supa = window.supabase ? window.supabase.createClient(URL, KEY) : null;
  const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const EUR=createEuroFormatter();
  const norm=s=>String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const mi=m=>{ const i=MESES.map(norm).indexOf(norm(m)); return i>=0?i:null; };
  const value=(r,names)=>{ for(const n of names){ if(r && r[n]!==undefined && r[n]!==null) return r[n]; } return null; };
  const add=(map,k,v)=>{ map[k]=(map[k]||0)+(Number(v)||0); };
  const fmtPct=v=>Number.isFinite(v)?`${v.toFixed(1).replace('.',',')}%`:'—';
  const monthKey=(y,m)=>`${y}-${String(m+1).padStart(2,'0')}`;
  const short=MESES.map(m=>m.slice(0,3));
  const currentDate=new Date();
  const curYear=currentDate.getFullYear();
  const curMonth=currentDate.getMonth();

  function setText(id,t){ const el=document.getElementById(id); if(el) el.textContent=t; }

  function renderBars(id, values, labels, mode='blue'){
    const el=document.getElementById(id); if(!el) return;
    el.innerHTML='';
    const nums=values.map(v=>Number(v)||0);
    const max=Math.max(1,...nums.map(Math.abs));
    const h=chartBarHeights(el,230,34);
    nums.forEach((v,i)=>{
      const b=document.createElement('div');
      b.className='bar '+(mode==='blue'?'blue':'');
      b.style.height=(h.min+(Math.abs(v)/max)*h.max)+'px';
      b.title=`${labels[i]} · ${EUR.format(v*1000)}`;
      b.innerHTML=`<span>${labels[i]}</span>`;
      el.appendChild(b);
    });
  }

  function renderDualBars(id,prev,curr,labels){
    const el=document.getElementById(id); if(!el) return;
    el.innerHTML='';
    const max=Math.max(1,...prev,...curr);
    const h=chartBarHeights(el,205,34);
    labels.forEach((lab,i)=>{
      const wrap=document.createElement('div');
      wrap.style.flex='1'; wrap.style.display='flex'; wrap.style.gap='4px'; wrap.style.alignItems='flex-end'; wrap.style.justifyContent='center'; wrap.style.position='relative'; wrap.style.height='100%';
      const b1=document.createElement('div'); b1.className='bar blue'; b1.style.flex='0 0 42%'; b1.style.height=(h.min+((prev[i]||0)/max)*h.max)+'px'; b1.title=`${lab} ano anterior · ${EUR.format(prev[i]||0)}`;
      const b2=document.createElement('div'); b2.className='bar'; b2.style.flex='0 0 42%'; b2.style.height=(h.min+((curr[i]||0)/max)*h.max)+'px'; b2.title=`${lab} ano selecionado · ${EUR.format(curr[i]||0)}`;
      const sp=document.createElement('span'); sp.textContent=lab; sp.style.position='absolute'; sp.style.bottom='-38px'; sp.style.left='50%'; sp.style.transform='translateX(-50%)'; sp.style.fontSize='12px'; sp.style.color='var(--muted)'; sp.style.fontWeight='900';
      wrap.appendChild(b1); wrap.appendChild(b2); wrap.appendChild(sp); el.appendChild(wrap);
    });
  }

  function compBadge(c,p){
    c=Number(c||0); p=Number(p||0);
    if(c<=0 || p<=0) return '<span class="tag">Sem dados suficientes</span>';
    const d=(c-p)/p*100;
    return `<span class="tag ${d>=0?'good':'bad'}">${d>=0?'+':''}${d.toFixed(1).replace('.',',')}% vs ano anterior</span>`;
  }

  async function all(table){
    if(!supa) return [];
    const {data,error}=await supa.from(table).select('*');
    if(error){ console.warn('[V48] erro '+table,error); return []; }
    return data||[];
  }

  function homeCell(row,names){
    for(const n of names){
      if(row && Object.prototype.hasOwnProperty.call(row,n) && row[n]!==null && row[n]!==undefined) return row[n];
    }
    const wanted=names.map(norm);
    const key=Object.keys(row||{}).find(k=>wanted.includes(norm(k)));
    return key ? row[key] : null;
  }
  function homeStaffName(row){
    return homeCell(row,['_staffName','funcionario','Funcionário','Funcionario','funcionário','colaborador','Colaborador','nome','Nome','trabalhador','Trabalhador','employee','Employee']);
  }
  function homeStaffRole(row){
    return homeCell(row,['_staffRole','funcao','Função','Funcao','função','cargo','Cargo','posto','Posto','role','Role']);
  }
  function homeStaffCount(rows){
    return (rows||[]).reduce((total,row)=>total+(Number(row?._staffCount)||1),0);
  }

  window.toggleHomeStaff=function(keepOpen){
    const details=document.getElementById('homeStaffDetails');
    if(!details) return;
    const shifts=window.homeStaffRowsV48||{almoco:[],jantar:[],folga:[]};
    const esc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    if(details.classList.contains('active') && !keepOpen){
      details.classList.remove('active');
      details.innerHTML='';
      return;
    }
    details.classList.add('active');
    const renderRows=(title,rows)=>{
      const body=rows.length ? rows.map(r=>{
        const name=String(homeStaffName(r)||'—');
        const role=String(homeStaffRole(r)||'—');
        return `<div class="home-staff-row"><b>${esc(name)}</b><span>${esc(role)}</span></div>`;
      }).join('') : `<div class="home-staff-empty">Sem funcionários registados.</div>`;
      return `<div class="home-staff-section-title">${title}</div>${body}`;
    };
    details.innerHTML=renderRows('Almoço',shifts.almoco||[])+renderRows('Jantar',shifts.jantar||[])+renderRows('Folga',shifts.folga||[]);
  };

  async function loadInicioV48(){
    if(!supa) return;
    try{
      const [fatHist,fatDia,horarioRows,fornecedoresRows]=await Promise.all([
        all('faturacao_historica'), all('faturacao_diaria'), all('horario'), all('fornecedores_historico')
      ]);
      const today=new Date();
      const targetYear=today.getFullYear();
      const targetMonth=today.getMonth();
      const targetDay=today.getDate();
      const sameYear=targetYear-1;
      const daysInMonth=new Date(targetYear,targetMonth+1,0).getDate();
      const monthName=MESES[targetMonth];
      const histMonthTotals={};
      const dailyMonthTotals={};
      const monthTotals={};
      const dailyByDay={};
      let maxRevenueDate=null;
      const parseMoney=v=>{
        if(typeof v==='number') return Number.isFinite(v)?v:0;
        let s=String(v ?? '').trim();
        if(!s) return 0;
        s=s.replace(/\s/g,'').replace(/€/g,'');
        if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
        const n=Number(s.replace(/[^0-9.-]/g,''));
        return Number.isFinite(n)?n:0;
      };
      const monthFromValue=v=>{
        if(v===null || v===undefined || v==='') return null;
        const asNum=Number(v);
        if(Number.isFinite(asNum) && asNum>=1 && asNum<=12) return asNum-1;
        return mi(v);
      };
      const pctText=v=>Number.isFinite(v)?`${v.toFixed(1).replace('.',',')}%`:'—';
      const pctSigned=v=>Number.isFinite(v)?`${v>=0?'+':''}${v.toFixed(1).replace('.',',')}%`:'Sem dados';
      const localDateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const monthYearText=(year,month)=>`${MESES[month]} ${year}`;
      const parseScheduleDate=v=>{
        if(!v) return '';
        if(typeof v==='number'){
          const excel=new Date(Math.round((v-25569)*86400*1000));
          return isNaN(excel)?'':localDateKey(excel);
        }
        if(v instanceof Date && !isNaN(v)) return localDateKey(v);
        const s=String(v).trim();
        if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
        const numeric=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
        if(numeric){
          const year=Number(numeric[3].length===2?'20'+numeric[3]:numeric[3]);
          return localDateKey(new Date(year,Number(numeric[2])-1,Number(numeric[1])));
        }
        const m=s.match(/^(\d{1,2})[\/\s.-]([A-Za-zÀ-ÿ]{3,})[\/\s.-](\d{2,4})$/);
        if(!m) return '';
        const monthNames={jan:0,janeiro:0,feb:1,fev:1,fevereiro:1,mar:2,marco:2,março:2,apr:3,abr:3,abril:3,may:4,mai:4,maio:4,jun:5,junho:5,jul:6,julho:6,aug:7,ago:7,agosto:7,sep:8,set:8,setembro:8,oct:9,out:9,outubro:9,nov:10,novembro:10,dec:11,dez:11,dezembro:11};
        const month=monthNames[norm(m[2])];
        const year=Number(m[3].length===2?'20'+m[3]:m[3]);
        if(month===undefined || !year) return '';
        return localDateKey(new Date(year,month,Number(m[1])));
      };
      const uniqueStaff=rows=>{
        const seen=new Set();
        return rows.filter(r=>{
          if(Number(r?._staffCount)) return true;
          const name=String(homeStaffName(r)||'').trim();
          const role=String(homeStaffRole(r)||'').trim();
          const key=norm(name)+'|'+norm(role);
          if(!name || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };
      const normalizeShift=v=>{
        const s=norm(v);
        if(s.includes('almoco') || s.includes('almorco') || s.includes('lunch')) return 'almoco';
        if(s.includes('jantar') || s.includes('dinner') || s.includes('noite')) return 'jantar';
        if(s.includes('folga') || s.includes('off') || s.includes('descanso')) return 'folga';
        return s;
      };
      const scheduleDateValue=r=>{
        const direct=homeCell(r,['data','Data','date','Date','data_servico','Data Serviço','DataServico','Data de Serviço']);
        if(direct) return direct;
        const year=Number(homeCell(r,['Ano','ano','year','Year']));
        const day=Number(homeCell(r,['Dia','dia','day','Day']));
        const monthRaw=homeCell(r,['Mês','Mes','mês','mes','month','Month']);
        const month=monthFromValue(monthRaw);
        return year && day && month!==null ? localDateKey(new Date(year,month,day)) : '';
      };
      const scheduleShiftValue=r=>homeCell(r,['horario','Horário','Horario','turno','Turno','escala','Escala','periodo','Período','Periodo','servico','Serviço','Servico','shift','Shift']);
      const scheduleShiftNames=v=>{
        const s=norm(v);
        const names=[];
        if(s.includes('almoco') || s.includes('almorco') || s.includes('lunch')) names.push('almoco');
        if(s.includes('jantar') || s.includes('dinner') || s.includes('noite')) names.push('jantar');
        if(s.includes('folga') || s.includes('off') || s.includes('descanso')) names.push('folga');
        return names;
      };
      const shiftCellValue=(r,shift)=>{
        const cols={
          almoco:['almoco','Almoço','Almoco','almoço','Lunch'],
          jantar:['jantar','Jantar','Dinner','noite','Noite'],
          folga:['folga','Folga','Off','descanso','Descanso']
        };
        return homeCell(r,cols[shift]||[]);
      };
      const rowsFromShiftCell=(row,shift)=>{
        const raw=shiftCellValue(row,shift);
        if(raw===null || raw===undefined || raw==='') return [];
        const text=String(raw).trim();
        const numeric=Number(text.replace(',','.'));
        if(Number.isFinite(numeric) && numeric>0 && !/[A-Za-zÀ-ÿ]/.test(text)){
          return [{...row,_shift:shift,_staffCount:numeric,_staffName:`${numeric} funcionários`,_staffRole:'Contagem importada'}];
        }
        return text.split(/\n|;|,|\s+\+\s+|\s+e\s+/i)
          .map(name=>name.trim())
          .filter(Boolean)
          .map(name=>({...row,_shift:shift,_staffName:name,_staffRole:normalizeShift(shift)==='folga'?'Folga':'Serviço'}));
      };
      const expandScheduleRow=row=>{
        const rows=[];
        const shiftNames=scheduleShiftNames(scheduleShiftValue(row));
        shiftNames.forEach(shift=>rows.push({...row,_shift:shift}));
        ['almoco','jantar','folga'].forEach(shift=>rows.push(...rowsFromShiftCell(row,shift)));
        return rows;
      };
      const scheduleMatchesToday=(row,todayKey,todayWeekday)=>{
        const rawDate=scheduleDateValue(row);
        const parsedDate=parseScheduleDate(rawDate);
        if(parsedDate) return parsedDate===todayKey;
        const weekday=homeCell(row,['dia_semana','Dia Semana','Dia da Semana','dia da semana','weekday','Weekday','dia','Dia']);
        return norm(weekday || rawDate)===todayWeekday;
      };
      const scheduleRowsForDate=dateKey=>(horarioRows||[]).filter(r=>parseScheduleDate(scheduleDateValue(r))===dateKey);

      fatHist.forEach(r=>{
        const y=Number(value(r,['Ano','ano']));
        const m=monthFromValue(value(r,['Mês','Mes','mês','mes']));
        const v=parseMoney(value(r,['Valor','valor']));
        if(y && m!==null) add(histMonthTotals,monthKey(y,m),v);
      });
      fatDia.forEach(r=>{
        const ds=value(r,['Data','data']); const d=ds?new Date(String(ds)+'T00:00:00'):null;
        const y=Number(value(r,['Ano','ano']) || (d&&!isNaN(d)?d.getFullYear():0));
        const monthRaw=value(r,['Mês','Mes','mês','mes']);
        const m=(monthRaw!==null && monthRaw!==undefined) ? monthFromValue(monthRaw) : (d&&!isNaN(d)?d.getMonth():null);
        const v=parseMoney(value(r,['Valor','valor']));
        if(!y || m===null) return;
        add(dailyMonthTotals,monthKey(y,m),v);
        if(d && !isNaN(d)){
          add(dailyByDay,`${y}-${m}-${d.getDate()}`,v);
          if(!maxRevenueDate || d>maxRevenueDate) maxRevenueDate=d;
        }
      });
      [...new Set([...Object.keys(histMonthTotals),...Object.keys(dailyMonthTotals)])].forEach(k=>{
        monthTotals[k]=dailyMonthTotals[k] || histMonthTotals[k] || 0;
      });

      const currentKey=monthKey(targetYear,targetMonth);
      const sameKey=monthKey(sameYear,targetMonth);
      const dailySumToDay=(year,month)=>{
        let total=0, count=0;
        for(let day=1;day<=targetDay;day++){
          const v=dailyByDay[`${year}-${month}-${day}`]||0;
          total+=v;
          if(v>0) count++;
        }
        return {total,count};
      };
      const currentDaily=dailySumToDay(targetYear,targetMonth);
      const sameDaily=dailySumToDay(sameYear,targetMonth);
      const revenueEstimate=computeRevenueEstimate(fatDia,today);
      const fatMes=revenueEstimate.observedTotal || monthTotals[currentKey] || 0;
      const observedDays=revenueEstimate.observedDays;
      const dailyAverage=revenueEstimate.dailyAverage;
      const fatEstimated=revenueEstimate.estimated;
      const sameMonthTotal=monthTotals[sameKey] || 0;
      const sameMonthDays=new Date(sameYear,targetMonth+1,0).getDate();
      const sameMonthComparable=sameDaily.total || (sameMonthTotal ? sameMonthTotal*(Math.min(targetDay,sameMonthDays)/sameMonthDays) : 0);
      const sumYtd=(year,monthComparable)=>{
        let total=0;
        for(let m=0;m<targetMonth;m++) total+=monthTotals[monthKey(year,m)]||0;
        total+=monthComparable;
        return total;
      };
      const currentYtd=sumYtd(targetYear,fatMes);
      const previousYtd=sumYtd(sameYear,sameMonthComparable);
      const ytdDelta=previousYtd ? (currentYtd-previousYtd)/previousYtd*100 : null;
      let goal=0, goalYear=null;
      Object.entries(monthTotals).forEach(([k,total])=>{
        const [y,monthNumber]=k.split('-').map(Number);
        if(monthNumber===targetMonth+1 && y!==targetYear && total>goal){
          goal=total;
          goalYear=y;
        }
      });
      if(!goal && monthTotals[currentKey]){ goal=monthTotals[currentKey]; goalYear=targetYear; }
      const progress=goal ? Math.min(100,Math.max(0,(fatMes/goal)*100)) : null;
      const estimatedProgress=goal ? Math.min(100,Math.max(0,(fatEstimated/goal)*100)) : null;
      const delta=sameMonthComparable ? (fatMes-sameMonthComparable)/sameMonthComparable*100 : null;
      const setHomeText=(id,text)=>{ const el=document.getElementById(id); if(el) el.textContent=text; };
      setHomeText('homeYtdCurrent',EUR.format(currentYtd));
      setHomeText('homeYtdPrevious',previousYtd?EUR.format(previousYtd):'—');
      setHomeText('homeYtdCurrentNote',`Até ${today.toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit'})}`);
      setHomeText('homeYtdPreviousNote',previousYtd ? `${ytdDelta>=0?'+':''}${ytdDelta.toFixed(1).replace('.',',')}% face ao mesmo período` : 'Sem histórico comparável');
      setHomeText('homeMonthCurrentLabel',`Faturação ${monthName}`);
      setHomeText('homeMonthGoalLabel',`Objetivo ${monthName}`);
      setHomeText('homeMonthCurrent',EUR.format(fatMes));
      setHomeText('homeMonthGoal',goal?EUR.format(goal):'—');
      setHomeText('homeMonthCurrentNote',observedDays ? `${observedDays} dias registados este mês` : 'Sem dias registados; usado total mensal');
      setHomeText('homeMonthGoalNote',goalYear ? 'Máximo histórico observado' : 'Ainda sem histórico para este mês');
      const goalPct=document.getElementById('homeGoalPercent');
      const goalFill=document.getElementById('homeGoalFill');
      const goalEstimateFill=document.getElementById('homeGoalEstimateFill');
      const goalDelta=document.getElementById('homeGoalDelta');
      const goalNote=document.getElementById('homeGoalNote');
      const goalNow=document.getElementById('homeGoalNow');
      const goalEstimated=document.getElementById('homeGoalEstimated');
      if(goalPct) goalPct.textContent=progress===null?'—':pctText(progress);
      if(goalFill) goalFill.style.width=(progress===null?0:progress)+'%';
      if(goalEstimateFill) goalEstimateFill.style.width=(estimatedProgress===null?0:estimatedProgress)+'%';
      if(goalDelta) goalDelta.textContent=estimatedProgress===null ? 'Sem estimativa disponível' : `Estimado: ${pctText(estimatedProgress)} do objetivo`;
      if(goalNow) goalNow.textContent=progress===null?'—':`${pctText(progress)} · ${EUR.format(fatMes)}`;
      if(goalEstimated) goalEstimated.textContent=estimatedProgress===null?'—':`${pctText(estimatedProgress)} · ${EUR.format(fatEstimated)}`;
      if(goalNote) goalNote.textContent=goal ? `Objetivo: superar ${EUR.format(goal)}, o máximo histórico observado para ${monthName}.` : `Ainda não há histórico suficiente para definir objetivo de ${monthName}.`;

      const todayKey=localDateKey(today);
      const todayWeekday=norm(today.toLocaleDateString('pt-PT',{weekday:'long'}));
      const datedScheduleKeys=[...new Set((horarioRows||[]).map(r=>parseScheduleDate(scheduleDateValue(r))).filter(Boolean))].sort();
      let scheduleDateKey=todayKey;
      let scheduleIsFallback=false;
      let todaySchedule=scheduleRowsForDate(todayKey);
      if(!todaySchedule.length){
        scheduleDateKey=datedScheduleKeys.filter(k=>k<=todayKey).pop() || datedScheduleKeys[datedScheduleKeys.length-1] || todayKey;
        todaySchedule=scheduleRowsForDate(scheduleDateKey);
        scheduleIsFallback=scheduleDateKey!==todayKey;
      }
      if(!todaySchedule.length){
        todaySchedule=(horarioRows||[]).filter(r=>scheduleMatchesToday(r,todayKey,todayWeekday));
      }
      const expandedSchedule=todaySchedule.flatMap(expandScheduleRow);
      const shiftRows=name=>uniqueStaff(expandedSchedule.filter(r=>r._shift===name || normalizeShift(scheduleShiftValue(r))===name));
      const lunchRows=shiftRows('almoco');
      const dinnerRows=shiftRows('jantar');
      const offRows=shiftRows('folga');
      window.homeStaffRowsV48={almoco:lunchRows,jantar:dinnerRows,folga:offRows};
      const staffDate=document.getElementById('homeStaffDate');
      const lunchCount=document.getElementById('homeLunchCount');
      const dinnerCount=document.getElementById('homeDinnerCount');
      const offCount=document.getElementById('homeOffCount');
      const staffDetails=document.getElementById('homeStaffDetails');
      const scheduleDate=new Date(scheduleDateKey+'T00:00:00');
      const scheduleDateText=isNaN(scheduleDate) ? today.toLocaleDateString('pt-PT',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}) : scheduleDate.toLocaleDateString('pt-PT',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
      if(staffDate) staffDate.textContent=scheduleIsFallback ? `último horário disponível · ${scheduleDateText}` : scheduleDateText;
      if(lunchCount) lunchCount.textContent=`${homeStaffCount(lunchRows)}`;
      if(dinnerCount) dinnerCount.textContent=`${homeStaffCount(dinnerRows)}`;
      if(offCount) offCount.textContent=`${homeStaffCount(offRows)}`;
      if(staffDetails && staffDetails.classList.contains('active')){
        window.toggleHomeStaff(true);
      }

      const payrollAlert=document.getElementById('homePayrollAlert');
      const revenueMissingAlert=document.getElementById('homeRevenueMissingAlert');
      const suppliersMissingAlert=document.getElementById('homeSuppliersMissingAlert');
      const payDaysLeft=daysInMonth-targetDay;
      if(payrollAlert){
        payrollAlert.className=`home-alert ${payDaysLeft<=2?'warn':''}`;
        const span=payrollAlert.querySelector('span');
        const text=payDaysLeft===0?'Hoje':`${payDaysLeft} dias`;
        if(span) span.textContent=text;
        payrollAlert.innerHTML=`<span>${text}</span><b>Ordenados</b>${payDaysLeft===0?'Hoje é o último dia do mês: pagar ordenados.':`Faltam ${payDaysLeft} dias para o último dia do mês, data prevista para pagamento de ordenados.`}`;
      }
      if(revenueMissingAlert){
        const todayStart=new Date(targetYear,targetMonth,targetDay);
        const expectedStart=new Date(todayStart);
        expectedStart.setDate(expectedStart.getDate()-1);
        const maxStart=maxRevenueDate?new Date(maxRevenueDate.getFullYear(),maxRevenueDate.getMonth(),maxRevenueDate.getDate()):null;
        const missing=maxStart?Math.max(0,Math.floor((expectedStart-maxStart)/86400000)):null;
        const dateText=maxStart?maxStart.toLocaleDateString('pt-PT'):'sem registos';
        const state=missing===null || missing>2 ? 'bad' : (missing>0 ? 'warn' : '');
        const badge=missing===null?'—':(missing===0?'Em dia':`${missing} dias`);
        revenueMissingAlert.className=`home-alert ${state}`;
        const missingText=missing===null
          ? 'Não encontrei registos na tabela de faturação diária.'
          : (maxStart>todayStart
            ? `A maior data registada é ${dateText}, posterior a hoje.`
            : (missing===0
              ? (maxStart>=todayStart ? `A faturação já inclui hoje (${dateText}).` : `A faturação está em dia até ontem. Último registo: ${dateText}.`)
              : `A última data registada é ${dateText}; há ${missing} dia${missing===1?'':'s'} por lançar até ontem.`));
        revenueMissingAlert.innerHTML=`<span>${badge}</span><b>Faturação em falta</b>${missingText}`;
      }
      if(suppliersMissingAlert){
        let lastSupplierMonth=null;
        (fornecedoresRows||[]).forEach(r=>{
          const y=Number(value(r,['Ano','ano']));
          const m=monthFromValue(value(r,['Mês','Mes','mês','mes']));
          const v=parseMoney(value(r,['Valor','valor']));
          if(!y || m===null || v<=0) return;
          const candidate=new Date(y,m,1);
          if(!lastSupplierMonth || candidate>lastSupplierMonth) lastSupplierMonth=candidate;
        });
        const currentMonthStart=new Date(targetYear,targetMonth,1);
        const monthsMissing=lastSupplierMonth
          ? Math.max(0,(targetYear-lastSupplierMonth.getFullYear())*12 + targetMonth-lastSupplierMonth.getMonth())
          : null;
        const lastText=lastSupplierMonth ? monthYearText(lastSupplierMonth.getFullYear(),lastSupplierMonth.getMonth()) : 'sem registos';
        const state=monthsMissing===null || monthsMissing>1 ? 'bad' : (monthsMissing===1 ? 'warn' : '');
        const badge=monthsMissing===null?'—':(monthsMissing===0?'Em dia':`${monthsMissing} ${monthsMissing===1?'mês':'meses'}`);
        const detail=monthsMissing===null
          ? 'Não encontrei despesas de fornecedores registadas.'
          : (lastSupplierMonth>currentMonthStart
            ? `Existem despesas de fornecedores registadas em ${lastText}, posterior ao mês atual.`
            : (monthsMissing===0
              ? `Há despesas de fornecedores registadas em ${lastText}.`
              : `Não há despesas de fornecedores registadas desde ${lastText}.`));
        suppliersMissingAlert.className=`home-alert ${state}`;
        suppliersMissingAlert.innerHTML=`<span>${badge}</span><b>Fornecedores em falta</b>${detail}`;
      }
      console.info('[V48] início atualizado', {fatMes,fatEstimated,sameMonthComparable,goal,progress,estimatedProgress,maxRevenueDate,lunch:lunchRows.length,dinner:dinnerRows.length,folga:offRows.length});
    }catch(e){ console.error('[V48] erro início',e); }
  }

  let histDataV48=null;
  async function loadHistoricoV48(){
    if(!supa) return;
    try{
      const [hist,diaria]=await Promise.all([all('faturacao_historica'), all('faturacao_diaria')]);
      const byYear={}, byYM={};
      (hist||[]).forEach(r=>{
        const y=Number(value(r,['Ano','ano'])); const m=mi(value(r,['Mês','mes'])); const v=Number(value(r,['Valor','valor'])||0);
        if(!y || m===null || !v) return;
        add(byYear,y,v); add(byYM,monthKey(y,m),v);
      });
      (diaria||[]).forEach(r=>{
        const ds=value(r,['Data','data']); const d=ds?new Date(String(ds)+'T00:00:00'):null;
        const y=Number(value(r,['Ano','ano']) || (d?d.getFullYear():0));
        const m=(value(r,['Mês','mes'])!==null && value(r,['Mês','mes'])!==undefined) ? mi(value(r,['Mês','mes'])) : (d?d.getMonth():null);
        const v=Number(value(r,['Valor','valor'])||0);
        if(!y || m===null || !v) return;
        add(byYear,y,v); add(byYM,monthKey(y,m),v);
      });
      const years=Object.keys(byYear).map(Number).sort((a,b)=>a-b);
      histDataV48={years,byYear,byYM};
      const sel=document.getElementById('histYearSelect');
      if(sel && years.length){
        const currentVal=Number(sel.value)||years[years.length-1];
        sel.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');
        sel.value=String(years.includes(currentVal)?currentVal:years[years.length-1]);
        window.renderFaturacaoHistoricoAno=renderHistoricoAnoV48;
        sel.onchange=renderHistoricoAnoV48;
      }
      const total=Object.values(byYear).reduce((a,b)=>a+b,0);
      const bestYear=years.reduce((best,y)=>(byYear[y]||0)>(byYear[best]||0)?y:best,years[0]);
      let bestKey=null,bestVal=-1;
      Object.entries(byYM).forEach(([k,v])=>{ if(v>bestVal){ bestKey=k; bestVal=v; }});
      const [bestY,bestM1]=(bestKey||'0-1').split('-').map(Number);
      const bestM=(bestM1||1)-1;
      const monthVals=Object.values(byYM).filter(v=>v>0);
      setText('histTotal',EUR.format(total));
      setText('histTotalNote',years.length?`Período ${years[0]}-${years[years.length-1]}`:'—');
      setText('histBestYear',bestYear?String(bestYear):'—');
      setText('histBestYearValue',bestYear?EUR.format(byYear[bestYear]||0):'—');
      setText('histBestMonth',bestY?`${MESES[bestM]} ${bestY}`:'—');
      setText('histBestMonthValue',bestY?EUR.format(bestVal):'—');
      setText('histAvgMonth',monthVals.length?EUR.format(monthVals.reduce((a,b)=>a+b,0)/monthVals.length):'—');
      renderBars('chartHistAnnual',years.map(y=>(byYear[y]||0)/1000),years.map(String),'blue');
      renderHistoricoAnoV48();
      console.info('[V48] histórico faturação carregado', {years,total});
    }catch(e){
      console.error('[V48] erro histórico faturação',e);
      const tbody=document.getElementById('histMonthlyTable');
      if(tbody) tbody.innerHTML='<tr><td colspan="5" class="empty">Não foi possível carregar a faturação histórica.</td></tr>';
    }
  }

  function renderHistoricoAnoV48(){
    const h=histDataV48; if(!h) return;
    const sel=document.getElementById('histYearSelect');
    const year=Number(sel?.value || h.years[h.years.length-1]); const prev=year-1;
    const curr=MESES.map((_,i)=>h.byYM[monthKey(year,i)]||0);
    const old=MESES.map((_,i)=>h.byYM[monthKey(prev,i)]||0);
    setText('histMonthlyTitle',`Evolução mensal — ${year} vs ${prev}`);
    setText('histMonthlyNote','Barras azuis: ano anterior. Barras verdes: ano selecionado.');
    setText('histYearPrevHead',String(prev)); setText('histYearCurrentHead',String(year));
    renderDualBars('chartHistMonthly',old,curr,short);
    const tbody=document.getElementById('histMonthlyTable');
    if(tbody){
      tbody.innerHTML=MESES.map((m,i)=>{
        const c=curr[i]||0, p=old[i]||0, diff=c-p;
        const diffHtml=(c>0&&p>0)?`<b class="${diff>=0?'money-positive':'money-negative'}">${EUR.format(diff)}</b>`:'<span class="empty">—</span>';
        return `<tr><td>${m}</td><td class="money">${p>0?EUR.format(p):'<span class="empty">—</span>'}</td><td class="money"><b>${c>0?EUR.format(c):'<span class="empty">—</span>'}</b></td><td class="money">${diffHtml}</td><td>${compBadge(c,p)}</td></tr>`;
      }).join('');
    }
    const lastMonthIndex=Math.max(0,...curr.map((v,i)=>v>0?i:-1));
    const totalC=curr.slice(0,lastMonthIndex+1).reduce((a,b)=>a+b,0), totalP=old.slice(0,lastMonthIndex+1).reduce((a,b)=>a+b,0);
    const best=Math.max(...curr); const bestIdx=curr.indexOf(best);
    const insights=document.getElementById('histInsights');
    if(insights){
      insights.innerHTML=`<div class="alert ${totalC>=totalP?'good':'bad'}"><b>YTD ${year} vs YTD ${prev}</b><span class="amount">${(totalC>0&&totalP>0)?fmtPct((totalC-totalP)/totalP*100)+` vs ${prev} até ${MESES[lastMonthIndex]}`:'Sem dados suficientes'}</span><br>${year} até ${MESES[lastMonthIndex]}: ${EUR.format(totalC)}. ${prev} até ${MESES[lastMonthIndex]}: ${EUR.format(totalP)}.</div><div class="alert good"><b>Melhor mês de ${year}</b><span class="amount">${EUR.format(best||0)}</span><br>${best?MESES[bestIdx]:'Sem dados'} é o mês com maior faturação no ano selecionado.</div><div class="alert"><b>Comparação justa</b><br>O comparativo principal usa sempre o acumulado até ao mesmo mês nos dois anos.</div>`;
    }
  }

  window.loadInicioV48=loadInicioV48;
  window.loadFaturacaoHistoricoV48=loadHistoricoV48;
  window.renderFaturacaoHistoricoAno=renderHistoricoAnoV48;

  // Executa após os scripts anteriores terminarem e repete uma vez para evitar conflito com loaders antigos.
  document.addEventListener('DOMContentLoaded',()=>{ setTimeout(()=>{loadInicioV48(); loadHistoricoV48();},600); });
  setTimeout(()=>{loadInicioV48(); loadHistoricoV48();},1800);
})();

