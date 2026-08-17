// ── Polvo del bracket ────────────────────────────────────────────────────
// MISMO sistema y configuración de partículas que el hero de PerfilJugador.html
// (motas de polvo en un rayo de luz, tres capas de profundidad, ráfagas y
// parpadeo), con una sola diferencia: aquí SUBEN — de abajo del bracket hacia
// arriba — en vez de cruzar de izquierda a derecha. Sustituye a los destellos
// fijos («estrellas») que se veían estáticos de lado a lado.
(function(global){
  'use strict';

  // Capas: lejos = muchas, chicas, lentas, tenues; cerca = pocas, grandes,
  // rápidas, brillantes. Los rangos son los del perfil, con el eje cambiado:
  // `v` es la velocidad de SUBIDA y `s` el bamboleo lateral.
  var LAYERS = [
    { w:0.55, r:[0.35,0.9], v:[0.06,0.18], s:[0.02,0.10], a:[0.03,0.10] },
    { w:0.32, r:[0.9,1.9],  v:[0.15,0.40], s:[0.05,0.18], a:[0.08,0.20] },
    { w:0.13, r:[1.7,3.2],  v:[0.35,0.85], s:[0.10,0.28], a:[0.16,0.34] }
  ];
  function pickLayer(){
    var r = Math.random(), acc = 0;
    for (var i = 0; i < LAYERS.length; i++){ acc += LAYERS[i].w; if (r <= acc) return LAYERS[i]; }
    return LAYERS[LAYERS.length - 1];
  }
  function rnd(range){ return range[0] + Math.random() * (range[1] - range[0]); }

  function attach(host, opts){
    if (!host || host.__dust) return null;
    if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    opts = opts || {};
    var canvas = host.querySelector(':scope > canvas.bkt-dust');
    if (!canvas){
      canvas = document.createElement('canvas');
      canvas.className = 'bkt-dust';
      canvas.setAttribute('aria-hidden', 'true');
      host.insertBefore(canvas, host.firstChild);
    }
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.__dust = true;

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, parts = [], N = 0, raf = 0, stars = [], SN = 0, t0 = 0;
    var tint = opts.tint || '243,233,210';

    function count(){
      // El doble de la densidad del perfil (150 motas en su hero) por área.
      return Math.max(100, Math.min(380, Math.round(W * H / 2650)));
    }
    function starCount(){
      return Math.max(7, Math.min(26, Math.round(W * H / 30000)));
    }
    // Estrellas/destellos: NO se distingue su forma — un núcleo difuso con
    // halo y dos trazos cruzados apenas insinuados. Destellos BREVES (1.4–3 s
    // de encendido + apagado, sin sostenerse) y una pausa apagada entre
    // destello y destello.
    function spawnStar(s, initial){
      s.x = 40 + Math.random() * Math.max(1, W - 80);
      s.y = 30 + Math.random() * Math.max(1, H - 60);
      s.core = 0.8 + Math.random() * 1.7;
      s.glow = 7 + Math.random() * 11;
      s.arm = s.glow * (1.5 + Math.random() * 1.1);
      s.max = 0.24 + Math.random() * 0.4;
      s.dur = 1400 + Math.random() * 1600;          // encendido + apagado
      s.gap = 2200 + Math.random() * 6000;          // apagada, esperando turno
      s.t = initial ? -Math.random() * (s.dur + s.gap) : 0;
      s.warm = Math.random() < 0.35;                // alguna fría (azulada)
      s.rot = Math.random() * Math.PI;              // orientación al azar
      s.arm2 = 0.45 + Math.random() * 0.55;         // segundo trazo: corto o casi igual
      return s;
    }
    function drawStar(s, k){
      var a = s.max * k;
      if (a <= 0.002) return;
      var rgb = s.warm ? '190,225,255' : '255,248,235';
      var g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.glow);
      g.addColorStop(0, 'rgba(' + rgb + ',' + (a * 0.85).toFixed(3) + ')');
      g.addColorStop(0.35, 'rgba(' + rgb + ',' + (a * 0.24).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.glow, 0, Math.PI * 2); ctx.fill();
      // trazos: muy tenues y desvanecidos, para que se lea como destello
      ctx.save();
      ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (a * 0.3).toFixed(3) + ')';
      ctx.lineWidth = Math.max(0.6, s.core * 0.5);
      ctx.beginPath();
      ctx.moveTo(-s.arm, 0); ctx.lineTo(s.arm, 0);
      ctx.moveTo(0, -s.arm * s.arm2); ctx.lineTo(0, s.arm * s.arm2);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(' + rgb + ',' + (a * 0.9).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.core, 0, Math.PI * 2); ctx.fill();
    }
    function spawn(p, initial){
      var L = p.layer || (p.layer = pickLayer());
      p.x = initial ? Math.random() * W : W * (0.04 + Math.random() * 0.92);
      p.y = initial ? Math.random() * H : H + 8 + Math.random() * 40;
      p.r = rnd(L.r);
      p.vy = -rnd(L.v);                               // sube, según su capa
      p.vx = rnd(L.s) * (Math.random() < 0.5 ? -1 : 1); // bamboleo lateral suave
      p.a = rnd(L.a);
      p.ph = Math.random() * Math.PI * 2;               // parpadeo / ondulación
      p.sp = 0.0008 + Math.random() * 0.002;
      p.gph = Math.random() * Math.PI * 2;              // ráfaga propia
      p.gsp = 0.00015 + Math.random() * 0.00025;
      return p;
    }
    function resize(){
      var r = host.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (w === W && h === H) return;
      W = canvas.width = w; H = canvas.height = h;
      N = count(); SN = starCount();
      while (parts.length > N) parts.pop();
      while (parts.length < N) parts.push(spawn({}, true));
      parts.forEach(function(p){ if (p.x > W || p.y > H) spawn(p, true); });
      while (stars.length > SN) stars.pop();
      while (stars.length < SN) stars.push(spawnStar({}, true));
      stars.forEach(function(s){ if (s.x > W - 20 || s.y > H - 20) spawnStar(s, true); });
    }
    function tick(ts){
      raf = requestAnimationFrame(tick);
      if (W < 2 || H < 2){ resize(); return; }
      var dt = t0 ? Math.min(64, ts - t0) : 16; t0 = ts;
      ctx.clearRect(0, 0, W, H);
      for (var j = 0; j < stars.length; j++){
        var s = stars[j];
        s.t += dt;
        if (s.t >= s.dur + s.gap) spawnStar(s, false);
        var u = s.t / s.dur;
        // rampa suave y simétrica: sube y baja casi sin sostenerse
        var k = u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * u), 2.6);
        drawStar(s, k);
      }
      for (var i = 0; i < parts.length; i++){
        var p = parts[i];
        p.ph += p.sp * 16;
        p.gph += p.gsp * 16;
        var gust = 0.55 + 0.55 * (0.5 + 0.5 * Math.sin(p.gph));
        p.y += p.vy * gust;
        p.x += p.vx * gust + Math.sin(p.ph) * (0.06 + p.r * 0.05);
        if (p.y < -12 || p.x < -14 || p.x > W + 14) spawn(p, false);
        var tw = 0.7 + 0.3 * Math.sin(p.ph * 1.7);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + tint + ',' + (p.a * tw).toFixed(3) + ')';
        ctx.fill();
      }
    }
    resize();
    if (global.ResizeObserver){
      var ro = new ResizeObserver(function(){ resize(); });
      ro.observe(host);
    } else {
      global.addEventListener('resize', resize);
    }
    raf = requestAnimationFrame(tick);
    return { canvas: canvas, resize: resize, stop: function(){ cancelAnimationFrame(raf); } };
  }

  global.TORNEO_DUST = { attach: attach };
})(typeof window !== 'undefined' ? window : globalThis);
