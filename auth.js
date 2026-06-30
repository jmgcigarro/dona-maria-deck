// ============================== V58 — LOGIN + PERFIS SOBRE BASE V49 ==============================
(function(){
  const FALLBACK_PROFILES={
    'jmcigarro@hotmail.com':{Nome:'João',Perfil:'Administrador'},
    'nelsoncigarro@hotmail.com':{Nome:'Nélson',Perfil:'Gerente'},
    'visitante@hotmail.com':{Nome:'Visitante',Perfil:'Visitante'}
  };
  window.currentUserProfile='Visitante';
  window.currentUserName='Visitante';

  function setLoginError(msg){
    const el=document.getElementById('loginError');
    if(el){el.textContent=msg||'Não foi possível iniciar sessão.';el.style.display='block';}
  }
  function clearLoginError(){const el=document.getElementById('loginError'); if(el)el.style.display='none';}
  function normalizeEmail(email){return String(email||'').trim().toLowerCase();}
  function loginIdentifierToEmail(value){
    const clean=normalizeEmail(value);
    if(clean.includes('@')) return clean;
    return clean ? `${clean}@hotmail.com` : '';
  }
  async function getProfileForEmail(email){
    const clean=normalizeEmail(email);
    if(db){
      try{
        const {data,error}=await db.from('utilizadores').select('*').eq('E-mail',clean).maybeSingle();
        if(!error && data){
          return {Nome:data['Nome']||data.Nome||FALLBACK_PROFILES[clean]?.Nome||'Utilizador',Perfil:data['Perfil']||data.Perfil||FALLBACK_PROFILES[clean]?.Perfil||'Visitante'};
        }
        if(error) console.warn('V58 perfil: erro ao ler tabela utilizadores, usando fallback',error);
      }catch(e){console.warn('V58 perfil: fallback por exceção',e);}
    }
    return FALLBACK_PROFILES[clean] || {Nome:'Utilizador',Perfil:'Visitante'};
  }
  function applyProfile(profile){
    const perfil=profile?.Perfil || 'Visitante';
    const nome=profile?.Nome || 'Utilizador';
    window.currentUserProfile=perfil;
    window.currentUserName=nome;
    const badge=document.getElementById('userProfileBadge');
    if(badge) badge.textContent=perfil;
    document.body.classList.remove('auth-wait');
    const login=document.getElementById('loginScreen');
    if(login) login.style.display='none';
  }
  async function refreshAfterLogin(){
    try{ if(typeof invalidateRestaurantData==='function') invalidateRestaurantData(); }catch(e){console.warn('V58 limpar cache após login',e);}
    try{ if(typeof loadRestaurantData==='function') await loadRestaurantData(true); }catch(e){console.warn('V58 cache dados após login',e);}
    try{ if(typeof loadListsFromSupabase==='function') await loadListsFromSupabase(); }catch(e){console.warn('V58 listas após login',e);}
    try{ if(typeof loadFaturacaoAtualReal==='function') await loadFaturacaoAtualReal(); }catch(e){console.warn('V58 faturação atual após login',e);}
    try{ if(typeof loadV39==='function') await loadV39(); }catch(e){console.warn('V58 dados após login',e);}
    try{ if(typeof loadFaturacaoHistoricoV48==='function') await loadFaturacaoHistoricoV48(); }catch(e){console.warn('V58 histórico após login',e);}
    try{ if(typeof loadResultadosReais==='function') await loadResultadosReais(); }catch(e){console.warn('V58 resultados após login',e);}
    try{ if(typeof loadAnalisesReais==='function') await loadAnalisesReais(); }catch(e){console.warn('V58 análises após login',e);}
  }
  async function bootAuth(){
    if(!db){ setLoginError('Supabase não carregou no browser.'); return; }
    const {data}=await db.auth.getSession();
    const session=data && data.session;
    if(session?.user?.email){
      const profile=await getProfileForEmail(session.user.email);
      applyProfile(profile);
      await refreshAfterLogin();
    }else{
      document.body.classList.add('auth-wait');
      const login=document.getElementById('loginScreen');
      if(login) login.style.display='grid';
    }
  }
  window.logoutApp=async function(){
    try{ if(db) await db.auth.signOut(); }catch(e){console.warn(e);}
    location.reload();
  };

  const originalLaunch=window.launchRecord;
  window.launchRecord=async function(ev){
    if(window.currentUserProfile==='Visitante'){
      if(ev){ev.preventDefault();ev.stopPropagation();}
      notify('Perfil Visitante: apenas consulta.','warn');
      return false;
    }
    return originalLaunch ? originalLaunch(ev) : false;
  };

  document.addEventListener('DOMContentLoaded',function(){
    const form=document.getElementById('loginForm');
    if(form){
      form.addEventListener('submit',async function(ev){
        ev.preventDefault(); clearLoginError();
        const btn=document.getElementById('loginButton');
        const email=loginIdentifierToEmail(document.getElementById('loginEmail')?.value||'');
        const password=document.getElementById('loginPassword')?.value||'';
        if(btn){btn.disabled=true;btn.textContent='A entrar...';}
        try{
          const {data,error}=await db.auth.signInWithPassword({email,password});
          if(error) throw error;
          const profile=await getProfileForEmail(data.user.email);
          applyProfile(profile);
          await refreshAfterLogin();
        }catch(e){
          console.error('V58 login',e);
          setLoginError('Dados de acesso inválidos ou utilizador não configurado.');
        }finally{
          if(btn){btn.disabled=false;btn.textContent='Entrar';}
        }
      });
    }
    setTimeout(bootAuth,150);
  });
})();

