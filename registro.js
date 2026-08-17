// ── Registro · wizard principal ─────────────────────────────────────────
// Maneja:
// • Navegación por pasos con validación
// • Persistencia automática del progreso (draft)
// • Lógica condicional (torneo previo, experiencia formal)
// • Cálculo de categoría provisional (registro-scoring.js)
// • Envío (registro-storage.js → RPC preinscribir vía registro-bridge.js)
//
// NO hay lista local de preinscritos ni exportación CSV en esta página: el
// padrón real vive en Supabase y se consulta en Admin.html. localStorage solo
// guarda el borrador, el submission_id, la recuperación y el folio.

(function(){
  const CFG = window.REGISTRO_CONFIG;
  const STORAGE = window.REGISTRO_STORAGE;
  const SCORING = window.REGISTRO_SCORING;

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  // Compatibilidad: borradores viejos en localStorage pueden traer códigos
  // abreviados. El formulario nuevo SIEMPRE escribe los codes reales de la
  // BD; esto solo normaliza lo que ya estaba guardado en el navegador.
  const LEGACY_CODE_MAP = {
    faculty: {
      FCA: 'CONTADURIA_ADMINISTRACION',
      FILOSOFIA: 'FILOSOFIA_LETRAS',
      VETERINARIA: 'MEDICINA_VETERINARIA_ZOOTECNIA',
      POLITICAS: 'CIENCIAS_POLITICAS_SOCIALES',
      OTRA: 'EXTERNO'
    },
    career: {
      ELECTRICA: 'ELECTRICA_ELECTRONICA',
      MINAS: 'MINAS_METALURGIA',
      TELECOM: 'TELECOMUNICACIONES'
    }
  };
  function normalizeLegacyCode(kind, code){
    const map = LEGACY_CODE_MAP[kind] || {};
    return map[code] || code;
  }

  const form = $('#regForm');
  const steps = $$('.step[data-step-panel]');
  const dots  = $$('.step-dot');
  const bar   = $('#stepBar');
  const btnPrev = $('#btnPrev');
  const btnNext = $('#btnNext');
  const btnSubmit = $('#btnSubmit');
  const TOTAL = steps.length;

  // — Etiquetas legibles —
  const LABELS = {
    faculty: {
      INGENIERIA:'Facultad de Ingeniería', ARQUITECTURA:'Facultad de Arquitectura',
      CIENCIAS:'Facultad de Ciencias', QUIMICA:'Facultad de Química',
      MEDICINA:'Facultad de Medicina', ODONTOLOGIA:'Facultad de Odontología',
      MEDICINA_VETERINARIA_ZOOTECNIA:'Facultad de Medicina Veterinaria y Zootecnia',
      PSICOLOGIA:'Facultad de Psicología', DERECHO:'Facultad de Derecho',
      ECONOMIA:'Facultad de Economía', CONTADURIA_ADMINISTRACION:'Facultad de Contaduría y Administración',
      FILOSOFIA_LETRAS:'Facultad de Filosofía y Letras', CIENCIAS_POLITICAS_SOCIALES:'Facultad de Ciencias Políticas y Sociales',
      EXTERNO:'Otra'
    },
    experienceDuration: { NEVER:'Apenas comienzo', UNDER_6M:'Menos de 6 meses', SIX_TO_18M:'6 a 18 meses', OVER_18M:'Más de 18 meses' },
    playFrequency: { RARELY:'< 1 vez al mes', MONTHLY:'Varias veces al mes', WEEKLY:'1 vez por semana', MULTI_WEEKLY:'2+ por semana' },
    selfReportedLevel: { NEVER:'Nunca he jugado', PRINCIPIANTE:'Principiante', INTERMEDIO:'Intermedio', AVANZADO_OPEN:'Avanzado / Open', UNSURE:'No estoy seguro' },
    experience: { EXP_NONE:'Nunca he jugado', EXP_LT6M:'Menos de 6 meses', EXP_6M_1Y:'Entre 6 meses y 1 año', EXP_GT1Y:'Más de 1 año' },
    frequency: { NUNCA:'Nunca o casi nunca', MONTHLY:'Algunas veces al mes', WEEKLY:'1 o 2 veces por semana', FREQUENT:'3 o más veces por semana' },
    rallyLength: { R0_3:'0 a 3 golpes seguidos', R4_7:'4 a 7 golpes seguidos', R8_15:'8 a 15 golpes seguidos', R16P:'16 golpes o más', UNSURE:'No está seguro' },
    privateTraining: { NONE:'Sin entrenamiento', LT1M:'Menos de 1 mes', GE1M:'1 mes o más' },
    techniques: { RALLY:'Peloteo básico', SERVE:'Saque con efecto', CHOP:'Corte / chop', ATTACK:'Ataque ocasional', TOPSPIN:'Topspin' },
    skills: {
      controlledRally:'Intercambio controlado', directedServe:'Saque dirigido',
      spinServe:'Saque con efecto', spinReceive:'Recepción con efecto',
      topspinBlockAttack:'Topspin / ataque'
    },
    tournamentExperience: {
      NEVER:'Sin torneos', CASUAL:'Casual/escolar', REACHED_KNOCKOUTS:'Avanzó a eliminatorias',
      REACHED_FINALS:'Semi/final/ganador', FORMAL_CLUB:'Representativo/club/liga'
    },
    // BEGINNER/NOVATO son datos históricos: se muestran como Principiante.
    prevCategory: { BEGINNER:'Principiante', NOVATO:'Principiante', PRINCIPIANTE:'Principiante', INTERMEDIO:'Intermedio', AVANZADO:'Avanzado / Open', AVANZADO_OPEN:'Avanzado / Open', UNKNOWN:'No recuerda', OTHER:'Otra' },
    prevResult: { NO_GROUP_PASS:'No pasó grupos', GROUP_PASS:'Clasificó de grupos', REPECHAGE:'Repechaje',
      R16:'Octavos', QF:'Cuartos', SEMIFINAL:'Semifinal', FINALIST:'Finalista', CHAMPION:'Campeón', OTHER:'Otra' }
  };

  let current = 0;
  let submitting = false;

  // ─────────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────────
  function init(){
    // hamburger
    hamburger();

    // teléfono format
    $('#f-phone').addEventListener('input', e => {
      let d = e.target.value.replace(/\D/g,'').slice(0,10);
      if (d.length > 6) d = `${d.slice(0,2)} ${d.slice(2,6)} ${d.slice(6)}`;
      else if (d.length > 2) d = `${d.slice(0,2)} ${d.slice(2)}`;
      e.target.value = d;
    });

    // limpiar errores al interactuar
    form.addEventListener('input', clearLocalError);
    form.addEventListener('change', clearLocalError);

    // condicional torneo previo
    $$('input[name="participatedPreviously"]').forEach(r => {
      r.addEventListener('change', () => {
        $('#condPrev').classList.toggle('show', form.participatedPreviously.value === 'YES');
        scheduleDraft();
      });
    });

    // técnicas: "Ninguna" es excluyente con las demás
    $$('input[name="techniques"]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.value === 'NONE' && cb.checked){
          $$('input[name="techniques"]').forEach(o => { if (o.value !== 'NONE') o.checked = false; });
        } else if (cb.value !== 'NONE' && cb.checked){
          const none = $('input[name="techniques"][value="NONE"]');
          if (none) none.checked = false;
        }
      });
    });

    // representativo: si "Sí", se omiten las demás preguntas de nivel
    $$('input[name="representative"]').forEach(r => {
      r.addEventListener('change', () => { toggleLevelRest(); scheduleDraft(); });
    });

    // navegación
    btnPrev.addEventListener('click', () => goTo(current - 1));
    btnNext.addEventListener('click', () => {
      if (!validateStep(current)) return;
      goTo(current + 1);
    });
    dots.forEach(d => d.addEventListener('click', () => {
      const idx = +d.dataset.step;
      if (idx <= current) goTo(idx);
      else {
        // permitir saltar adelante sólo si todos los pasos previos válidos
        let ok = true;
        for (let i=current;i<idx;i++) { if (!validateStep(i, /*silent*/ false)) { ok = false; break; } }
        if (ok) goTo(idx);
      }
    }));

    // botones "Editar" del paso 5
    $$('.rv-edit').forEach(b => b.addEventListener('click', () => goTo(+b.dataset.go)));

    // submit
    form.addEventListener('submit', onSubmit);


    // reglamento modal
    $('#openRules')?.addEventListener('click', e => { e.preventDefault(); if (window.REGLAS_TORNEO){ window.REGLAS_TORNEO.open(); } else { $('#rulesModal').classList.add('show'); } });
    $('#rulesClose')?.addEventListener('click', () => $('#rulesModal').classList.remove('show'));
    $('#rulesModal')?.addEventListener('click', e => { if (e.target.id === 'rulesModal') e.currentTarget.classList.remove('show'); });

    // términos y condiciones modal
    $('#openTerms')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); $('#termsModal').classList.add('show'); });
    $('#termsClose')?.addEventListener('click', () => $('#termsModal').classList.remove('show'));
    $('#termsModal')?.addEventListener('click', e => { if (e.target.id === 'termsModal') e.currentTarget.classList.remove('show'); });
    $('#openRulesFromTerms')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (window.REGLAS_TORNEO){ window.REGLAS_TORNEO.open(); } else { $('#rulesModal').classList.add('show'); } });

    $('#copyFolio')?.addEventListener('click', copyFolio);

    // overlay close on backdrop click
    $('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') e.currentTarget.classList.remove('show'); });

    // ESC para cerrar modales
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape'){
        $('#rulesModal').classList.remove('show');
        $('#termsModal').classList.remove('show');
      }
    });

    // restaurar borrador
    restoreDraft();
    // auto-save mientras se escribe
    form.addEventListener('input', scheduleDraft);
    form.addEventListener('change', scheduleDraft);
  }

  // ─────────────────────────────────────────────────────────────────
  // NAVEGACIÓN
  // ─────────────────────────────────────────────────────────────────
  function goTo(idx){
    if (idx < 0 || idx >= TOTAL) return;
    current = idx;
    steps.forEach((s, i) => s.classList.toggle('show', i === idx));
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === idx);
      d.classList.toggle('done', i < idx);
      d.setAttribute('aria-selected', i === idx ? 'true' : 'false');
    });
    bar.style.width = ((idx + 1) / TOTAL * 100) + '%';
    btnPrev.disabled = idx === 0;
    btnNext.style.display = idx === TOTAL - 1 ? 'none' : 'inline-flex';
    btnSubmit.style.display = idx === TOTAL - 1 ? 'inline-flex' : 'none';
    if (idx === TOTAL - 1) renderReview();
    window.scrollTo({ top: 0, behavior:'smooth' });
  }

  // ─────────────────────────────────────────────────────────────────
  // VALIDACIÓN
  // ─────────────────────────────────────────────────────────────────
  function clearLocalError(e){
    const f = e.target.closest('[data-field]');
    if (f){
      f.classList.remove('invalid');
      f.querySelector('[data-opts]')?.classList.remove('invalid');
      f.querySelector('[data-multi]')?.classList.remove('invalid');
    }
  }
  function clearStepErrors(stepIdx){
    steps[stepIdx].querySelectorAll('[data-field]').forEach(f => f.classList.remove('invalid'));
    steps[stepIdx].querySelectorAll('[data-opts],[data-multi]').forEach(o => o.classList.remove('invalid'));
  }

  function validateStep(idx, scroll = true){
    clearStepErrors(idx);
    let firstBad = null;
    const fail = (el) => { el.classList.add('invalid'); if (!firstBad) firstBad = el; };

    if (idx === 0){
      const f = form;
      const display = f.displayName.value.trim();
      if (display.length < 2 || display.length > 60) fail($('[data-field="displayName"]'));
      const tel = f.phone.value.replace(/\D/g,'');
      if (tel.length !== 10) fail($('[data-field="phone"]'));
      const email = f.email ? f.email.value.trim() : '';
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail($('[data-field="email"]'));
      if (!f.faculty.value) fail($('[data-field="faculty"]'));
      if (f.faculty.value === 'INGENIERIA' && f.career && !f.career.value) fail($('[data-field="career"]'));
    }
    if (idx === 1){
      if (!form.representative || !form.representative.value){
        const el = $('[data-field="representative"]'); fail(el); el.querySelector('[data-opts]')?.classList.add('invalid');
      }
      // Si NO es del representativo, valida el resto de preguntas de nivel
      if (form.representative && form.representative.value !== 'YES'){
        ['privateTraining','playingExperience','frequency','rallyLength','participatedPreviously'].forEach(name => {
          const fl = form[name];
          if (!fl || !fl.value){
            const el = $(`[data-field="${name}"]`);
            fail(el);
            el.querySelector('[data-opts]')?.classList.add('invalid');
          }
        });
        if (!$$('input[name="techniques"]:checked').length){
          const el = $('[data-field="techniques"]');
          fail(el);
          el.querySelector('[data-opts]')?.classList.add('invalid');
        }
      }
    }
    if (idx === 2){
      $$('.consent[data-consent]').forEach(c => {
        c.classList.remove('invalid');
        const cb = c.querySelector('input');
        if (!cb.checked) { c.classList.add('invalid'); if (!firstBad) firstBad = c; }
      });
    }

    if (firstBad && scroll) firstBad.scrollIntoView({ block:'center', behavior:'smooth' });
    return !firstBad;
  }

  // ─────────────────────────────────────────────────────────────────
  // RECOLECCIÓN DEL ESTADO
  // ─────────────────────────────────────────────────────────────────
  function collect(){
    const f = form;
    const prevPlayed = pickRadio('participatedPreviously') === 'YES';

    const state = {
      displayName: f.displayName.value.trim(),
      fullName:    f.fullName ? f.fullName.value.trim() : '',
      phone:       '+52' + f.phone.value.replace(/\D/g,''),
      email:       f.email ? f.email.value.trim() : '',
      academicStage: f.faculty.value,
      career:        (f.faculty.value === 'INGENIERIA' && f.career) ? f.career.value : '',

      playingExperience: pickRadio('playingExperience'),
      frequency:   pickRadio('frequency'),
      rallyLength: pickRadio('rallyLength'),
      privateTraining: pickRadio('privateTraining'),
      techniques:  $$('input[name="techniques"]:checked').map(i => i.value).filter(v => v !== 'NONE'),
      representative: pickRadio('representative') === 'YES',

      participatedPreviously: prevPlayed,
      previousTournament: prevPlayed ? {
        category: f.prevCategory ? f.prevCategory.value : '',
        result:   f.prevResult ? f.prevResult.value : '',
        nickname: f.prevNickname ? f.prevNickname.value.trim() : ''
      } : null
    };

    state.timezone = CFG.timezone;
    return state;
  }
  function pickRadio(name){
    const el = form[name];
    if (!el) return '';
    return el.value || '';
  }

  // ─────────────────────────────────────────────────────────────────
  // REVIEW (paso 5)
  // ─────────────────────────────────────────────────────────────────
  function renderReview(){
    const s = collect();
    const sc = SCORING.computeProvisional(s);

    const prev = s.previousTournament;
    $('#rvPersonal').innerHTML = `
      <div class="rv-item"><small>Apodo</small><b>${esc(s.displayName) || '—'}</b></div>
      <div class="rv-item"><small>Teléfono</small><b>${maskPhone(s.phone)}</b></div>
      <div class="rv-item"><small>Facultad</small><b>${LABELS.faculty[s.academicStage] || '—'}</b></div>
    `;

    const rvCat = $('#rvCat');
    const rvLab = $('#rvCatLabel');
    const dot = rvCat.querySelector('.rv-dot');
    rvLab.textContent = SCORING.categoryLabel(sc.category);
    rvCat.style.borderColor = SCORING.categoryColor(sc.category);
    rvCat.style.background  = hexToRgba(SCORING.categoryColor(sc.category), 0.10);
    rvLab.style.color = SCORING.categoryColor(sc.category);
    dot.style.background = SCORING.categoryColor(sc.category);
    $('#rvCatNote').innerHTML = sc.requiresManualReview
      ? `Tu registro pasará a <b style="color:var(--amber)">revisión</b> por la organización antes del sorteo.`
      : 'La organización podrá ajustar tu categoría si tu nivel real no coincide.';

    const rvReasons = $('#rvReasons');
    rvReasons.innerHTML = '';
    sc.reasons.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r;
      rvReasons.appendChild(li);
    });
    (sc.flags || []).forEach(f => {
      const li = document.createElement('li');
      li.className = 'flag';
      li.textContent = 'Requiere revisión: ' + f.label;
      rvReasons.appendChild(li);
    });

    const expLabel = LABELS.experience[SCORING.normalizeExperience(s.playingExperience)] || '—';
    const techLabels = SCORING.normalizeTechniques(s.techniques).map(t => LABELS.techniques[t] || t);
    const prevLine = s.participatedPreviously
      ? [(LABELS.prevCategory[prev?.category] || '—'), (LABELS.prevResult[prev?.result] || '—'), (prev?.nickname || null)].filter(Boolean).join(' · ')
      : 'No jugó';
    $('#rvLevel').innerHTML = s.representative ? `
      <div class="rv-item"><small>Representativo</small><b>Sí · Avanzado / Open (pala de madera)</b></div>
      <div class="rv-item"><small>Torneo pasado</small><b>${esc(prevLine)}</b></div>
    ` : `
      <div class="rv-item"><small>Entrenamiento formal</small><b>${LABELS.privateTraining[s.privateTraining] || '—'}</b></div>
      <div class="rv-item"><small>Experiencia jugando</small><b>${expLabel}</b></div>
      <div class="rv-item"><small>Frecuencia</small><b>${LABELS.frequency[s.frequency] || '—'}</b></div>
      <div class="rv-item"><small>Peloteo</small><b>${LABELS.rallyLength[s.rallyLength] || '—'}</b></div>
      <div class="rv-item"><small>Recursos técnicos</small><b>${techLabels.length ? esc(techLabels.join(', ')) : 'Ninguno'}</b></div>
      <div class="rv-item"><small>Torneo pasado</small><b>${esc(prevLine)}</b></div>
    `;
  }

  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }
  function maskPhone(p){
    const d = String(p || '').replace(/\D/g,'');
    if (d.length < 6) return '—';
    return '+52 •• •••• ' + d.slice(-4);
  }
  function hexToRgba(hex, a){
    const h = hex.replace('#','');
    const n = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
    const r = (n>>16)&255, g = (n>>8)&255, b = n&255;
    return `rgba(${r},${g},${b},${a})`;
  }

  // ─────────────────────────────────────────────────────────────────
  // SUBMIT
  // ─────────────────────────────────────────────────────────────────
  async function onSubmit(e){
    e.preventDefault();
    if (submitting) return;

    // validar todos los pasos primero
    for (let i=0;i<TOTAL;i++){
      if (!validateStep(i, /*scroll*/ false)){
        goTo(i);
        toast('Faltan datos por completar.', 'err');
        return;
      }
    }

    submitting = true;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" class="spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Enviando…';

    try {
      const state = collect();
      const sc = SCORING.computeProvisional(state);
      const payload = {
        ...state,
        provisionalScore: sc.score,
        provisionalCategory: sc.category,
        requiresManualReview: sc.requiresManualReview,
        provisionalReasons: sc.reasons,
        provisionalFlags: sc.flags,
        provisionalWoodPaddle: sc.woodPaddle,
        consents: {
          truthfulAnswers: true,
          categoryAdjustment: true,
          paymentRequired: true,
          registrationDeadline: true,
          contactUse: true,
          rulesAccepted: true
        }
      };
      const res = await STORAGE.submit(payload);

      // tarjeta de éxito
      $('#tkName').textContent = state.displayName;
      $('#tkFolio').textContent = res.folio;
      $('#tkCat').textContent = SCORING.categoryLabel(sc.category);
      $('#tkCat').style.color = SCORING.categoryColor(sc.category);
      $('#tkDate').textContent = new Date(res.createdAt).toLocaleString('es-MX', { dateStyle:'medium', timeStyle:'short' });
      // El grupo de WhatsApp aún no existe: si el enlace sigue marcado como
      // pendiente en registro-config.js, el botón se oculta en lugar de
      // mandar a la gente a una URL inventada.
      const waBtn = $('#waLink');
      const waPending = !CFG.whatsappUrl || (CFG.pending && CFG.pending.whatsappUrl === true);
      if (waBtn){
        if (waPending){ waBtn.style.display = 'none'; waBtn.removeAttribute('href'); }
        else { waBtn.style.display = ''; waBtn.href = CFG.whatsappUrl; }
      }
      const msg = sc.requiresManualReview
        ? `Tu categoría provisional es <b>${SCORING.categoryLabel(sc.category)}</b>, pero pasará a <b>revisión</b> por la organización. Tu lugar se confirma con el pago.`
        : `Tu categoría provisional es <b>${SCORING.categoryLabel(sc.category)}</b>. Recuerda que tu lugar quedará confirmado después del pago.`;
      let okHtml = msg;
      if (res.idempotent){
        okHtml = `Ya teníamos registrada esta preinscripción — no se duplicó. Tu folio sigue siendo válido.`;
      } else if (res.entry_status === 'LATE_REGISTERED'){
        okHtml = `Tu preinscripción fue recibida como <b>registro tardío</b> porque el sorteo inicial ya se realizó. La organización te contactará para informarte si se abre un nuevo grupo.`;
      } else if (res.entry_status === 'WAITING_FOR_LATE_GROUP'){
        okHtml = `Tu preinscripción quedó en <b>lista de espera</b> para un grupo adicional. La organización te contactará.`;
      } else if (res.requires_review){
        okHtml = `Tu preinscripción fue recibida y pasará a <b>revisión</b> por la organización (nivel/club declarado). Tu lugar se confirma con el pago.`;
      }
      $('#okMsg').innerHTML = okHtml;
      $('#overlay').classList.add('show');

      STORAGE.clearDraft();
      toast('Preinscripción enviada · folio ' + res.folio, 'ok');
    } catch(err){
      if (err && err.code === 'DUPLICATE'){
        toast('Ya hay una preinscripción reciente con este teléfono.', 'err');
      } else {
        console.error(err && err.original ? err.original : err);
        toast((err && err.friendly) || 'Error al enviar. Tus datos siguen guardados, intenta de nuevo.', 'err');
      }
    } finally {
      submitting = false;
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5L20 6"/></svg> Enviar preinscripción';
    }
  }

  function copyFolio(){
    const folio = $('#tkFolio').textContent;
    navigator.clipboard?.writeText(folio).then(() => toast('Folio copiado', 'ok'));
  }

  // ─────────────────────────────────────────────────────────────────
  // DRAFT (persistencia automática)
  // ─────────────────────────────────────────────────────────────────
  let draftTimer = null;
  function scheduleDraft(){
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try { STORAGE.saveDraft(collect()); } catch(_){}
    }, 350);
  }
  function restoreDraft(){
    const d = STORAGE.loadDraft();
    if (!d) return;
    const f = form;
    if (d.displayName) f.displayName.value = d.displayName;
    if (d.fullName && f.fullName) f.fullName.value = d.fullName;
    if (d.phone){
      const raw = String(d.phone).replace(/\D/g,'').slice(-10);
      let v = raw;
      if (v.length > 6) v = `${v.slice(0,2)} ${v.slice(2,6)} ${v.slice(6)}`;
      else if (v.length > 2) v = `${v.slice(0,2)} ${v.slice(2)}`;
      f.phone.value = v;
    }
    if (d.email && f.email) f.email.value = d.email;
    if (d.academicStage) f.faculty.value = normalizeLegacyCode('faculty', d.academicStage);
    if (d.career && f.career) f.career.value = normalizeLegacyCode('career', d.career);
    setRadio('playingExperience', SCORING.normalizeExperience(d.playingExperience || d.experience));
    setRadio('frequency', d.frequency);
    setRadio('rallyLength', d.rallyLength);
    setRadio('privateTraining', d.privateTraining);
    SCORING.normalizeTechniques(d.techniques).forEach(v => { const c = $(`input[name="techniques"][value="${v}"]`); if (c) c.checked = true; });
    if (d.representative === true) setRadio('representative','YES');
    else if (d.representative === false) setRadio('representative','NO');
    toggleLevelRest();
    setRadio('participatedPreviously', d.participatedPreviously ? 'YES' : (d.participatedPreviously === false ? 'NO' : ''));
    $('#condPrev').classList.toggle('show', !!d.participatedPreviously);
    if (d.previousTournament){
      if (f.prevCategory) f.prevCategory.value = d.previousTournament.category || '';
      if (f.prevResult)   f.prevResult.value   = d.previousTournament.result || '';
      if (f.prevNickname) f.prevNickname.value = d.previousTournament.nickname || '';
    }
  }
  function setRadio(name, value){
    if (!value) return;
    const r = $(`input[name="${name}"][value="${value}"]`);
    if (r) r.checked = true;
  }
  function toggleLevelRest(){
    const rep = form.representative ? form.representative.value : '';
    const rest = $('#levelRest');
    if (rest) rest.classList.toggle('hidden', rep === 'YES');
  }

  // ─────────────────────────────────────────────────────────────────
  // UI helpers
  // ─────────────────────────────────────────────────────────────────
  function toast(msg, kind){
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show ' + (kind || '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 3200);
  }
  function hamburger(){
    const btn = $('#hambBtn'), menu = $('#mobileMenu');
    if (!btn || !menu) return;
    btn.addEventListener('click', () => {
      const open = btn.classList.toggle('open');
      menu.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open);
      menu.setAttribute('aria-hidden', !open);
    });
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      btn.classList.remove('open'); menu.classList.remove('open');
      btn.setAttribute('aria-expanded','false'); menu.setAttribute('aria-hidden','true');
    }));
  }

  // Spinner CSS
  const css = document.createElement('style');
  css.textContent = '.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(1turn)}}';
  document.head.appendChild(css);

  // ─── start ───
  init();
})();
