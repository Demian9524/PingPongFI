// ── REGLAS DEL TORNEO · popup (solo frontend, sin SQL) ────────────────
// Inyecta el modal (.rt-overlay/.rt-box de css/reglas-torneo.css), navegación
// lateral con scrollspy en escritorio, acordeones en móvil, y la tarjeta
// dinámica FORMATO ACTUAL con datos ya publicados (nunca inventa valores).
//
// La tabla por número de grupos y los ejemplos NO están escritos a mano: se
// generan con supabase/format-engine.js (misma fuente que usa el Centro de
// control y la preparación del sorteo), así que la página pública nunca puede
// contradecir al reglamento aplicado.
(function(){
  'use strict';
  // Solo tres categorías vigentes. 'novato'/'beginner' se conservan como ALIAS
  // DE LECTURA de ediciones históricas y se pintan igual que Principiante.
  const CAT_SW = { principiante:'#37bb66', novato:'#37bb66', beginner:'#37bb66',
                   intermedio:'#3a63f0', avanzado:'#dd3b2c', avanzado_open:'#dd3b2c' };
  const E = () => window.FI_FORMAT;

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  const tip = (txt, def) => '<span class="rt-tip" tabindex="0" data-tip="' + esc(def) + '">' + txt + '</span>';
  const count = items => '<div class="rt-count">' + items.map(([n, l]) =>
    '<div><b>' + n + '</b><span>' + l + '</span></div>').join('') + '</div>';
  const flow = steps => '<div class="rt-flowd">' + steps.map(s =>
    '<div class="rt-fbox"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>').join('') + '</div>';

  const TIP_EFF = 'Número de participantes de un grupo cuyos resultados siguen contando para la clasificación. Un grupo de 5 que pierde a alguien antes de jugar es un grupo efectivo de 4; si esa persona ya completó todos sus partidos, el grupo sigue siendo efectivo de 5.';
  const TIP_A = 'Tercer lugar de un grupo efectivo de 5: superó a dos participantes. Tiene prioridad sobre cualquier otro tercero.';
  const TIP_B = 'Tercer lugar de un grupo efectivo de 4: superó a un participante. Ocupa las plazas que queden después del Nivel A.';
  const TIP_C = 'Tercer lugar de un grupo efectivo de 3: también terminó último de su grupo. Se considera eliminado y solo entra si es indispensable para cerrar una ronda simétrica.';

  // ── tabla oficial 2–10 grupos, generada por el motor ─────────────────
  function matrixRows(){
    const F = E();
    if (!F) return '';
    return F.officialTable().map(r => {
      const v = r.plan;
      const acceso = v.kind === 'ACCESS'
        ? '<span class="gold">' + v.accessMatches + ' partidos</span> · ' + r.groups + ' segundos' +
          (v.thirdsSlots ? ' + ' + v.thirdsSlots + ' tercero' + (v.thirdsSlots === 1 ? '' : 's') : '')
        : 'No se juega';
      const directo = v.kind === 'ACCESS'
        ? '<span class="gold">' + r.groups + ' primeros</span> (todos) a ' + esc(v.bracketLabel.toLowerCase())
        : r.groups + ' primeros, ' + r.groups + ' segundos' +
          (v.thirdsSlots ? ' y ' + v.thirdsSlots + ' tercero' + (v.thirdsSlots === 1 ? '' : 's') : '') +
          ': <span class="gold">llave directa de ' + v.bracket + '</span>';
      return '<tr><td class="g">' + r.groups + '</td>' +
        '<td data-l="Pase directo">' + directo + '</td>' +
        '<td data-l="Ronda de acceso">' + acceso + '</td>' +
        '<td data-l="Llave principal">' + v.bracket + ' · ' + esc(v.bracketLabel.toLowerCase()) + '</td></tr>';
    }).join('');
  }

  // ── ejemplo completo a partir de un número de participantes ──────────
  function example(n){
    const F = E();
    if (!F) return '';
    const d = F.recommendDistribution(n);
    if (!d.rec) return '';
    const p = F.planFor(d.rec.groups, d.rec.sizes);
    const v = p.primary;
    return '<div class="rt-exbox"><h6>' + n + ' participantes</h6>' +
      '<ul><li>Reparto recomendado: <b>' + F.sizesLabel(d.rec) + '</b> (' + d.rec.groups + ' grupos).</li>' +
      '<li>Avanzan <b>' + d.rec.groups + ' primeros</b> y <b>' + d.rec.groups + ' segundos</b>' +
        (v.thirdsSlots ? ' más <b>' + v.thirdsSlots + ' tercero' + (v.thirdsSlots === 1 ? '' : 's') + '</b>' : '') + '.</li>' +
      (v.kind === 'ACCESS'
        ? '<li>Todos los primeros reciben <b>pase directo</b>; los segundos' + (v.thirdsSlots ? ' y el tercero seleccionado' : '') +
          ' juegan <b>' + v.accessMatches + ' partidos de acceso</b>.</li>' +
          '<li>Llave principal: <b>' + v.bracket + '</b> (' + esc(v.bracketLabel.toLowerCase()) + ').</li>'
        : '<li><b>Llave directa de ' + v.bracket + '</b> (' + esc(v.bracketLabel.toLowerCase()) + '), sin pases directos ni descansos.</li>') +
      '</ul></div>';
  }

  function sections(){
    const F = E();
    return [
    ['Resumen del formato', `
      <span class="rt-badge red">Grupos → fase posterior a grupos → eliminación directa</span>
      <p>Toda categoría juega <b>fase de grupos</b>, después una <b>fase posterior a grupos</b> y termina en <b>eliminación directa</b>. Nunca se salta ninguna.</p>
      ${count([['1.º y 2.º','Avanzan siempre, de todos los grupos'],['3.º','Avanza según el formato de la categoría'],['2.º sorteo','Al terminar los grupos, para armar la llave']])}
      <ul>
        <li><b>Todos</b> los primeros y <b>todos</b> los segundos de cada grupo avanzan. Sin excepciones y sin comparaciones entre ellos.</li>
        <li>Los <b>terceros</b> avanzan solo si el formato de la categoría abre plazas para ellos, con el ${tip('sistema 5–4–3', 'Los terceros se ordenan por el tamaño efectivo de su grupo: 5 (Nivel A), 4 (Nivel B) y 3 (Nivel C, reserva).')}.</li>
        <li>Si el formato reparte <b>pases directos</b>, los reciben <b>todos los primeros</b> con exactamente el mismo privilegio.</li>
        <li>La llave <b>no se construye</b> antes de que terminen los grupos: al cerrar la fase se hace un <b>segundo sorteo</b> que define enfrentamientos y posiciones.</li>
        <li>Los partidos de grupos se juegan al <b>mejor de 3 sets</b>; semifinales y finales al <b>mejor de 5</b>.</li>
      </ul>
      <div class="rt-note"><span>Lo que <b>nunca</b> pasa: comparar dos primeros lugares entre sí, comparar dos segundos entre sí, o que un primero descanse y otro no.</span></div>`],

    ['Formación de grupos', `
      <span class="rt-badge">Objetivo 4 · permitido 3 a 5</span>
      ${count([['4','Tamaño objetivo'],['5','Tamaño preferente para absorber gente'],['3','Excepcional y menos favorable']])}
      <p>Nunca hay grupos de 1, 2 ni más de 5. El reparto se elige con esta prioridad:</p>
      <ol class="rt-proc">
        <li>Todos los grupos entre <b>3 y 5</b> participantes.</li>
        <li><b>Minimizar</b> la cantidad de grupos de 3.</li>
        <li><b>Maximizar</b> la cantidad de grupos de 4.</li>
        <li>Usar grupos de <b>5</b> antes que crear grupos de 3 innecesarios.</li>
        <li>Mantener como máximo <b>una persona</b> de diferencia entre el grupo más grande y el más chico.</li>
        <li>No abrir un grupo adicional si eso obliga a formar varios grupos de 3.</li>
      </ol>
      <div class="rt-exbox"><h6>Repartos que salen de esa prioridad</h6>
        <table class="rt-matrix"><thead><tr><th>Participantes</th><th>Reparto</th><th>Grupos</th></tr></thead><tbody>
        ${F ? [11,12,13,14,15,16,17,18,19,20,21,22,23,24].map(n => {
          const d = F.recommendDistribution(n).rec;
          return d ? '<tr><td class="g">' + n + '</td><td data-l="Reparto">' + F.sizesLabel(d) +
            '</td><td data-l="Grupos">' + d.groups + '</td></tr>' : '';
        }).join('') : ''}
        </tbody></table>
        <p style="margin:0">Con 15 se recomienda <b>5–5–5</b> y no 4–4–4–3: reduce los grupos de tres y evita que un tercer lugar sea también último.</p>
      </div>
      <ul>
        <li>Los grupos se deciden con un <b>sorteo físico</b>: una pelota con el nombre y otra con el grupo.</li>
        <li>La página únicamente <b>reproduce el resultado</b> obtenido físicamente.</li>
      </ul>
      <div class="rt-note"><span>El máximo de 5 integrantes puede superarse únicamente ante una <b>decisión extraordinaria documentada</b> de la organización.</span></div>
      <div class="rt-note"><span>El sorteo de grupos es <b>presencial</b>: <b>fecha y horario por confirmar</b>.</span></div>`],

    ['Clasificación interna del grupo', `
      <span class="rt-badge">Dentro del grupo no hay empates de partido</span>
      <p>Cada partido de grupos se juega al <b>mejor de 3 sets</b>: siempre hay un ganador. El orden del grupo se resuelve así:</p>
      <ol class="rt-proc">
        <li><b>Partidos ganados.</b></li>
        <li>Si hay <b>dos</b> empatados: <b>enfrentamiento directo</b> entre ellos.</li>
        <li>Si hay <b>tres o más</b> empatados: <b>minitabla</b> solo entre los empatados.</li>
        <li><b>Diferencia de sets</b> dentro de la minitabla.</li>
        <li><b>Porcentaje de sets ganados.</b></li>
        <li><b>Desempate deportivo</b> si el empate sigue total y cambia la ruta competitiva.</li>
      </ol>
      <div class="rt-note"><span>No se usan criterios de <b>puntos</b>: el torneo registra <b>sets</b>, no los puntos de cada set. Cualquier «puntaje» que veas en la tabla es una ayuda visual, no un criterio extra.</span></div>
      <div class="rt-compare">
        <div class="cbox2 anu"><h5>Sí cuentan</h5><p>Partidos jugados · partidos ganados por default a tu favor (con su marcador oficial).</p></div>
        <div class="cbox2 def"><h5>No cuentan</h5><p>Partidos anulados · encuentros pendientes · resultados de quien se retira sin completar.</p></div>
      </div>`],

    ['Primeros y segundos: clasificación automática', `
      <span class="rt-badge red">Todos avanzan · nunca se comparan entre sí</span>
      <p>Terminar <b>1.º</b> o <b>2.º</b> de tu grupo es suficiente: avanzas, sin importar cómo se vea tu tabla comparada con la de otro grupo.</p>
      ${flow([['1.º de grupo','Bombo 1 · avanza siempre'],['2.º de grupo','Bombo 2 · avanza siempre'],['3.º de grupo','Bombo 3 · según formato']])}
      <ul>
        <li>No existe <b>«mejor primero»</b> ni <b>«peor primero»</b>. Tampoco «mejor segundo».</li>
        <li>Dentro del <b>Bombo 1</b> y del <b>Bombo 2</b> no hay ranking interno ni estadísticas comparativas.</li>
        <li>Si hay pases directos, el número de pases es <b>igual al número de grupos</b>: uno por cada primer lugar.</li>
        <li>No hay desempates entre primeros de distintos grupos, ni entre segundos de distintos grupos: no habría nada que decidir.</li>
      </ul>
      <div class="rt-note"><span>La tabla general de estadísticas sigue publicándose como información, pero <b>no decide privilegios</b> de primeros ni de segundos.</span></div>`],

    ['Terceros: sistema 5–4–3', `
      <span class="rt-badge">Los únicos comparables entre grupos distintos</span>
      <p>Un tercer lugar no vale lo mismo en todos los grupos: depende de a cuánta gente superó. Por eso los terceros se dividen en tres niveles según el ${tip('tamaño efectivo', TIP_EFF)} de su grupo.</p>
      <div class="rt-lvls">
        <div class="rt-lvl a"><b>NIVEL A</b><span>${tip('Tercero de grupo de 5', TIP_A)}</span><small>Superó a dos participantes. <b>Prioridad</b> para las plazas de tercero.</small></div>
        <div class="rt-lvl b"><b>NIVEL B</b><span>${tip('Tercero de grupo de 4', TIP_B)}</span><small>Superó a un participante. Ocupa las plazas que queden.</small></div>
        <div class="rt-lvl c"><b>NIVEL C</b><span>${tip('Tercero de grupo de 3', TIP_C)}</span><small>También es último de su grupo: <b>eliminado</b> salvo que la estructura lo exija.</small></div>
      </div>
      <p>Para cubrir las plazas de tercero:</p>
      <ol class="rt-proc">
        <li>Primero entran los terceros de <b>Nivel A</b>.</li>
        <li>Si sobran plazas, entran los de <b>Nivel B</b>.</li>
        <li>Solo si aún faltan plazas <b>estructuralmente necesarias</b>, se usa el <b>Nivel C</b>.</li>
        <li>Las tablas <b>nunca mezclan</b> niveles distintos.</li>
      </ol>
      <div class="rt-exbox"><h6>Ejemplo · se necesitan 4 terceros</h6>
        <ul>
          <li>Hay 2 terceros de grupos de 5, 3 de grupos de 4 y 1 de grupo de 3.</li>
          <li>Clasifican los <b>2 de Nivel A</b> y los <b>2 mejores de Nivel B</b>.</li>
          <li>El tercero de Nivel C queda <b>eliminado</b>, aunque tenga mejores números.</li>
        </ul>
      </div>
      <div class="rt-exbox"><h6>Ejemplo · se necesitan 2 terceros y hay 3 de Nivel A</h6>
        <ul><li>Solo se comparan <b>esos tres</b> jugadores entre sí para elegir dos.</li>
        <li>Los terceros de Nivel B y C <b>no entran</b> en la comparación.</li></ul>
      </div>
      <div class="rt-note"><span>Un tercero de grupo de 3 <b>nunca</b> desplaza a un tercero de grupo de 4 o de 5.</span></div>`],

    ['Formatos eliminatorios', `
      <span class="rt-badge red">Solo existen dos formatos oficiales</span>
      <div class="rt-compare">
        <div class="cbox2 anu"><h5>A · Llave directa</h5><p>Primeros + segundos + los terceros necesarios llenan <b>exactamente</b> una llave de 8, 16 o 32. <b>Sin pases directos ni descansos</b>: todos juegan la primera ronda.</p></div>
        <div class="cbox2 def"><h5>B · Acceso con primeros protegidos</h5><p><b>Todos</b> los primeros esperan en la llave principal. Los segundos y los terceros seleccionados juegan una <b>ronda de acceso</b>; los ganadores se unen a los primeros.</p></div>
      </div>
      <p>El formato no se elige a gusto: sale de una fórmula con el número de grupos.</p>
      <div class="rt-exbox"><h6>Fórmula general</h6>
        <ul>
          <li><b>G</b> = número definitivo de grupos.</li>
          <li><b>B</b> = primera potencia de 2 igual o mayor que 2G.</li>
          <li><b>D</b> = B − 2G.</li>
          <li>Si <b>0 &lt; D ≤ G</b> → llave directa con <b>D</b> terceros.</li>
          <li>Si <b>D = 0</b> → primeros y segundos ya llenan la llave: se usa acceso protegido con <b>todos</b> los terceros cuando todos los grupos son efectivos de 4 o 5.</li>
          <li>Si <b>D &gt; G</b> → acceso protegido con <b>T = B − 3G</b> terceros.</li>
        </ul>
      </div>
      <details class="rt-acc"><summary>Excepción · cuando existe un grupo efectivo de 3</summary>
        <p>Su tercer lugar también es último, así que se considera eliminado por defecto. Con <b>D = 0</b> la recomendación pasa a ser <b>llave directa con primeros y segundos</b>, y la inclusión de terceros de reserva queda como decisión administrativa extraordinaria.</p>
      </details>
      <div class="rt-note"><span>Nunca existe un formato donde <b>solo algunos</b> primeros reciban pase directo.</span></div>`],

    ['Tabla por número de grupos', `
      <p>Esta tabla no está escrita a mano: la calcula el mismo motor que usa la organización, así que siempre coincide con lo que se aplica.</p>
      <table class="rt-matrix">
        <thead><tr><th>Grupos</th><th>Pase directo</th><th>Ronda de acceso</th><th>Llave principal</th></tr></thead>
        <tbody>${matrixRows()}</tbody>
      </table>
      <div class="rt-note"><span>Los repartos de <b>3, 6 y 7</b> grupos cierran la llave sin ronda de acceso. Los de <b>2, 4, 5, 8, 9 y 10</b> la requieren.</span></div>`],

    ['Sorteo de bombos', `
      <p>El sorteo eliminatorio se realiza <b>físicamente</b> con tres bombos y una caja de posiciones.</p>
      ${flow([['Bombo 1','Todos los primeros · sin orden interno'],['Bombo 2','Todos los segundos · sin orden interno'],['Bombo 3','Terceros seleccionados (5–4–3)'],['Caja','Posición del partido en la llave']])}
      <div class="rt-exbox"><h6>Llave directa</h6>
        <ol class="rt-proc">
          <li>Se reparten los primeros en <b>sectores distintos</b> de la llave.</li>
          <li>Los terceros se sortean preferentemente contra <b>primeros de otro grupo</b>.</li>
          <li>Los primeros restantes se sortean contra <b>segundos</b>.</li>
          <li>Los espacios que queden se completan con <b>segundos contra segundos</b>.</li>
          <li>Se evita a rivales del <b>mismo grupo</b> en la primera ronda.</li>
          <li>Se sortea también la <b>posición</b> de cada partido.</li>
        </ol>
      </div>
      <div class="rt-exbox"><h6>Acceso con primeros protegidos</h6>
        <ol class="rt-proc">
          <li>Los primeros <b>esperan</b> en la llave principal y sortean su posición.</li>
          <li>Los terceros seleccionados enfrentan a <b>segundos de otro grupo</b>.</li>
          <li>Los segundos restantes se enfrentan <b>entre sí</b>.</li>
          <li>Los ganadores se sortean en la llave principal.</li>
          <li>Se evita la revancha inmediata contra alguien del mismo grupo.</li>
        </ol>
      </div>
      <div class="rt-note"><span>Publicada la llave, <b>no se vuelve a sortear</b>.</span></div>
      <div class="rt-note"><span>El sorteo del bracket también es <b>presencial</b>: <b>fecha y horario por confirmar</b>.</span></div>`],

    ['Desempates de terceros', `
      <span class="rt-badge red">Solo si el empate cruza la última plaza</span>
      <p>Entre terceros del <b>mismo nivel</b> el orden es:</p>
      <ol class="rt-proc">
        <li><b>Partidos ganados.</b></li>
        <li><b>Diferencia de sets.</b></li>
        <li><b>Porcentaje de sets ganados.</b></li>
        <li><b>Desempate deportivo</b>, únicamente si el empate decide la última plaza.</li>
      </ol>
      <div class="rt-compare">
        <div class="cbox2 anu"><h5>Sin desempate</h5><p>Los empatados ya clasificaron todos · ya quedaron todos fuera · tendrán el mismo bombo y el mismo privilegio.</p></div>
        <div class="cbox2 def"><h5>Con desempate</h5><p>El empate cae exactamente en la <b>última plaza</b> de tercero disponible.</p></div>
      </div>
      <p>Con <b>tres o más</b> personas empatadas en la frontera se organiza un <b>repechaje corto</b>.</p>
      <div class="rt-note"><span>Nunca se usa el <b>azar</b> como criterio de desempate deportivo, y nunca se comparan terceros de niveles distintos.</span></div>
      <div class="rt-note"><span>La página marca visualmente la <b>línea de corte</b>: quién clasifica, quién está empatado en la frontera y quién queda eliminado.</span></div>`],

    ['Bajas y cambios de categoría', `
      <p>La categoría pasa por tres estados y cada uno permite cosas distintas.</p>
      ${flow([['Provisional','Altas, bajas y cambios · sin bracket'],['Congelado','Grupos definidos · empiezan los resultados'],['Eliminatorio','Grupos terminados · segundo sorteo y llave']])}
      <div class="rt-exbox"><h6>Bajas</h6>
        <ul>
          <li><b>Sin partidos jugados:</b> se retira y el grupo baja de ${tip('tamaño efectivo', TIP_EFF)}.</li>
          <li><b>Con partidos incompletos:</b> sus resultados se anulan para la clasificación, salvo decisión administrativa registrada.</li>
          <li><b>Después de completar todos sus partidos:</b> los resultados <b>permanecen</b> y el tamaño efectivo del grupo no cambia.</li>
        </ul>
      </div>
      <details class="rt-acc"><summary>Sustituciones y participantes tardíos</summary>
        <ul>
          <li>Solo se permite <b>sustitución directa</b> si la persona original no jugó ningún partido.</li>
          <li>A un participante tardío se lo acomoda en este orden: grupo efectivo de <b>3</b> → grupo de <b>4</b> convirtiéndolo en <b>5</b> → grupo nuevo solo si hay al menos <b>3</b> participantes.</li>
          <li>No se crean grupos de 6 ni se reconstruyen en silencio grupos que ya tienen resultados oficiales.</li>
        </ul>
      </details>
      <details class="rt-acc"><summary>Cambios de categoría</summary>
        <ul>
          <li>Con <b>0 o 1</b> partido disputado se puede reclasificar; ese partido se <b>anula</b> y la persona empieza desde cero.</li>
          <li>Con <b>2</b> partidos disputados la categoría queda <b>congelada</b>.</li>
          <li>Una reclasificación no puede dejar un grupo con menos de 3 integrantes.</li>
          <li>No se entra directamente a eliminatorias por una reclasificación.</li>
        </ul>
      </details>
      <div class="rt-note"><span>Toda modificación después del cierre debe mostrar <b>estado anterior, estado nuevo y motivo</b>, incluido el cambio en el número de grupos, en el tamaño efectivo y en el formato eliminatorio.</span></div>`],

    ['Ejemplos completos', `
      <p>Tres categorías reales con el mismo reglamento y tres resultados distintos.</p>
      ${example(13)}
      ${example(16)}
      ${example(21)}
      <div class="rt-note"><span>Con 16 participantes en 4 grupos de 4, <b>todos</b> los terceros tienen oportunidad: 4 segundos contra 4 terceros. Es uno de los formatos ideales.</span></div>`],

    ['Preguntas frecuentes', `
      <details class="rt-acc"><summary>Quedé primero, ¿puedo quedar fuera del pase directo?</summary>
        <p>No. Si el formato reparte pases directos, los reciben <b>todos</b> los primeros. Si no los reparte, <b>ningún</b> primero los recibe.</p></details>
      <details class="rt-acc"><summary>Gané más partidos que un primero de otro grupo, ¿me sirve?</summary>
        <p>No para el sorteo: los primeros y segundos no se comparan entre grupos. Tu posición de grupo es lo único que define tu bombo.</p></details>
      <details class="rt-acc"><summary>Soy tercero de un grupo de 5 y otro tercero de un grupo de 4 tiene mejores números. ¿Quién pasa?</summary>
        <p>Tú: el Nivel A tiene prioridad sobre el Nivel B. Solo compites contra otros terceros de grupos efectivos de 5.</p></details>
      <details class="rt-acc"><summary>Soy tercero de un grupo de 3, ¿tengo chance?</summary>
        <p>Normalmente no: en un grupo de 3 el tercero también es último. Solo entra si hacen falta terceros para cerrar una ronda simétrica y no hay suficientes de Nivel A o B.</p></details>
      <details class="rt-acc"><summary>Mi grupo perdió a alguien, ¿cambia mi prioridad?</summary>
        <p>Depende de cuándo. Si se fue sin jugar, tu grupo pasa a ${tip('tamaño efectivo', TIP_EFF)} menor y tu nivel de tercero baja. Si ya había completado todos sus partidos, sus resultados permanecen y el tamaño efectivo no cambia.</p></details>
      <details class="rt-acc"><summary>¿Cuándo se sabe con quién juego?</summary>
        <p>Hasta que terminen todos los grupos: la llave se arma en un <b>segundo sorteo físico</b>, y no se vuelve a sortear después de publicarla.</p></details>
      <details class="rt-acc"><summary>¿Hay desempates por diferencia de puntos?</summary>
        <p>No. El torneo registra sets, no puntos por set, así que los criterios de puntos no se aplican.</p></details>`],

    ['Reglas de juego', `
      <span class="rt-badge red">Al mejor de 3 sets · Semifinales y finales al mejor de 5</span>
      <ul>
        <li>Todos los partidos se juegan <b>al mejor de 3 sets</b>, en <b>todas las categorías</b>.</li>
        <li>En <b>semifinales y finales</b> de todas las categorías se juega <b>al mejor de 5 sets</b>.</li>
        <li>Cada set se juega <b>a 11 puntos</b>.</li>
        <li>En caso de <b>empate 10–10</b>, el set <b>sube</b>: se sigue jugando hasta que alguien saque <b>2 puntos de ventaja</b>.</li>
        <li>Se aplican las <b>reglas naturales de tenis de mesa</b>. <b>Aplican excepciones</b> (ver los puntos siguientes).</li>
        <li><b>No hay doble saque.</b></li>
        <li><b>No hay "saque vuelve".</b></li>
        <li><b>NO se juega "buena".</b></li>
      </ul>
      <div class="rt-exbox"><h6>Deuce · empate a 10</h6>
        <ul>
          <li>Al llegar a <b>10–10</b> el set ya no termina en 11: se juega <b>a diferencia de 2</b>.</li>
          <li>Desde ese momento el <b>saque cambia cada punto</b> (uno y uno), no cada dos.</li>
          <li>El set termina en <b>12–10, 13–11, 14–12</b>, y así sucesivamente. Nunca se gana un set 11–10.</li>
          <li>No hay tope de puntos: el set sube <b>lo que sea necesario</b> hasta la diferencia de 2.</li>
        </ul>
      </div>
      <div class="rt-alert"><h6>No hay reglas de lanzamiento de saque</h6>
        <p>El saque solo debe ser <b>limpio y claro</b>: la pelota se golpea desde detrás de la mesa, rebota en tu lado y pasa al lado del rival. <b>Nada más se exige.</b> No se sancionan las formalidades reglamentarias de la ITTF:</p>
        <ul>
          <li><b>No</b> se exige lanzar la pelota <b>16 cm hacia arriba</b>.</li>
          <li><b>No</b> se exige mostrar la pelota al rival ni tenerla en la palma abierta.</li>
          <li><b>No</b> se sanciona <b>tapar u ocultar</b> el saque con el cuerpo o el brazo.</li>
          <li><b>No</b> se exige que el lanzamiento sea vertical ni sin efecto.</li>
          <li><b>No</b> se sanciona sacar <b>desde la mano</b> (sin lanzar) ni desde arriba de la mesa.</li>
          <li><b>No</b> se pide altura, ángulo, ni posición específica de la mano libre.</li>
          <li><b>No</b> se repite el punto por un saque "mal lanzado".</li>
        </ul>
        <p class="rt-alert-foot">Un saque solo se repite si <b>toca la red y entra</b> (let). Todo lo demás se juega.</p>
      </div>
      <div class="rt-exbox"><h6>El único saque que vuelve es el de la red</h6>
        <ul>
          <li>Si al sacar la pelota <b>roza la red</b> y de todos modos <b>cae en el lado del rival</b>, el saque <b>vuelve</b>: se repite, sin punto para nadie.</li>
          <li>Ese es el <b>único caso</b> en el que un saque se repite. <b>Ningún otro saque vuelve.</b></li>
          <li>Si la pelota toca la red y <b>no pasa</b> (se queda en tu lado o se va fuera), es <b>punto para el rival</b> — no se repite.</li>
          <li>Un saque que sale largo, corto, chueco, "mal lanzado" o que no te gustó <b>no vuelve</b>: se juega o es punto en contra.</li>
          <li>No existe "vuelve" por distracción, ruido, pelota de otra mesa que no interfirió, ni por reclamar el saque después del punto.</li>
        </ul>
      </div>
      <div class="rt-alert"><h6>Golpear la pelota antes de que caiga en la mesa = punto perdido</h6>
        <p>Debes esperar a que la pelota <b>rebote en tu lado de la mesa</b> antes de golpearla. Si la interceptas en el aire, <b>pierdes el punto</b>, aunque la pelota fuera a salirse.</p>
        <ul>
          <li>Golpear la pelota <b>en el aire</b>, antes de su rebote en tu lado: <b>punto para el rival</b>.</li>
          <li>Esto incluye <b>bloquear, tapar o manotear</b> una pelota que venía larga y se iba a ir fuera. Si la tocas antes del rebote, el punto es del rival.</li>
          <li>Lo correcto con una pelota que se va larga es <b>dejarla pasar</b>: cuando cae fuera sin haber rebotado en tu lado, el punto es <b>tuyo</b>.</li>
          <li>También pierdes el punto si la pelota te toca a <b>ti, tu ropa o tu raqueta</b> antes de botar en tu lado.</li>
          <li>Sí puedes golpearla <b>justo después</b> del rebote, por temprano que sea; lo prohibido es tocarla <b>antes</b>.</li>
        </ul>
        <p class="rt-alert-foot">Regla simple: <b>primero bota, luego pegas</b>. Si tocas antes del bote, el punto no es tuyo.</p>
      </div>
      <div class="rt-exbox"><h6>Requisitos para clasificar</h6>
        <ul>
          <li>No estar retirado.</li>
          <li>Tener al menos <b>2 resultados oficiales resueltos</b>.</li>
          <li>Tener resuelto al menos el <b>60% de tu calendario final</b>.</li>
        </ul>
      </div>`],

    ['Formato actual', `<div id="rtFmtHost"><p class="rt-fmt-pend">Cargando información publicada…</p></div>`]
    ];
  }

  function build(){
    if (document.getElementById('rtOverlay')) return;
    const SECS = sections();
    const side = SECS.map((s,i) =>
      '<button type="button" data-rt-jump="'+i+'"'+(i===0?' class="on"':'')+'><span class="n">'+(i<SECS.length-1?String(i+1).padStart(2,'0'):'★')+'</span>'+s[0]+'</button>').join('');
    const secs = SECS.map((s,i) =>
      '<div class="rt-sec'+(i===0?' open':'')+'" data-rt-sec="'+i+'">'+
      '<div class="rt-sec-head" role="button" tabindex="0"><span class="num">'+(i<SECS.length-1?String(i+1).padStart(2,'0'):'★')+'</span><h3>'+s[0]+'</h3>'+
      '<svg class="chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg></div>'+
      '<div class="rt-sec-body">'+s[1]+'</div></div>').join('');
    const el = document.createElement('div');
    el.id = 'rtOverlay'; el.className = 'rt-overlay';
    el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label','Reglas del torneo');
    el.innerHTML =
      '<div class="rt-box">'+
        '<div class="rt-head">'+
          '<span class="ic"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg></span>'+
          '<h2>Reglas del <span>torneo</span></h2><span class="rt-tag">Grupos · Terceros 5–4–3 · Eliminatoria</span>'+
          '<button type="button" class="rt-x" id="rtClose" aria-label="Cerrar reglas"><svg width="20" height="20" aria-hidden="true" focusable="false"><use href="#ico-x"></use></svg></button>'+
        '</div>'+
        '<div class="rt-grid">'+
          '<div class="rt-side">'+side+'</div>'+
          '<div class="rt-content" id="rtContent">'+
            '<div class="rt-lead"><span class="ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16.5v.01"/></svg></span>'+
            '<p>Todos los <b>primeros y segundos</b> avanzan. Los <b>terceros</b> avanzan por el sistema 5–4–3. Los sorteos de grupos y de la llave se realizan <b>físicamente con pelotas</b>, de forma <b>presencial</b> (<b>fecha y horario por confirmar</b>); la página solo <b>captura, publica y consulta</b> el resultado.</p></div>'+
            secs+
          '</div>'+
        '</div>'+
        '<div class="rt-foot"><span class="hint">Reglamento vigente · Torneo Ping Pong FI</span><span class="sp"></span>'+
          '<button type="button" class="btn-ok" id="rtOk">Entendido</button>'+
          '<a class="btn-go" href="Registro.html">Ir al registro <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg></a>'+
        '</div>'+
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) close(); });
    el.querySelector('#rtClose').addEventListener('click', close);
    el.querySelector('#rtOk').addEventListener('click', close);
    const content = el.querySelector('#rtContent');
    const isMobile = () => window.matchMedia('(max-width:860px)').matches;
    // en móvil todo arranca colapsado: la lista de secciones debe verse completa
    if (isMobile()) el.querySelectorAll('.rt-sec.open').forEach(s => s.classList.remove('open'));
    // escritorio: la barra lateral salta a la sección (scrollspy); móvil: acordeón
    el.querySelectorAll('[data-rt-jump]').forEach(b => b.addEventListener('click', () => {
      const sec = el.querySelector('.rt-sec[data-rt-sec="'+b.dataset.rtJump+'"]');
      if (!sec) return;
      if (isMobile()) sec.classList.add('open');
      content.scrollTop = sec.offsetTop - content.offsetTop - 6;
    }));
    el.querySelectorAll('.rt-sec-head').forEach(h => {
      const toggle = () => {
        if (!isMobile()) return;
        const sec = h.parentElement, willOpen = !sec.classList.contains('open');
        sec.classList.toggle('open');
        if (willOpen) requestAnimationFrame(() => { content.scrollTop = sec.offsetTop - content.offsetTop - 6; });
      };
      h.addEventListener('click', toggle);
      h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggle(); } });
    });
    // tooltips: hover en escritorio, toque en móvil (sin librerías). Si el globo
    // se saldría por la derecha del panel, se ancla al lado opuesto.
    const place = t => {
      t.classList.remove('flip');
      const r = t.getBoundingClientRect(), c = content.getBoundingClientRect();
      const w = Math.min(320, window.innerWidth * 0.74);
      if (r.left + w > c.right - 10) t.classList.add('flip');
    };
    el.querySelectorAll('.rt-tip').forEach(t => {
      t.addEventListener('mouseenter', () => place(t));
      t.addEventListener('focus', () => place(t));
      t.addEventListener('click', e => { e.stopPropagation(); place(t); t.classList.toggle('on'); });
      t.addEventListener('blur', () => t.classList.remove('on'));
    });
    let spy = null;
    content.addEventListener('scroll', () => {
      if (spy) return;
      spy = requestAnimationFrame(() => {
        spy = null;
        if (isMobile()) return;
        const top = content.scrollTop + 90;
        let cur = 0;
        el.querySelectorAll('.rt-sec').forEach(s => { if (s.offsetTop - content.offsetTop <= top) cur = +s.dataset.rtSec; });
        el.querySelectorAll('[data-rt-jump]').forEach(b => b.classList.toggle('on', +b.dataset.rtJump === cur));
      });
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('show')) close(); });
  }

  let fmtLoaded = false;
  function open(){
    build();
    document.getElementById('rtOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
    if (!fmtLoaded){ fmtLoaded = true; loadFormato().catch(() => renderPendiente()); }
  }
  function close(){
    const el = document.getElementById('rtOverlay');
    if (el) el.classList.remove('show');
    document.body.style.overflow = '';
  }

  // ── FORMATO ACTUAL: solo datos publicados; nunca inventa valores ─────
  const PENDIENTE = 'Formato pendiente de confirmación al cerrar la ventana de ajustes.';
  function renderPendiente(){
    const host = document.getElementById('rtFmtHost');
    if (host) host.innerHTML = '<p class="rt-fmt-pend">'+PENDIENTE+'</p>';
  }
  function row(dt, dd){ return '<div><dt>'+dt+'</dt><dd>'+dd+'</dd></div>'; }
  async function loadFormato(){
    const host = document.getElementById('rtFmtHost');
    if (!host) return;
    if (!window.SB_READY || !window.SB_CATALOG || !window.SB || !E()){ renderPendiente(); return; }
    const F = E();
    const ed = await window.SB_CATALOG.getActiveEdition();
    const cats = await window.SB_CATALOG.getEditionCategories(ed.id);
    if (!cats.length){ renderPendiente(); return; }
    const { data, error } = await window.SB.from('v_public_group_members')
      .select('group_id, edition_category_id')
      .in('edition_category_id', cats.map(c => c.id));
    if (error) throw error;
    const byCat = {};
    (data || []).forEach(r => {
      const c = byCat[r.edition_category_id] || (byCat[r.edition_category_id] = {});
      c[r.group_id] = (c[r.group_id] || 0) + 1;
    });
    const cards = cats.map(c => {
      const name = c.name || (c.categories && c.categories.display_name) || c.code || 'Categoría';
      const sw = CAT_SW[String(c.code || name).toLowerCase()] || 'var(--gold,#edbb52)';
      const head = '<div class="rt-fmt-head"><span class="sw" style="background:'+sw+'"></span>'+esc(name)+'</div>';
      const groups = byCat[c.id];
      if (!groups) return '<div class="rt-fmt-cat">'+head+'<p class="rt-fmt-pend">'+PENDIENTE+'</p></div>';
      const sizes = Object.values(groups);
      const n = sizes.length, players = sizes.reduce((a,b)=>a+b,0);
      const mn = Math.min.apply(null,sizes), mx = Math.max.apply(null,sizes);
      const plan = n >= 2 ? F.planFor(n, sizes) : null;
      const v = plan && plan.primary;
      return '<div class="rt-fmt-cat">'+head+'<dl>'+
        row('Participantes', players)+
        row('Grupos', n)+
        row('Tamaño efectivo', (mn===mx?mn:mn+'–'+mx)+' jugadores')+
        (v ? row('Formato', esc(v.title))+
             row('Primeros clasificados', v.firsts)+
             row('Segundos clasificados', v.seconds)+
             row('Plazas de tercero', v.thirdsSlots)+
             row('Pases directos', v.directPasses || 'ninguno')+
             row('Partidos de acceso', v.accessMatches || 'no se juega')+
             row('Llave principal', v.bracket+' · '+esc(v.bracketLabel.toLowerCase()))
           : row('Formato', 'se define al cerrar los grupos'))+
        row('Fecha límite de ajustes', 'Día 7 de la fase de grupos')+
        '</dl></div>';
    }).join('');
    host.innerHTML = '<p>Valores calculados a partir de los grupos <b>ya publicados</b> de la edición '+esc((ed && ed.name) || 'actual')+
      ' y del tamaño efectivo de cada grupo.</p><div class="rt-fmt">'+cards+'</div>';
  }

  function init(){
    document.querySelectorAll('[data-open-reglas],[data-reglas-open]').forEach(b =>
      b.addEventListener('click', e => { e.preventDefault(); open(); }));
    const q = new URLSearchParams(location.search);
    if (q.get('reglas') === '1' || location.hash === '#reglas-torneo') open();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.REGLAS_TORNEO = { open, close };
})();
