// ── Motor de bracket v2 (16 jugadores, estilo center-out) ──────────────
// Estado local + render. Fuentes de datos (prioridad):
//   1) Supabase: vista v_public_bracket (cuando sql/BRACKET_ADMIN_V1.sql esté aplicado)
//   2) Borrador local del organizador (localStorage) — demo semi-funcional
//   3) Estructura vacía «Por definir»
(function(global){
  'use strict';
  const LS_KEY = 'fi_bracket_draft_2027_1';
  const R16 = ['R16-1','R16-2','R16-3','R16-4','R16-5','R16-6','R16-7','R16-8'];
  const ORDER = [...R16,'QF-1','QF-2','QF-3','QF-4','SF-1','SF-2','F-1','TP-1'];
  const NEXT = {
    'R16-1':['QF-1','a'],'R16-2':['QF-1','b'],'R16-3':['QF-2','a'],'R16-4':['QF-2','b'],
    'R16-5':['QF-3','a'],'R16-6':['QF-3','b'],'R16-7':['QF-4','a'],'R16-8':['QF-4','b'],
    'QF-1':['SF-1','a'],'QF-2':['SF-1','b'],'QF-3':['SF-2','a'],'QF-4':['SF-2','b'],
    'SF-1':['F-1','a'],'SF-2':['F-1','b']
  };
  const LOSER_NEXT = {'SF-1':['TP-1','a'],'SF-2':['TP-1','b']};
  const ROUND_META = {
    R16:{type:'ROUND_OF_16',label:'Octavos de final',bo:3},
    QF:{type:'QUARTERFINAL',label:'Cuartos de final',bo:3},
    SF:{type:'SEMIFINAL',label:'Semifinal',bo:5},
    F:{type:'FINAL',label:'Final',bo:5},
    TP:{type:'THIRD_PLACE',label:'Tercer lugar',bo:5}
  };
  const COLS = [
    {ids:['R16-1','R16-2','R16-3','R16-4'],cls:'wl'},
    {ids:['QF-1','QF-2'],cls:'wl'},
    {ids:['SF-1'],cls:'wl'},
    'CENTER',
    {ids:['SF-2'],cls:'wr'},
    {ids:['QF-3','QF-4'],cls:'wr'},
    {ids:['R16-5','R16-6','R16-7','R16-8'],cls:'wr'}
  ];
  function roundOf(id){ return id.split('-')[0]; }
  function posOf(id){ return parseInt(id.split('-')[1],10); }
  function emptyState(){
    const slots = {};
    ORDER.forEach(id => slots[id] = {a:null,b:null,sa:null,sb:null,status:'SCHEDULED',w:null});
    return {v:1,published:false,updatedAt:null,slots};
  }
  function load(){
    try{ const raw = localStorage.getItem(LS_KEY); if(raw){ const s = JSON.parse(raw); if(s && s.slots) return s; } }catch(e){}
    return emptyState();
  }
  function save(state){
    state.updatedAt = new Date().toISOString();
    try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){}
    listeners.forEach(fn => fn(state));
  }
  const listeners = [];
  function onChange(fn){ listeners.push(fn); }

  // ── mutaciones ──
  function assign(state,id,side,player){
    const s = state.slots[id];
    s[side] = player;                       // player: {n,f,c}|{bye:true}|null
    clearResult(state,id,true);
    autoBye(state,id);
    save(state);
  }
  function autoBye(state,id){
    const s = state.slots[id];
    const byeSide = s.a&&s.a.bye ? 'a' : s.b&&s.b.bye ? 'b' : null;
    if(byeSide){
      const other = byeSide==='a'?'b':'a';
      if(s[other] && !s[other].bye){ s.w = other; s.status='WALKOVER'; s.sa=null; s.sb=null; propagate(state,id); }
    }
  }
  function report(state,id,sa,sb,status){
    const s = state.slots[id];
    if(!s.a || !s.b || s.a.bye || s.b.bye) return false;
    s.sa = sa; s.sb = sb;
    s.status = status || 'PLAYED';
    s.w = status==='WALKOVER' ? (sa>sb?'a':'b') : (sa===sb?null:(sa>sb?'a':'b'));
    if(!s.w) return false;
    propagate(state,id);
    save(state); return true;
  }
  function walkover(state,id,winSide){
    const s = state.slots[id];
    if(!s.a || !s.b) return false;
    s.sa=null; s.sb=null; s.status='WALKOVER'; s.w=winSide;
    propagate(state,id); save(state); return true;
  }
  function propagate(state,id){
    const s = state.slots[id];
    const win = s.w ? s[s.w] : null;
    const lose = s.w ? s[s.w==='a'?'b':'a'] : null;
    if(NEXT[id]){ const [nid,slot] = NEXT[id]; setIncoming(state,nid,slot,win); }
    if(LOSER_NEXT[id]){ const [nid,slot] = LOSER_NEXT[id]; setIncoming(state,nid,slot,lose); }
  }
  function setIncoming(state,nid,slot,player){
    const t = state.slots[nid];
    const prev = t[slot];
    t[slot] = player ? {...player} : null;
    if(JSON.stringify(prev)!==JSON.stringify(t[slot])) clearResult(state,nid,true);
    if(player) autoBye(state,nid);
  }
  function clearResult(state,id,cascade){
    const s = state.slots[id];
    s.sa=null;s.sb=null;s.status='SCHEDULED';s.w=null;
    if(cascade){
      if(NEXT[id]){ const [nid,slot]=NEXT[id]; if(state.slots[nid][slot]){ state.slots[nid][slot]=null; clearResult(state,nid,true);} }
      if(LOSER_NEXT[id]){ const [nid,slot]=LOSER_NEXT[id]; if(state.slots[nid][slot]){ state.slots[nid][slot]=null; clearResult(state,nid,true);} }
    }
  }
  function resetResults(state){ ORDER.forEach(id=>{const s=state.slots[id];s.sa=null;s.sb=null;s.status='SCHEDULED';s.w=null;});
    ['QF-1','QF-2','QF-3','QF-4','SF-1','SF-2','F-1','TP-1'].forEach(id=>{state.slots[id].a=null;state.slots[id].b=null;});
    save(state); }
  function resetAll(state){ const e=emptyState(); state.slots=e.slots; state.published=false; save(state); }
  function fillR16(state,players){
    const e=emptyState(); state.slots=e.slots;
    players.slice(0,16).forEach((p,i)=>{ const id=R16[Math.floor(i/2)]; state.slots[id][i%2===0?'a':'b']=p; });
    R16.forEach(id=>autoBye(state,id));
    save(state);
  }
  function champion(state){ const f=state.slots['F-1']; return f.w?f[f.w]:null; }
  function assignedPlayers(state){
    const seen=new Map();
    R16.forEach(id=>{['a','b'].forEach(k=>{const p=state.slots[id][k];if(p&&!p.bye)seen.set(p.n,id);});});
    return seen;
  }

  // ── logos ──
  function logoOf(p){
    if(!p||p.bye) return null;
    if(p.c) return 'assets/logos/carreras-fi/'+p.c+'.png';
    if(p.f) return 'assets/logos/facultades/'+p.f+'.svg';
    return null;
  }
  function chipHTML(p,extra,score,mid,side){
    const cls=['bk-chip']; let inner='';
    if(extra) cls.push(extra);
    if(!p){ cls.push('tbd'); inner='<span class="av">?</span><span class="nm">Por definir</span>'; }
    else if(p.bye){ cls.push('bye'); inner='<span class="av">–</span><span class="nm">BYE</span>'; }
    else{
      const lg=logoOf(p);
      inner=(lg?'<img class="lg" src="'+lg+'" alt="" onerror="this.outerHTML=\'<span class=av>'+esc(p.n[0]||'?')+'</span>\'">':'<span class="av">'+esc((p.n||'?')[0])+'</span>')
        +'<span class="nm">'+esc(p.n)+'</span>';
    }
    if(score!=null) inner+='<b class="sc">'+score+'</b>';
    return '<div class="'+cls.join(' ')+'" data-mid="'+mid+'" data-side="'+side+'">'+inner+'</div>';
  }
  function esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function matchHTML(state,id){
    const s=state.slots[id];
    const wA=s.w==='a', wB=s.w==='b';
    const scA=s.status==='WALKOVER'?(wA?'W.O.':'–'):(s.sa!=null?s.sa:null);
    const scB=s.status==='WALKOVER'?(wB?'W.O.':'–'):(s.sb!=null?s.sb:null);
    return '<div class="bk-match" data-match="'+id+'"><span class="tag">'+id+'</span>'
      +chipHTML(s.a,wA?'win':(wB?'lose':null),scA,id,'a')
      +chipHTML(s.b,wB?'win':(wA?'lose':null),scB,id,'b')+'</div>';
  }
  function renderStage(container,state,opts){
    opts=opts||{};
    const champ=champion(state);
    const f=state.slots['F-1'], tp=state.slots['TP-1'];
    let html='<div class="bk-rlabels"><span>Octavos</span><span>Cuartos</span><span>Semifinal</span><span class="c">'+(opts.centerLabel||'Gran final')+'</span><span>Semifinal</span><span>Cuartos</span><span>Octavos</span></div><div class="bk-grid">';
    COLS.forEach(col=>{
      if(col==='CENTER'){
        html+='<div class="bk-center">'
          +'<div class="bk-champ"><div class="lbl">Campeón<small>'+(opts.editionLabel||'FI · 2027-1')+'</small></div>'
          +chipHTML(champ, champ?'champ':null, null,'F-1','w')+'</div>'
          +'<div class="bk-final"><div class="fl">La Final</div>'
          +chipHTML(f.a, f.w==='a'?'win':(f.w==='b'?'lose':null), f.status==='WALKOVER'?(f.w==='a'?'W.O.':'–'):(f.sa!=null?f.sa:null),'F-1','a')
          +chipHTML(f.b, f.w==='b'?'win':(f.w==='a'?'lose':null), f.status==='WALKOVER'?(f.w==='b'?'W.O.':'–'):(f.sb!=null?f.sb:null),'F-1','b')+'</div>'
          +'<div class="bk-bronze"><div class="fl">Tercer lugar</div>'
          +chipHTML(tp.a, tp.w==='a'?'win':(tp.w==='b'?'lose':null), tp.status==='WALKOVER'?(tp.w==='a'?'W.O.':'–'):(tp.sa!=null?tp.sa:null),'TP-1','a')
          +chipHTML(tp.b, tp.w==='b'?'win':(tp.w==='a'?'lose':null), tp.status==='WALKOVER'?(tp.w==='b'?'W.O.':'–'):(tp.sb!=null?tp.sb:null),'TP-1','b')+'</div>'
          +'<div class="bk-trophy"><img src="assets/piggy-gold.png?v=15" alt="Trofeo puerquito dorado"></div></div>';
      } else {
        html+='<div class="bk-col '+col.cls+'">'+col.ids.map(id=>matchHTML(state,id)).join('')+'</div>';
      }
    });
    container.innerHTML=html+'</div>';
  }
  function renderList(container,state){
    const groups=[['R16','Octavos de final',R16],['QF','Cuartos de final',['QF-1','QF-2','QF-3','QF-4']],['SF','Semifinales',['SF-1','SF-2']],['F','Final',['F-1']],['TP','Tercer lugar',['TP-1']]];
    let html='';
    groups.forEach(([k,label,ids])=>{
      html+='<div class="bkl-round"><h4>'+label+' · Mejor de '+ROUND_META[k].bo+'</h4>';
      ids.forEach(id=>{
        const s=state.slots[id];
        const stTxt=s.status==='PLAYED'?'Jugado':s.status==='WALKOVER'?'Walkover':(s.a&&s.b?'Programado':'Pendiente');
        const stCls=s.status==='PLAYED'?'ok':s.status==='WALKOVER'?'wo':'';
        const sc=s.sa!=null?s.sa+' – '+s.sb:(s.status==='WALKOVER'?'W.O.':'vs');
        html+='<div class="bkl-row" data-match="'+id+'">'
          +'<span class="pos">'+id+'</span>'
          +plHTML(s.a,s.w==='a',s.w==='b'?'lose':null)
          +'<div class="sc">'+sc+'<small>sets</small></div>'
          +plHTML(s.b,s.w==='b',s.w==='a'?'lose rt':'rt')
          +'<span class="st '+stCls+'">'+stTxt+'</span>'
          +'<div class="acts"><button data-act="assign-a">Jug. A</button><button data-act="assign-b">Jug. B</button><button data-act="result" class="gold">Resultado</button><button data-act="clear">Limpiar</button></div>'
          +'</div>';
      });
      html+='</div>';
    });
    container.innerHTML=html;
  }
  function plHTML(p,win,extra){
    const cls=['pl']; if(extra)cls.push(extra);
    if(!p){cls.push('tbd');return '<div class="'+cls.join(' ')+'"><b>Por definir</b></div>';}
    if(p.bye){cls.push('tbd');return '<div class="'+cls.join(' ')+'"><b>BYE</b></div>';}
    if(win)cls.push('win');
    const lg=logoOf(p);
    return '<div class="'+cls.join(' ')+'">'+(lg?'<img src="'+lg+'" alt="" onerror="this.remove()">':'')+'<b>'+esc(p.n)+'</b></div>';
  }

  // ── Supabase (lectura pública) ──
  async function fetchPublished(){
    if(!global.SB) return null;
    try{
      const {data,error}=await global.SB.from('v_public_bracket')
        .select('round_type,bracket_position,player_a,faculty_a,career_a,player_b,faculty_b,career_b,sets_a,sets_b,status,winner_side')
        .order('bracket_position');
      if(error||!data||!data.length) return null;
      const st=emptyState(); st.published=true;
      const KEY={ROUND_OF_16:'R16',QUARTERFINAL:'QF',SEMIFINAL:'SF',FINAL:'F',THIRD_PLACE:'TP'};
      data.forEach(r=>{
        const k=KEY[r.round_type]; if(!k) return;
        const id=k+'-'+r.bracket_position, s=st.slots[id]; if(!s) return;
        s.a=r.player_a?{n:r.player_a,f:r.faculty_a,c:r.career_a}:null;
        s.b=r.player_b?{n:r.player_b,f:r.faculty_b,c:r.career_b}:null;
        s.sa=r.sets_a; s.sb=r.sets_b; s.status=r.status||'SCHEDULED';
        s.w=r.winner_side==='A'?'a':r.winner_side==='B'?'b':null;
      });
      return st;
    }catch(e){ return null; }
  }
  // Histórico → mismo formato de estado
  function stateFromRounds(rounds){
    const st=emptyState(); st.published=true;
    const KEY={R16:'R16',QF:'QF',SF:'SF',F:'F','3P':'TP'};
    (rounds||[]).forEach(r=>{
      const k=KEY[r.key]; if(!k) return;
      (r.slots||[]).forEach((m,i)=>{
        const id=k+'-'+(i+1), s=st.slots[id]; if(!s) return;
        s.a=m.a&&m.a!=='BYE'?{n:m.a}:(m.a==='BYE'?{bye:true}:null);
        s.b=m.b&&m.b!=='BYE'?{n:m.b}:(m.b==='BYE'?{bye:true}:null);
        s.sa=m.score_a!=null?m.score_a:null; s.sb=m.score_b!=null?m.score_b:null;
        s.status=m.status==='PLAYED'||m.score_a!=null?'PLAYED':(m.status||'SCHEDULED');
        s.w=m.winner?(m.winner===m.a?'a':m.winner===m.b?'b':null):null;
      });
    });
    return st;
  }
  // SQL export del borrador
  function toSQL(state){
    const L=['-- Generado por el modo organizador · '+new Date().toISOString(),
      '-- 1) Reemplaza :EDCAT por el edition_category_id real y los <REG:*> por registration_id (uuid).',
      '-- 2) Requiere sql/BRACKET_ADMIN_V1.sql aplicado.','',
      "select admin_bracket_scaffold(:EDCAT, 16, true);",''];
    R16.forEach(id=>{const s=state.slots[id];['a','b'].forEach((k,i)=>{const p=s[k];
      if(p&&!p.bye) L.push("select admin_bracket_assign(:EDCAT, 'ROUND_OF_16', "+posOf(id)+", "+(i+1)+", '<REG:"+p.n.replace(/'/g,"''")+">');");
      if(p&&p.bye)  L.push("select admin_bracket_set_bye(:EDCAT, 'ROUND_OF_16', "+posOf(id)+", "+(i+1)+");");});});
    L.push('');
    ORDER.forEach(id=>{const s=state.slots[id];const meta=ROUND_META[roundOf(id)];
      if(s.status==='PLAYED'&&s.sa!=null) L.push("select admin_bracket_report(:EDCAT, '"+meta.type+"', "+posOf(id)+", "+s.sa+", "+s.sb+", 'PLAYED');");
      if(s.status==='WALKOVER'&&s.w&&s.a&&s.b&&!s.a.bye&&!s.b.bye) L.push("select admin_bracket_report(:EDCAT, '"+meta.type+"', "+posOf(id)+", "+(s.w==='a'?1:0)+", "+(s.w==='b'?1:0)+", 'WALKOVER');");});
    L.push('','select admin_bracket_publish(:EDCAT, '+(state.published?'true':'false')+');');
    return L.join('\n');
  }

  global.BKV2={LS_KEY,ORDER,R16,NEXT,LOSER_NEXT,ROUND_META,emptyState,load,save,onChange,assign,report,walkover,clearResult,resetResults,resetAll,fillR16,champion,assignedPlayers,renderStage,renderList,fetchPublished,stateFromRounds,toSQL,esc,logoOf};
})(window);
