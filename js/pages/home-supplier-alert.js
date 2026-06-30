// ============================== V58.1 — CORREÇÃO CARTÃO FORNECEDORES MÊS ==============================
(function(){
  const MESES_V581=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const EUR_V581=createEuroFormatter();
  function normV581(v){
    return String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }
  function cellV581(row,names){
    for(const n of names){
      if(row && Object.prototype.hasOwnProperty.call(row,n) && row[n] !== null && row[n] !== undefined) return row[n];
    }
    return null;
  }
  function monthIndexV581(value){
    const n=normV581(value);
    return MESES_V581.findIndex(m=>normV581(m)===n || normV581(m).slice(0,3)===n.slice(0,3));
  }
  function numberV581(value){
    if(typeof value==='number') return Number.isFinite(value)?value:0;
    let s=String(value ?? '').trim();
    if(!s) return 0;
    s=s.replace(/\s/g,'').replace(/€/g,'');
    if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
    const n=Number(s.replace(/[^0-9.-]/g,''));
    return Number.isFinite(n)?n:0;
  }
  function setHomeFornecedorV581(total){
    const home=document.querySelector('[data-home-dashboard="revenue"]');
    if(!home) return;
    if(home.dataset.homeDashboard==='revenue') return;
    const labels=home.querySelectorAll('small');
    const values=home.querySelectorAll('b');
    if(labels[1]) labels[1].textContent='Fornecedores mês';
    if(values[1]) values[1].textContent=EUR_V581.format(total || 0);
  }
  async function loadHomeFornecedorMesV581(){
    if(!window.db) return;
    const now=new Date();
    const targetYear=now.getFullYear();
    const targetMonth=now.getMonth();
    try{
      const {data,error}=await window.db.from('fornecedores_historico').select('*');
      if(error) throw error;
      let total=0;
      (data||[]).forEach(row=>{
        const ano=Number(cellV581(row,['Ano','ano','ANO']));
        const mes=monthIndexV581(cellV581(row,['Mês','Mes','mês','mes','MES']));
        const valor=numberV581(cellV581(row,['Valor','valor','VALOR']));
        if(ano===targetYear && mes===targetMonth) total+=valor;
      });
      setHomeFornecedorV581(total);
      console.info('[V58.1] Fornecedores mês corrigido', {targetYear, mes:MESES_V581[targetMonth], total});
    }catch(e){
      console.warn('[V58.1] Erro ao corrigir fornecedores mês', e);
    }
  }
  window.loadHomeFornecedorMesV581=loadHomeFornecedorMesV581;
  document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(loadHomeFornecedorMesV581,1200);
    setTimeout(loadHomeFornecedorMesV581,3000);
  });
  const oldShow=window.show;
  window.show=function(id){
    const res=oldShow ? oldShow(id) : undefined;
    if(id==='inicio') setTimeout(loadHomeFornecedorMesV581,300);
    return res;
  };
})();

