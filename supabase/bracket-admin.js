// ── Modo organizador del bracket (demo semi-funcional) ─────────────────
// Todo se guarda como borrador en localStorage (BKV2.LS_KEY). Cuando el
// backend tenga sql/BRACKET_ADMIN_V1.sql aplicado, "Copiar SQL" genera el
// script exacto para replicar el borrador en Supabase.
(function(global){
  'use strict';
  const BK=global.BKV2;
  const FACS=['INGENIERIA','ARQUITECTURA','CIENCIAS','CIENCIAS_POLITICAS_SOCIALES','CONTADURIA_ADMINISTRACION','DERECHO','ECONOMIA','FILOSOFIA_LETRAS','MEDICINA','MEDICINA_VETERINARIA_ZOOTECNIA','ODONTOLOGIA','PSICOLOGIA','QUIMICA','EXTERNO'];
  const CARS=['AEROESPACIAL','AMBIENTAL','BIOMEDICA','CIVIL','COMPUTACION','ELECTRICA_ELECTRONICA','GEOFISICA','GEOLOGICA','GEOMATICA','INDUSTRIAL','MECANICA','MECATRONICA','MINAS_METALURGIA','PETROLERA','TELECOMUNICACIONES'];
  const POOL_KEY='fi_bracket_pool_2027_1';
  let state=null, rerender=null, modal=null;

  function pool(){ try{return JSON.parse(localStorage.getItem(POOL_KEY)||'[]');}catch(e){return[];} }
  function savePool(p){ try{localStorage.setItem(POOL_KEY,JSON.stringify(p));}catch(e){} renderPool(); }
  function nice(s){ return String(s||'').replace(/_/g,' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()); }

  function init(opts){
    state=opts.state; rerender=opts.rerender;
    buildButton(); buildDrawer(); buildModal();
    document.addEventListener('click',onClick);
  }
  function setState(s){ state=s; renderPool(); }

  // ── UI base ──
  function buildButton(){
    const b=document.createElement('button');
    b.className='bk-adminbtn'; b.id='bkAdminBtn'; b.type='button';
    b.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> Modo organizador';
    b.addEventListener('click',()=>{
      if(!document.body.classList.contains('bk-admin')){
        const ok=sessionStorage.getItem('bk_admin_ok')||confirm('Modo organizador: los cambios se guardan como BORRADOR local en este navegador. ¿Continuar?');
        if(!ok) return; sessionStorage.setItem('bk_admin_ok','1');
      }
      document.body.classList.toggle('bk-admin');
    });
    document.body.appendChild(b);
  }
  function buildDrawer(){
    const d=document.createElement('aside');
    d.className='bka'; d.setAttribute('aria-label','Panel de organización del bracket');
    d.innerHTML='<header><b>Organizar llave</b><small>Borrador local · FI 2027-1</small></header><div class="body">'
      +'<h5>Publicación</h5><div class="row"><button class="a gold" id="bkaPub">Publicar borrador</button><button class="a" id="bkaUnpub">Ocultar</button></div>'
      +'<div class="note">Publicado = visible para visitantes de <b>este navegador</b> (demo). Para producción usa «Copiar SQL» y córrelo en Supabase.</div>'
      +'<h5>Jugadores (pool)</h5>'
      +'<input type="text" id="bkaName" placeholder="Nombre / apodo" maxlength="26">'
      +'<select id="bkaFac">'+FACS.map(f=>'<option value="'+f+'"'+(f==='INGENIERIA'?' selected':'')+'>'+nice(f)+'</option>').join('')+'</select>'
      +'<select id="bkaCar"><option value="">— carrera FI (opcional) —</option>'+CARS.map(c=>'<option value="'+c+'">'+nice(c)+'</option>').join('')+'</select>'
      +'<div class="row"><button class="a" id="bkaAdd">Agregar al pool</button><button class="a" id="bkaLoad">Cargar inscritos</button></div>'
      +'<div class="pool" id="bkaPool"></div>'
      +'<h5>Llenado de octavos</h5><div class="row"><button class="a" id="bkaFillOrder">En orden</button><button class="a red" id="bkaEmpty">Vaciar llave</button></div>'
      +'<div class="note">El sorteo eliminatorio se hace físicamente; captura los emparejamientos manualmente. Con menos de 16 jugadores, los huecos se rellenan con BYE.</div>'
      +'<h5>Resultados</h5><div class="row"><button class="a red" id="bkaResetRes">Borrar resultados</button><button class="a red" id="bkaResetAll">Reiniciar todo</button></div>'
      +'<h5>Datos</h5><div class="row"><button class="a" id="bkaSQL">Copiar SQL</button><button class="a" id="bkaExport">Exportar JSON</button><button class="a" id="bkaImport">Importar JSON</button></div>'
      +'<div class="note">«Copiar SQL» genera las llamadas RPC de <b>sql/BRACKET_ADMIN_V1.sql</b> para reproducir este borrador en la base de datos.</div>'
      +'</div>';
    document.body.appendChild(d);
    d.querySelector('#bkaPub').addEventListener('click',()=>{state.published=true;BK.save(state);toast('Borrador publicado (local)');});
    d.querySelector('#bkaUnpub').addEventListener('click',()=>{state.published=false;BK.save(state);toast('Bracket oculto');});
    d.querySelector('#bkaAdd').addEventListener('click',addToPool);
    d.querySelector('#bkaLoad').addEventListener('click',loadRegistered);
    d.querySelector('#bkaFillOrder').addEventListener('click',()=>fill(false));
    d.querySelector('#bkaEmpty').addEventListener('click',()=>{if(confirm('¿Vaciar toda la llave?'))BK.resetAll(state);});
    d.querySelector('#bkaResetRes').addEventListener('click',()=>{if(confirm('¿Borrar todos los resultados (los jugadores de octavos se conservan)?'))BK.resetResults(state);});
    d.querySelector('#bkaResetAll').addEventListener('click',()=>{if(confirm('¿Reiniciar TODO (jugadores y resultados)?'))BK.resetAll(state);});
    d.querySelector('#bkaSQL').addEventListener('click',()=>{copy(BK.toSQL(state));toast('SQL copiado al portapapeles');});
    d.querySelector('#bkaExport').addEventListener('click',()=>openIO('export'));
    d.querySelector('#bkaImport').addEventListener('click',()=>openIO('import'));
    document.querySelector('#bkaFac').addEventListener('change',e=>{
      document.querySelector('#bkaCar').style.display=e.target.value==='INGENIERIA'?'':'none';
    });
    renderPool();
  }
  function addToPool(){
    const n=document.querySelector('#bkaName').value.trim();
    if(!n){toast('Escribe un nombre');return;}
    const f=document.querySelector('#bkaFac').value;
    const c=f==='INGENIERIA'?(document.querySelector('#bkaCar').value||null):null;
    const p=pool(); if(p.some(x=>x.n.toLowerCase()===n.toLowerCase())){toast('Ya está en el pool');return;}
    p.push({n,f,c:c||null}); savePool(p);
    document.querySelector('#bkaName').value='';
  }
  async function loadRegistered(){
    if(!(global.SB_ADMIN&&global.SB)){toast('Sin conexión al backend — agrega jugadores manualmente');return;}
    try{
      const regs=await global.SB_ADMIN.fetchAdminRegistrations();
      const p=pool();
      (regs||[]).forEach(r=>{ const n=r.nickname_snapshot||r.nickname; if(n&&!p.some(x=>x.n.toLowerCase()===String(n).toLowerCase())) p.push({n:String(n),f:r.faculty_code||'INGENIERIA',c:r.career_code||null}); });
      savePool(p); toast('Inscritos cargados: '+p.length+' en pool');
    }catch(e){ toast('No autorizado o sin RPC — modo manual'); }
  }
  function renderPool(){
    const box=document.querySelector('#bkaPool'); if(!box) return;
    const asg=state?BK.assignedPlayers(state):new Map();
    const p=pool();
    box.innerHTML=p.length?'':'<div class="note">Pool vacío. Agrega jugadores o carga inscritos.</div>';
    p.forEach((pl,i)=>{
      const el=document.createElement('div'); el.className='pi';
      const lg=BK.logoOf(pl);
      el.innerHTML=(lg?'<img src="'+lg+'" onerror="this.remove()">':'')+'<b>'+BK.esc(pl.n)+'</b>'
        +'<span class="asg">'+(asg.has(pl.n)?asg.get(pl.n):'')+'</span><button title="Quitar" data-i="'+i+'">✕</button>';
      el.querySelector('button').addEventListener('click',()=>{const q=pool();q.splice(i,1);savePool(q);});
      box.appendChild(el);
    });
  }
  function fill(shuffle){
    let p=pool().slice();
    if(!p.length){toast('El pool está vacío');return;}
    if(shuffle){ for(let i=p.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[p[i],p[j]]=[p[j],p[i]];} }
    while(p.length<16)p.push({bye:true});
    BK.fillR16(state,p.slice(0,16));
    toast(shuffle?'Sorteo realizado':'Llave llenada en orden');
  }

  // ── modal (asignar / resultado / io) ──
  function buildModal(){
    modal=document.createElement('div');
    modal.className='bkm'; modal.innerHTML='<div class="panel" id="bkmPanel"></div>';
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
    document.body.appendChild(modal);
  }
  function closeModal(){ modal.classList.remove('show'); }
  function panel(html){ modal.querySelector('#bkmPanel').innerHTML=html; modal.classList.add('show'); }

  function openAssign(mid,side){
    const meta=BK.ROUND_META[mid.split('-')[0]];
    if(mid.split('-')[0]!=='R16'){ toast('Los jugadores de '+meta.label+' llegan solos al ganar. Asigna en octavos.'); return; }
    const asg=BK.assignedPlayers(state);
    const opts=pool().map((p,i)=>{
      const lg=BK.logoOf(p); const used=asg.has(p.n);
      return '<button class="opt" data-pi="'+i+'" '+(used?'style="opacity:.45"':'')+'>'+(lg?'<img src="'+lg+'" onerror="this.remove()">':'')+'<b>'+BK.esc(p.n)+'</b>'+(used?'<small>'+asg.get(p.n)+'</small>':'')+'</button>';
    }).join('');
    panel('<h4>Asignar jugador</h4><div class="sub">'+mid+' · lado '+side.toUpperCase()+'</div>'
      +'<input type="text" id="bkmFilter" placeholder="Filtrar…" style="width:100%;background:#0a0a0e;border:1px solid var(--line2);border-radius:8px;color:var(--text);height:38px;padding:0 10px;outline:none;margin-bottom:8px">'
      +'<div id="bkmOpts">'+ (opts||'<div class="sub">Pool vacío — agrégalos en el panel lateral.</div>') +'</div>'
      +'<div class="foot"><button data-x="bye">BYE</button><button data-x="clear" class="red">Vaciar casilla</button><button data-x="close">Cerrar</button></div>');
    modal.querySelector('#bkmFilter').addEventListener('input',e=>{
      const q=e.target.value.toLowerCase();
      modal.querySelectorAll('#bkmOpts .opt').forEach(o=>{o.style.display=o.textContent.toLowerCase().includes(q)?'':'none';});
    });
    modal.querySelectorAll('#bkmOpts .opt').forEach(o=>o.addEventListener('click',()=>{
      BK.assign(state,mid,side,pool()[+o.dataset.pi]); closeModal();
    }));
    modal.querySelectorAll('.foot button').forEach(b=>b.addEventListener('click',()=>{
      if(b.dataset.x==='bye')BK.assign(state,mid,side,{bye:true});
      if(b.dataset.x==='clear')BK.assign(state,mid,side,null);
      closeModal();
    }));
  }
  function openResult(mid){
    const s=state.slots[mid];
    if(!s.a||!s.b||s.a.bye||s.b.bye){toast('Faltan jugadores en '+mid);return;}
    const meta=BK.ROUND_META[mid.split('-')[0]];
    panel('<h4>Resultado · '+meta.label+'</h4><div class="sub">'+mid+' · mejor de '+meta.bo+' sets</div>'
      +'<div class="who"><span>'+BK.esc(s.a.n)+'</span><span>'+BK.esc(s.b.n)+'</span></div>'
      +'<div class="setrow"><input type="number" id="bkmSA" min="0" max="'+Math.ceil(meta.bo/2)+'" value="'+(s.sa!=null?s.sa:'')+'" placeholder="0"><span>SETS</span><input type="number" id="bkmSB" min="0" max="'+Math.ceil(meta.bo/2)+'" value="'+(s.sb!=null?s.sb:'')+'" placeholder="0"></div>'
      +'<div class="foot"><button data-x="save" class="gold">Guardar</button><button data-x="woa">W.O. → '+BK.esc(s.a.n)+'</button><button data-x="wob">W.O. → '+BK.esc(s.b.n)+'</button><button data-x="clear" class="red">Borrar</button></div>');
    modal.querySelectorAll('.foot button').forEach(b=>b.addEventListener('click',()=>{
      const need=Math.ceil(meta.bo/2);
      if(b.dataset.x==='save'){
        const sa=+modal.querySelector('#bkmSA').value, sb=+modal.querySelector('#bkmSB').value;
        if(isNaN(sa)||isNaN(sb)||sa===sb){toast('Marcador inválido (no puede haber empate)');return;}
        if(Math.max(sa,sb)!==need){toast('El ganador debe llegar a '+need+' sets (mejor de '+meta.bo+')');return;}
        BK.report(state,mid,sa,sb,'PLAYED');
      }
      if(b.dataset.x==='woa')BK.walkover(state,mid,'a');
      if(b.dataset.x==='wob')BK.walkover(state,mid,'b');
      if(b.dataset.x==='clear'){BK.clearResult(state,mid,true);BK.save(state);}
      closeModal();
    }));
  }
  function openIO(mode){
    if(mode==='export'){
      panel('<h4>Exportar borrador</h4><div class="sub">Copia este JSON como respaldo</div><textarea class="bkm-io" readonly>'+BK.esc(JSON.stringify(state))+'</textarea><div class="foot"><button data-x="copy" class="gold">Copiar</button><button data-x="close">Cerrar</button></div>');
      modal.querySelector('[data-x=copy]').addEventListener('click',()=>{copy(JSON.stringify(state));toast('Copiado');});
    } else {
      panel('<h4>Importar borrador</h4><div class="sub">Pega un JSON exportado antes</div><textarea class="bkm-io" id="bkmIn" placeholder="{…}"></textarea><div class="foot"><button data-x="do" class="gold">Importar</button><button data-x="close">Cerrar</button></div>');
      modal.querySelector('[data-x=do]').addEventListener('click',()=>{
        try{ const s=JSON.parse(modal.querySelector('#bkmIn').value); if(!s.slots)throw 0;
          Object.assign(state,s); BK.save(state); toast('Borrador importado'); closeModal();
        }catch(e){ toast('JSON inválido'); }
      });
    }
    modal.querySelectorAll('[data-x=close]').forEach(b=>b.addEventListener('click',closeModal));
  }

  // ── interacción con el bracket/lista ──
  function onClick(e){
    if(!document.body.classList.contains('bk-admin')) return;
    const actBtn=e.target.closest('[data-act]');
    if(actBtn){
      const mid=actBtn.closest('[data-match]').dataset.match;
      const act=actBtn.dataset.act;
      if(act==='assign-a')openAssign(mid,'a');
      if(act==='assign-b')openAssign(mid,'b');
      if(act==='result')openResult(mid);
      if(act==='clear'){BK.clearResult(state,mid,true);BK.save(state);}
      return;
    }
    const chip=e.target.closest('.bk-chip[data-mid]');
    if(chip && chip.closest('#bkStage')){
      const mid=chip.dataset.mid, side=chip.dataset.side;
      if(side==='w') return;
      const s=state.slots[mid];
      if(mid.split('-')[0]==='R16' && !(s.a&&s.b)) openAssign(mid,side);
      else if(s.a&&s.b&&!s.a.bye&&!s.b.bye) openResult(mid);
      else if(mid.split('-')[0]==='R16') openAssign(mid,side);
    }
  }

  // ── util ──
  function copy(t){ try{navigator.clipboard.writeText(t);}catch(e){ const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove(); } }
  let toastEl=null,toastT=null;
  function toast(msg){
    if(!toastEl){ toastEl=document.createElement('div'); toastEl.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:999;background:#26262d;border:1px solid var(--line2);color:var(--text);font-family:var(--disp);font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;padding:10px 18px;border-radius:100px;box-shadow:0 10px 30px rgba(0,0,0,.6);transition:opacity .2s'; document.body.appendChild(toastEl); }
    toastEl.textContent=msg; toastEl.style.opacity='1'; clearTimeout(toastT);
    toastT=setTimeout(()=>{toastEl.style.opacity='0';},2400);
  }

  global.BKADMIN={init,setState,toast};
})(window);
