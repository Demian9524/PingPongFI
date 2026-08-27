// ── Hero de la página pública: imágenes y capas (ControlTorneo.html) ──
// Cada slide del hero tiene dos capas: fondo y persona. Aquí se cambia la
// imagen de cada una (biblioteca de /assets o cualquier URL) y se decide qué
// capas se muestran: ambas, solo fondo, solo persona o ninguna — en ese
// último caso el slide se salta por completo en la rotación.
// La config vive en hero-config.js (localStorage 'torneo_hero_cfg_v1' +
// Supabase site_settings), la misma que lee Pagina Torneo.html.
(function(global){
  'use strict';
  const STATES = [
    { id:'both',   label:'Ambos',   title:'Se muestran el fondo y la persona.' },
    { id:'bg',     label:'Fondo',   title:'Solo el fondo; la persona no aparece.' },
    { id:'person', label:'Persona', title:'Solo la persona, sin fondo.' },
    { id:'none',   label:'Nada',    title:'El slide se salta: no entra a la rotación del hero.' }
  ];

  function opts(list, current){
    const known = list.some(x => x.src === current);
    return list.map(x => '<option value="' + x.src + '"' + (x.src === current ? ' selected' : '') + '>' + x.label + '</option>').join('') +
      '<option value="__url"' + (known ? '' : ' selected') + '>URL personalizada…</option>';
  }

  function mount(){
    const host = document.getElementById('heroAdmBody');
    if (!host || !global.HERO_CFG) return;
    const sect = document.getElementById('heroAdmSect');
    if (sect) sect.style.display = '';
    const CFG = global.HERO_CFG;
    let slides = CFG.read();

    function save(){
      CFG.write(slides);
    }

    function renderRow(s, i){
      const row = document.createElement('div');
      row.className = 'hrow';
      row.innerHTML =
        '<div class="hprev" data-prev>' +
          '<span class="hprev-bg"></span>' +
          '<img class="hprev-person" alt="" />' +
          '<span class="hprev-off">Sin capas</span>' +
        '</div>' +
        '<div class="hbody">' +
          '<b>Slide ' + i + ' · ' + s.label + '</b>' +
          '<div class="hfields">' +
            '<label class="hfield"><span>Fondo</span>' +
              '<select data-k="bg">' + opts(CFG.BGS, s.bg) + '</select>' +
              '<input type="text" data-url="bg" placeholder="https://… o assets/mi-fondo.png" value="' + s.bg.replace(/"/g, '&quot;') + '" />' +
            '</label>' +
            '<label class="hfield"><span>Persona</span>' +
              '<select data-k="person">' + opts(CFG.PEOPLE, s.person) + '</select>' +
              '<input type="text" data-url="person" placeholder="https://… o assets/mi-persona.png" value="' + s.person.replace(/"/g, '&quot;') + '" />' +
            '</label>' +
          '</div>' +
          '<div class="hfoot">' +
            '<div class="svseg" role="group" aria-label="Capas visibles del slide ' + i + '">' +
              STATES.map(st => '<button type="button" data-st="' + st.id + '" title="' + st.title + '"' +
                (s.show === st.id ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + st.label + '</button>').join('') +
            '</div>' +
            '<button type="button" class="hreset" data-reset>Restaurar original</button>' +
          '</div>' +
        '</div>';

      const selBg = row.querySelector('select[data-k="bg"]');
      const selPe = row.querySelector('select[data-k="person"]');
      const urlBg = row.querySelector('input[data-url="bg"]');
      const urlPe = row.querySelector('input[data-url="person"]');

      function syncUrlVisibility(){
        urlBg.style.display = selBg.value === '__url' ? '' : 'none';
        urlPe.style.display = selPe.value === '__url' ? '' : 'none';
      }
      function paint(){
        const prev = row.querySelector('[data-prev]');
        const bgEl = row.querySelector('.hprev-bg');
        const peEl = row.querySelector('.hprev-person');
        const showBg = s.show === 'both' || s.show === 'bg';
        const showPe = s.show === 'both' || s.show === 'person';
        bgEl.style.backgroundImage = showBg ? 'url("' + s.bg + '")' : 'none';
        peEl.style.display = showPe ? '' : 'none';
        if (showPe) peEl.src = s.person;
        prev.classList.toggle('is-off', s.show === 'none');
      }
      function commit(){ save(); paint(); }

      [[selBg, urlBg, 'bg'], [selPe, urlPe, 'person']].forEach(([sel, inp, key]) => {
        sel.addEventListener('change', () => {
          if (sel.value === '__url'){ syncUrlVisibility(); inp.focus(); return; }
          s[key] = sel.value;
          inp.value = sel.value;
          syncUrlVisibility();
          commit();
          if (global.SB_UI) global.SB_UI.toast('Slide ' + i + ': imagen actualizada.', 'ok');
        });
        inp.addEventListener('change', () => {
          const v = inp.value.trim();
          if (!v) { inp.value = s[key]; return; }
          s[key] = v;
          commit();
          if (global.SB_UI) global.SB_UI.toast('Slide ' + i + ': imagen actualizada.', 'ok');
        });
      });

      row.querySelectorAll('.svseg button').forEach(btn => {
        btn.addEventListener('click', () => {
          s.show = btn.getAttribute('data-st');
          row.querySelectorAll('.svseg button').forEach(b => {
            const on = b === btn;
            b.classList.toggle('on', on);
            b.setAttribute('aria-pressed', String(on));
          });
          commit();
          if (global.SB_UI){
            const t = s.show === 'both' ? 'fondo + persona' : s.show === 'bg' ? 'solo fondo'
              : s.show === 'person' ? 'solo persona' : 'nada (el slide se salta)';
            global.SB_UI.toast('Slide ' + i + ' → ' + t + '.', 'ok');
          }
        });
      });

      row.querySelector('[data-reset]').addEventListener('click', () => {
        const base = CFG.BASE[i];
        s.bg = base.bg; s.person = base.person; s.show = 'both';
        save();
        render();
        if (global.SB_UI) global.SB_UI.toast('Slide ' + i + ' restaurado.', 'ok');
      });

      syncUrlVisibility();
      paint();
      return row;
    }

    function render(){
      host.textContent = '';
      slides.forEach((s, i) => host.appendChild(renderRow(s, i)));
    }
    render();

    const all = document.getElementById('heroAdmResetAll');
    if (all && !all.dataset.bound){
      all.dataset.bound = '1';
      all.addEventListener('click', () => {
        slides = CFG.BASE.map(b => ({ label:b.label, bg:b.bg, person:b.person, show:'both' }));
        CFG.write(slides);
        render();
        if (global.SB_UI) global.SB_UI.toast('Hero restaurado a sus imágenes originales.', 'ok');
      });
    }
  }

  global.SB_HERO_ADMIN = { mount, STATES };
  function boot(){
    if (!global.HERO_CFG) return;
    global.HERO_CFG.syncFromServer().then(() => { if (document.getElementById('heroAdmBody')) mount(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
