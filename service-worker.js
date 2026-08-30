// ── Service worker (PWA ligera) ─────────────────────────────────────────
// v235 · Las tarjetas ya no muestran «PASE DIRECTO» arriba del nombre: solo
// la posición de grupo (ej. «1.º GRUPO A»), en el bracket y en la imagen
// descargable. El prefijo se recorta también en sourceLabel ya guardado.
// v234 · La imagen descargada del cuadro ya no puede llevar logos de
// carrera: las tarjetas que alternan 50/50 entre logo de facultad y de
// carrera se fuerzan al de facultad justo antes de capturar.
// v232 · bracket-canvas-editor.js tenía una comilla sin cerrar en el tooltip
// de «Descargar imagen» (v230): era un error de sintaxis, así que el archivo
// ENTERO no cargaba y el editor de llaves quedaba roto (no solo la descarga).
// v231 · Bombos en móvil: misma disposición y tamaños que el modal «Ranking
// completo» (lista arriba, estadísticas abajo). Facultades sin participantes
// ya no muestran el código crudo (CONTADURIA_ADMINISTRACION) como nombre.
// v230 · Admin del cuadro: «Descargar imagen» exporta el cuadro como PNG
// recortado al contenido y sin el atuendo del editor, en borrador o publicado.\n// v229 · Grupos: el refresco automático cada 20 s ya no devuelve el carrusel
// al grupo A; conserva el grupo que el visitante está viendo (móvil y web).
// v228 · Los destellos del fondo del cuadro duran mucho menos: 1.4–3 s de
// encendido y apagado, sin quedarse sostenidos.
// v227 · El puerquito dorado animado vuelve a su hueco entre la franja «GRAN
// FINAL» y la placa de campeón: las posiciones guardadas en (0,0) de versiones
// antiguas se ignoran y se recalcula la posición automática.
// v216 · Cuadro público: la barra de scroll horizontal del bracket ahora es
// grande y blanca, y arranca centrada en la Gran Final en vez del borde
// izquierdo. Editor de llaves: borrar o desconectar un enfrentamiento
// vinculado a un partido oficial ya no exige desvincularlo antes (se avisa en
// la confirmación general); quitar un participante de un enfrentamiento
// vinculado ya no pide confirmación aparte.
// v202 · Cuadro por defecto = llave de 16 (OCTAVOS → CUARTOS → SEMIFINAL →
// GRAN FINAL) en TODAS las categorías y con cualquier número de inscritos; el
// bloque central baja a y=382 para que la franja de rótulos de octavos quepa.
// v201 · Editor de llaves, geometría por defecto = la de PruebaEditorLlaves:
// (1) el borrador sellado con la geometría estrecha se redibuja UNA vez al
// abrirlo (revisión de geometría 6, y también si detecta tarjetas encimadas);
// (2) «+ enfrentamiento» / «+ descanso» ya no suelta la tarjeta en el centro de
// la vista: entra en la RETÍCULA del cuadro —columna nueva por fuera del lado
// con menos tarjetas, misma distancia entre columnas, y la columna se reparte
// como en el cuadro publicado (397 px, 60 px entre tarjetas)—; (3) cambiar el
// sistema del formato redibuja el cuadro cuando crea u oculta tarjetas.
// Cachea SOLO estáticos (HTML, CSS, JS estático, imágenes).
// NUNCA cachea: llamadas a Supabase (/rest, /auth, /rpc), tokens ni datos
// privados. Las peticiones a Supabase van network-only.

const CACHE = 'torneo-fi-v246';
// v246 · Modal «Ranking completo»: los espacios del panel derecho ceden con la
// altura de la ventana, así la franja de CATEGORÍA del jugador ya no se corta
// fuera de la tarjeta (Facultad.html y Categoria2.html).
// v245 · Hero: nuevo slide 9 «Vagón FI» (assets/hero-vagon.png), solo fondo,
// paneo horizontal + zoom leve propios. hero-config.js ?v=4.
// v243 · Hero: nuevo slide 8 «Entrada FI · día» (assets/hero-entrada.png), solo
// fondo (show:'bg', sin persona), con paneo diagonal + zoom propios.
// Premios: rediseño de jerarquía y ajustes móviles. hero-config.js ?v=2.
// v242 · Categoría: el hero usa el nombre canónico en PLURAL («Intermedios»),
// no el de la BD que puede venir en singular. academic-page.js ?v=103.
// v241 · PerfilJugador: el podio de categoría incluye a los jugadores ASCENDIDOS
// que jugaron su historia en esa categoría (se revisan los padrones de las
// categorías superiores), así el podio ya no se recorre. perfil-jugador.js ?v=120.
// v240 · PerfilJugador: el podio histórico de CATEGORÍA se calcula en la
// categoría donde el jugador realmente jugó (la de sus partidos oficiales), no
// en la que tiene asignada hoy. Un ascenso (intermedios → avanzados) ya no lo
// mete en el podio de la categoría nueva ni desplaza a los demás; solo cuentan
// los partidos jugados en esa categoría. perfil-jugador.js ?v=119.
// v239 · PerfilJugador: se corrige la fila de trofeos DUPLICADA e intermitente —
// dos llamadas concurrentes a renderPlayerTrophies (el header se re-renderiza al
// resolverse la visibilidad del teléfono) limpiaban antes de su await y ambas
// insertaban después. Token de generación + limpieza previa al insert.
// perfil-jugador.js ?v=118.
const STATIC = [
  'Pagina Torneo.html', 'Registro.html', 'Directorio.html', 'Grupos.html',
  'Resultados.html', 'Bracket.html', 'PerfilJugador.html', 'Facultad.html',
  'Admin.html', 'Diagnostico.html', 'RestablecerPassword.html', 'offline.html',
  'ControlTorneo.html', 'FaseEliminatoria.html', 'TableroGrupos.html', 'ResultadosAdmin.html', 'BracketAdmin.html', 'PreparacionEliminatoria.html', 'PapeletasSorteo.html',
  'css/supabase-pages.css', 'css/design-system.css', 'css/perfil-jugador.css', 'css/directorio.css?v=9', 'directorio.js?v=12', 'supabase/player-card.js?v=99', 'css/bracket-final.css', 'css/bracket-fortnite.css?v=204', 'css/reglas-torneo.css', 'css/pre-group-print.css?v=121', 'css/pre-group-draw-capture.css?v=116', 'manifest.webmanifest',
  'reglas-torneo.js', 'registro-config.js', 'registro-storage.js', 'registro-scoring.js', 'registro.js',
  'supabase/registration.js', 'supabase/registro-bridge.js',
  'torneo-bracket-render.js', 'torneo-bracket-dust.js?v=226', 'bracket-admin-ui.js?v=202', 'bracket-admin-slot.js', 'supabase/bracket-config.js',
  'supabase/pre-group-roster.js?v=106', 'supabase/pre-group-admin.js?v=93', 'supabase/pre-group-print.js?v=121', 'supabase/pre-group-draw-capture.js?v=116', 'supabase/format-engine.js?v=124', 'supabase/format-advisor.js?v=125', 'supabase/public-sections-admin.js?v=128', 'supabase/control-torneo-v2.js?v=119', 'torneo-groups-live.js?v=123', 'torneo-bombos-live.js?v=123',
  'supabase/knockout-print.js?v=167', 'supabase/player-card.js?v=99', 'supabase/academic-page.js?v=103', 'supabase/academic-titles.js?v=109', 'perfil-jugador.js?v=120',
  'assets/logo-fi-vector.svg?v=116', 'assets/logo-torneo-27-1-print.png?v=121'
];
// v186 · Los cuadros guardados con la geometria anterior (nodo 196 px) se
// reescalan solos al abrirlos: se conserva el hueco entre columnas y entre
// partidos, y se simetriza para que las lineas salgan rectas. Ya no hay que
// pulsar "Simetrizar el cuadro" a mano en cada categoria.
// v185 · El editor de lienzo libre usa la MISMA geometria oficial (nodo 292 px,
// fila 56, banda VS 20): puertos a 50/126 px y auto-acomodo reescalado.
// v184 · Escala y jerarquia del bracket (tarjetas +25 %, banda VS propia) · v183 tres zonas de luminosidad · piel «leaderboard»: css/bracket-fortnite.css repinta las
// tarjetas como filas apiladas (logo / nombre / marcador), encabezados de ronda
// en bloques diagonales del color de la categoria, ganador en fila crema con
// texto cafe-negro y planos diagonales decorativos detras del cuadro. Es una
// capa de estilos: el renderer, la topologia, los datos, los estados y las
// conexiones no cambian (solo se ensancharon las columnas para que quepan los
// nombres reales).
// v181 · La pantalla completa del editor funciona tambien DENTRO de
// FaseEliminatoria: el editor vive en un iframe, donde "position:fixed" solo
// llega al borde del iframe y el navegador negaba el fullscreen nativo. Ahora
// los iframes se crean con allow="fullscreen" y el editor avisa al contenedor
// por postMessage para que la pestana ocupe la ventana entera; salir por Esc o
// por cualquiera de los dos botones deja las dos capas en su sitio.
// v180 · "Pantalla completa" ahora es la pantalla completa DE VERDAD: pide
// fullscreen al navegador (Esc o el boton para salir) y la capa ocupa la
// ventana entera sin margen ni bordes. Como en fullscreen nativo solo se pinta
// el elemento ampliado, el modal de tarjeta, el menu del clic derecho y los
// avisos flotantes se cuelgan de el mientras dura.
// v179 · El editor del lienzo estrena "Pantalla completa" y "Minimizar" en su
// barra: el cuadro es alto y la pagina tiene el formato y la bandeja encima, asi
// que ahora se puede sacar el editor a una capa fija del tamano de la ventana
// (con su barra de guardado dentro, Esc para salir) o plegarlo a solo la barra
// para llegar rapido al resto de la pagina.
// v178b · BracketAdmin pierde el formulario "Registrar extraccion del sorteo":
// lo extraido se replica en el lienzo (arrastrar de la bandeja, doble clic para
// abrir la tarjeta), asi que el formulario duplicaba el trabajo. En su lugar,
// al pie del editor hay una barra de guardado pegajosa con estado del borrador,
// Importar de Preparacion, Descartar, Validar, Guardar borrador y Publicar:
// los mismos botones de la barra superior, al alcance de la mano donde se
// trabaja. La importacion de PreparacionEliminatoria se conserva y ahora deja
// un paso de deshacer en el editor (Ctrl+Z).
// v178 · Se acabaron los bloques traslucidos del editor de llaves. Al cambiar
// el formato, las tarjetas que dejaban de existir se guardaban ocultas
// (outOfPlan) y el editor las pintaba al 32% encima del cuadro vigente, ademas
// de ensuciar la validacion con huecos vacios y nodos aislados. Ahora solo se
// conserva un resto si guarda algo irrecuperable (partido oficial vinculado o
// resultado capturado a mano) y en ese caso la validacion lo avisa por su
// nombre; el resto se borra al aplicar el plan, en cada ensure y al abrir el
// lienzo, devolviendo a la bandeja a quien estuviera sembrado ahi.
// v177 · Las etiquetas de medicion se apilan siempre en vertical, un renglon
// por paso. Cuando la medicion era vertical el paso de apartado era el ANCHO
// del propio texto (unas 200 unidades), asi que dos pasos mandaban la etiqueta
// a 400 unidades de su linea: se veia el numero suelto sobre otra zona del
// bracket, o directamente fuera de la pantalla, y la medicion sin numero.
// v176 · Dos arreglos visuales de las guias. (1) Las etiquetas de medicion ya
// no se encaraman unas sobre otras: cada pasada recuerda las cajas ya pintadas
// y aparta la siguiente a lo largo del eje perpendicular a la medicion hasta
// que no toque ninguna, asi que los dos textos siempre se leen. (2) Un reflejo
// de distancia cero ya no cuenta como relacion: salia como "0 px = 0 px" con
// dos segmentos de largo cero y encima gastaba uno de los dos huecos de
// medicion, dejando fuera una relacion util. Eso no es una distancia sino una
// alineacion, y la guia cian ya la comunica.
// v175 · Centrar un nodo entre otros dos exige ahora que QUEPA en el hueco.
// Sin esa guarda, cuando el nodo era mas alto que el hueco los dos huecos
// laterales salian negativos e iguales, pasaban el filtro de igualdad y el
// iman arrastraba a una posicion con las tarjetas encimadas, rotulada
// "-6 px = -6 px". Ademas la etiqueta de esa rama muestra un unico valor para
// los dos lados, como ya hacian gap y mirror, para que la tolerancia de +-1 px
// no pueda rotular "6 px = 7 px".
// v174 · La etiqueta de "centrado entre dos" ya no puede mostrar dos numeros
// distintos ("19 px = 37 px"). Aceptaba la posicion comparando el centro de la
// TARJETA contra el punto medio del hueco, pero rotulaba con los bordes de la
// CAJA, y en el eje Y hay 9 px de desfase entre ambos porque la etiqueta del
// nodo va encima de la tarjeta. Ahora la condicion compara los dos huecos tal
// como se rotulan, asi que los numeros salen iguales por construccion, y el
// iman lleva a la posicion realmente centrada. Ademas, la marca del extremo
// compartido entre dos mediciones encadenadas ya no se dibuja dos veces.
// v173 · Las lineas y etiquetas de medicion ya no salen duplicadas. Se
// deduplicaban por id de nodo, pero las rondas se reparten en columnas: dos
// nodos de la misma columna comparten borde izquierdo y derecho, asi que los
// pares (cuartosArriba, final) y (cuartosAbajo, final) eran el MISMO enunciado
// en el eje X y se dibujaban los dos encimados (igual en Y con los nodos de la
// misma fila). Ahora la clave es la geometria que se va a dibujar, no los ids,
// y el hueco que liberaba el duplicado lo ocupa una segunda relacion util.
// v172 · Las guias marcan TODAS las separaciones iguales que se cumplen en la
// posicion final, no solo la que gano el iman: si al mover un nodo quedan
// iguales dos distancias distintas, se dibujan las dos (hasta 2 por eje). Y la
// simetria respecto a un nodo CONECTADO pesa mas al elegir el ajuste, para
// poder llegar a la posicion simetrica que se busca en vez de engancharse a
// cualquier borde que pase mas cerca.
// v171 · Guias inteligentes en el lienzo del bracket (nuevo
// bracket-canvas-guides.js). Al arrastrar un nodo, varios nodos o el bloque
// central aparecen guias discontinuas cian cuando coinciden bordes o centros,
// y lineas naranjas con la medida cuando dos separaciones son iguales o un
// nodo queda reflejado respecto de otro o del eje del bloque central. El
// iman usa 6 px de PANTALLA convertidos a unidades del lienzo, asi que se
// siente igual a cualquier zoom; Alt mantenido durante el arrastre lo apaga y
// el boton "Guias" de la barra lo activa o desactiva. La capa es temporal:
// no entra en el JSON, no crea nodos ni conexiones y no sale en la vista
// publica.
// v170 · Una sola linea entrando por un lado se pega al punto CENTRAL de la
// tarjeta en vez de a la altura de su chip: el anclaje de arriba o abajo sigue
// decidiendo a que espacio llega el ganador (A o B), pero la llave se dibuja
// recta en lugar de dar la vuelta. Con dos lineas en el mismo lado no cambia
// nada (se fusionan o se separan segun el ajuste del nodo). Ademas, mover una
// conexion ya existente a otro anclaje de SU MISMA tarjeta vuelve a funcionar:
// nearestInPort ya no descarta la tarjeta entera, solo el anclaje agarrado, y
// le exige punteria corta para no pisar el gesto de cambiar el lado de union.
// v169 · Dos correcciones del cuadro eliminatorio. (1) La ronda de acceso se
// repartia sobre la lista alternada l,r,l,r... y el sobrante caia SIEMPRE a la
// derecha: con 2 partidos de acceso la izquierda se quedaba con 0 y la derecha
// con 2, y con 6 salia 2/4. Ahora se divide primero entre los dos lados (el
// impar a la izquierda) y solo despues se esparce dentro de cada lado, asi que
// los dos lados nunca difieren en mas de un partido. El catalogo de anclajes
// sube a 16 por lado (llave de 32) y un id fuera de catalogo ya no se cuenta
// como cuartos. (2) Los tres anclajes de cada lado caen exactamente donde se
// pega su linea (A y B en el centro de su chip, C en el centro de la tarjeta),
// el central deja de ser el mas pequeno, todos estrenan zona de agarre
// invisible y al soltar gana el anclaje MAS CERCANO: con el lienzo alejado el
// punto central medía 5 px y no dejaba unir nada.
// v168 · Preparación pierde el formulario «Registrar emparejamiento extraído»
// (la captura vive en «Editar el bracket») y el panel de documentos de
// BracketAdmin deja de enlazar bombos y papeletas: ya se imprimieron antes.
// v167 · Lista maestra y acta del sorteo eliminatorio dejan PapeletasSorteo y
// pasan al mismo documento del primer sorteo: hoja A4 con la banda negra, los
// dos logotipos, rejilla de datos y pie de reglas, en el mismo modal con
// «Imprimir» y «Descargar archivo». knockout-print.js/knockout-prep.js ?v=167.
// v166 · Las papeletas eliminatorias estrenan el MISMO menú del primer sorteo:
// modal con vista previa a escala real, «Imprimir» y «Descargar archivo». La
// edición se muestra corta (2027-1) en el papelito y en la cabecera, y el
// subtítulo de hoja deja de repetir la categoría.
// v165 · Las papeletas del sorteo ELIMINATORIO adoptan el papelito físico del
// sorteo de grupos: 80 × 30 mm, cuatro módulos, css/pre-group-print.css y los
// mismos logotipos incrustados (nuevo supabase/knockout-print.js, que reutiliza
// loadAssets/docShell/logoFi/logoCup de pre-group-print.js). Bombos y pases
// directos usan el papelito de persona; posiciones y acceso, el de destino.
// v164 · El formato preparado se refleja en «Bombos al momento»: Preparación
// publica su vista (variante + tamaños efectivos) en localStorage
// kp-format-view:<edcat> y torneo-bombos-live.js la aplica, marcando el kicker
// con «FORMATO AJUSTADO POR STAFF (SOLO EN ESTE NAVEGADOR)». Si el ajuste
// cambia el formato respecto a los datos reales, Preparación muestra un aviso
// rojo con «Volver al automático». La opción recomendada nunca desaparece.
// v163 · Preparación eliminatoria más simple y sin contradicción: el resumen
// describe la VARIANTE ELEGIDA (antes siempre la primaria, por eso «llave
// directa» venía con el detalle del acceso), se antepone una frase en lenguaje
// llano y los tamaños efectivos por grupo pasan a un plegable «Ajustes
// avanzados». format-engine.js y knockout-prep.js ?v=163.
// v162 · NUEVA PÁGINA FaseEliminatoria.html: un solo centro para todo el
// bracket —preparación y bombos, imprimibles del sorteo, captura de lo
// extraído y edición/publicación de la llave— en pestañas que montan las
// herramientas existentes en modo embebido (?embed=1 oculta su nav propio).
// ControlTorneo estrena el acceso destacado «Fase eliminatoria · Bracket».
// v161 · BOMBO 3 se separa del 2: su fila usa un fondo propio casi negro
// (band.bg = @bombo3bg al 66%) mientras el acento conserva color para la
// leyenda; el bombo 2 sube a 24%. Ladder: claro → saturado → oscuro → gris.
// v160 · Más contraste entre bombos: BOMBO 1 sube a un tono claro (40% color de
// categoría + crema), BOMBO 3 baja a uno profundo, y cada zona lleva su propia
// intensidad de fondo (bgPct 30/19/26/6). Acento de fila 3px → 5px.
// v159 · La dirección correcta: manda la paleta de los BOMBOS y la Fase de
// grupos la adopta. La config vieja guardada en la base (azul/amarillo/gris)
// se normaliza a las zonas de bombo al leerla, en la página y en el admin.
// v158 · Fase de grupos: las zonas de clasificación son por defecto los BOMBOS
// —BOMBO 1 / 2 / 3 / NO ENTRAN AL SORTEO— con los mismos tonos que «Bombos al
// momento» (tokens @bombo1/@bombo2/@bombo3/@fuera que siguen el color de la
// categoría). Se van el azul y el amarillo fijos; el admin sigue pudiendo
// cambiarlo. qualification-config.js, qualification-admin.js,
// torneo-groups-live.js y torneo-bombos-live.js ?v=158.
// v157 · Medallas en móvil: la caja se ajusta al contenido más ancho de las dos
// y ambas se estiran a esa medida — mismo tamaño entre sí, sin el hueco dorado
// que dejaba el ancho fijo. css ?v=134.
// v156 · Se quita la flecha «›» de la ficha armada (la fuente condensada no la
// tiene y salía como un fragmento suelto) y la categoría que se está viendo
// conserva su filo crema al plegarse, para saber dónde estás.
// v155 · La preselección no encogía la ficha ACTIVA: el selector
// body[data-cat=…] a[data-catopt=…] pesaba más que .is-preselect a. Resuelto
// subiendo la especificidad de las reglas de preselección.
// v154 · Fix de los dos toques: se activaban sólo con (hover:none) —en muchos
// móviles y ventanas angostas no aplicaba— y el :hover pegado tras el toque
// abría la ficha sola. Ahora entra también por ancho y el hover se limita a
// punteros reales.
// v153 · Selector de categoría en táctil: dos toques. El 1º preselecciona (abre
// la ficha en oscuro con filo de color y encoge las demás), el 2º entra. Tocar
// fuera del menú cancela la preselección.
// v152 · La categoría activa se marca en <body> antes de pintar el selector:
// así la ficha activa nace abierta y no anima su apertura en cada carga.
// v151 · La ficha activa sólo se encoge cuando el cursor apunta otra ficha;
// antes bastaba con entrar al menú y se colapsaban las tres.
// v150 · Navbar de categorías en móvil: la ficha activa se ajusta a su texto en
// vez de estirarse hasta el borde, chips y alturas más compactos.
// v149 · Móvil: el ancho de la medalla se deriva del tamaño del número (3.6×),
// misma proporción que en escritorio — antes iba atada a vw y quedaba aplastada
// con aire sobrante a la derecha. css ?v=133.
// v148 · Móvil: el selector de categoría deja los chips de color fijos y la
// ficha activa ocupa el ancho restante (antes desbordaba); las medallas del
// perfil se compactan (ancho 36vw, relleno más ajustado). css ?v=132.
// v147 · Selector: al apuntar una ficha se despliega ella y se encogen las
// demás (también la activa), sin clic de por medio.
// v146 · Selector plegado: de las categorías inactivas queda visible el chip de
// color (no desaparecen del todo); al pasar el cursor se despliega la ficha.
// v145 · Categoria2: el selector de categoría se rehace con el lenguaje del
// botón «Ver ranking completo» (barra oscura, riel de color, chip diagonal con
// barras de nivel, encendido a crema) y se pliega: sólo la categoría activa se
// ve, las otras aparecen al pasar el cursor.
// v144 · El nombre del jugador reduce su tamaño por tramos de longitud (s/m/l/xl)
// para que los nombres largos no ocupen cuatro renglones. css ?v=131, js ?v=116.
// v143 · Las dos medallas se fuerzan a un ANCHO FIJO (184px, fluido en móvil):
// min-width no bastaba porque los dígitos italic miden distinto. css ?v=130.
// v142 · La leyenda de la medalla de categoría usa el color CANÓNICO de la
// categoría (#37bb66 / #3a63f0 / #dd3b2c), no la variante aclarada de
// categoryTone(). js ?v=115.
// v141 · Fix: el chip «N Jugadores» de Facultad/Categoría reutiliza .pjx-rank-pos
// sin núcleo interno y había perdido fondo y relleno con el rediseño de medallas.
// Se le devuelve su forma original. css ?v=129.
// v140 · Etiquetas al color correcto: la de facultad toma el tono del metal
// ganado (oro/plata/bronce) y la de categoría el color exacto de la categoría,
// título y subtítulo. css ?v=128, js ?v=114.
// v139 · Una sola medalla para los dos podios: la de categoría adopta el mismo
// formato institucional de la de facultad (grafito + núcleo metálico), idénticas
// en tamaño y silueta. El color de categoría vive sólo en la etiqueta. css ?v=127.
// v138 · El chasis de categoría pierde su plinto inferior: era la «línea de
// color» que caía justo sobre la marca de facultad. Ahora es un marco uniforme
// y las dos marcas respiran más (gap 18px). css ?v=126.
// v137 · Se elimina el conector de color y la marca de FACULTAD queda aislada:
// neutraliza --pjx-accent en su raíz y resetea chasis, base, recorte, filtro y
// pseudo-elementos. Se ve idéntica en las tres categorías. css ?v=125, js ?v=113.
// v136 · Medallas rediseñadas en DOS piezas: CHASIS (contexto) + NÚCLEO metálico
// (posición). Categoría = chasis de color con cortes diagonales y conector a la
// etiqueta; facultad = chasis de grafito institucional, limpio. Misma caja
// exterior en ambas. css ?v=124, js ?v=112.
// v135 · Sistema de medallas (OPCIÓN A): el METAL dice la posición (oro/plata/
// bronce) y el COLOR dice el contexto. La placa nunca se tiñe: el color de
// categoría queda como acento (filo, línea base, halo sutil, texto) y la de
// facultad usa acentos crema institucionales. css ?v=123, js ?v=111.
// v134 · PerfilJugador: se elimina renderRank — la posición de grupo NUNCA sale
// en el hero (tampoco en el flujo legacy); ese espacio es solo para podio
// histórico de facultad y/o categoría. perfil-jugador.js ?v=110.
// v133 · PerfilJugador: la marca del hero es SIEMPRE el podio histórico. Antes,
// si el jugador top-3 tenía grupo activo, se pintaba de oro su posición de grupo
// («#1 DE 4 · GRUPO D»), mezclando dos datos distintos. perfil-jugador.js ?v=109.
// v132 · PerfilJugador: los dos podios ahora son INDEPENDIENTES — la marca de
// categoría ya no exigía estar también en el top 3 de la facultad (por eso un
// #2 de Intermedios no mostraba nada). perfil-jugador.js ?v=108.
// v131 · PerfilJugador: ambas marcas de podio comparten el MISMO marco de 2px
// (transparente en la de facultad) para que nunca difieran de tamaño. css ?v=122.
// v130 · PerfilJugador: la marca del podio de CATEGORÍA se distingue de la de
// facultad sin perder el metal del lugar — marco y sombra en el color de la
// categoría (rojo/azul/verde). perfil-jugador.js ?v=107, css ?v=121.
// v129 · PerfilJugador: la marca de podio histórico baja a la MITAD de tamaño
// (medida por defecto) y, si el jugador está en el podio de su facultad Y en
// el de su categoría, se apila una segunda marca idéntica justo arriba con el
// nombre de la categoría en su color y «PODIO HISTÓRICO». perfil-jugador.js ?v=106.
// v128 · Centro de control: la visibilidad pública cubre ahora CUATRO bloques
// (lista de participantes, fase de grupos, bombos y bracket) y cada uno tiene
// tres estados —Visible / Vacía / Oculta—. «Vacía» (y una sección visible que
// se quede sin datos) muestra el aviso «aún no ha sido publicado» con el mismo
// marco punteado del bracket. supabase/public-sections-admin.js ?v=128.
// v127 · «Bombos al momento»: el panel de estadísticas (derecha) baja de tono
// —--ap-p1/--ap-p2 más oscuros en las cuatro categorías, con la roja como la
// más marcada— para separarlo mejor de la tabla de la izquierda.
// v126 · papelitos del sorteo: alto exacto 30 mm (3 cm) con ancho
// proporcional (80 × 30 mm recomendado, doblado 20 × 15 mm), color por
// categoría tomado del menú principal (rojo Avanzados, azul Intermedios,
// verde Principiantes) y logo 27-1 a color (assets/logo-torneo-27-1-print.png).
// Suben css/pre-group-print.css y supabase/pre-group-print.js a ?v=121.
// v125 · «Bombos al momento» adopta el formato EXACTO del modal «Ranking
// completo» de Facultad: tabla de 3 columnas (# · Jugador · % Vict.), panel
// derecho al 45% con el ring y las estadísticas a tamaño completo, y se
// conservan las bandas de bombo y los colores rojo/azul/verde por categoría.
// v124 · REGLAMENTO 2026: nuevo supabase/format-engine.js (motor único del
// reglamento: repartos 3–5 con objetivo 4, tamaño efectivo, fórmula general
// B/D/T y sistema de terceros 5–4–3). ASESOR DE FORMATO en ControlTorneo
// (panel FORMATO RECOMENDADO + simulador que no toca Supabase), bombos 1/2/3
// sin ranking interno en PreparacionEliminatoria, reglas públicas
// reestructuradas (reglas-torneo.js) y bombos/terceros públicos sin comparar
// primeros ni segundos entre grupos.
// v123 · bombos: una banda por zona configurada (3.º y 4.º ya no se mezclan),
// corte derivado de la matriz de formato cuando «mejores terceros» está
// apagado, chip de estado en columna max-content y aviso cuando aún no hay
// categoría elegida.
// v122 · el modal de bombos en móvil copia las proporciones de la tabla de
// grupos (escudo 42/32, posición 26-24px, nombre 20px, mono 15px, pts 25px).
// v121 · el modal de bombos ocupa la pantalla completa y usa las métricas de
// la tabla de grupos (logo 42px, números Burbank, medalla en el #1).
// v120 · «Bombos al momento» pasa a botón + modal con la misma piel que el
// modal «Ranking completo» de Facultad.html (torneo-bombos-live.js ?v=120).
// v119 · BOMBOS AL MOMENTO en Pagina Torneo.html (torneo-bombos-live.js, tabla
// única por categoría con bombos y corte de puntos, alimentada por los
// standings que ya carga torneo-groups-live.js ?v=119) e interruptores de
// visibilidad de secciones públicas (supabase/public-sections-admin.js ?v=119,
// localStorage torneo_sections_cfg_v1) en el Centro de control.
// v118 · el bloque de formato explica en palabras llanas «lo que pide el
// reglamento» vs «así están hoy» (format-advisor.js ?v=118).
// v117 · FORMATO QUE CORRESPONDE en ControlTorneo.html: nuevo
// supabase/format-advisor.js (?v=117, solo cálculo: repartos válidos + matriz
// de formato por número de grupos) y control-torneo-v2.js sube a ?v=117.
// v116 · ACTA Y CAPTURA DEL SORTEO FÍSICO en ControlTorneo.html: nuevos
// supabase/pre-group-draw-capture.js y css/pre-group-draw-capture.css (?v=116).
// Borrador LOCAL en localStorage; ninguna escritura en Supabase. Suben también
// pre-group-print.js/.css y control-torneo-v2.js a ?v=116.
// v115 · el logo del torneo se recorta por su caja de transparencia real, así
// conserva el trazo blanco 27-1 detrás del cerdito; módulo 4 sobre negro.
// v114 · papeleta del sorteo rediseñada a 96 × 36 mm (cuatro módulos de
// 24 mm, tres dobleces → 24 × 18 mm), logo institucional assets/logo-fi-vector.svg
// y logo del torneo assets/logo-torneo-print.png incrustados como Data URI.
// Suben css/pre-group-print.css y supabase/pre-group-print.js a ?v=114.
// v113 · IMPRIMIBLES DEL SORTEO DE GRUPOS en ControlTorneo.html: suben
// supabase/pre-group-print.js y css/pre-group-print.css (nuevos, ?v=113) y
// supabase/control-torneo-v2.js (?v=113, monta el módulo). Solo lectura:
// usa admin_registrations() y no escribe nada en Supabase.
// v110 · la vista Podio ya no lleva la línea descriptiva del ranking.
// v109 · la vista Podio estrena cabecera de widget (medalla dorada +
// "Mejor puntaje histórico"), igual que rachas / sets / defensa.
// v108 · ranking completo: mínimo de 2 partidos y bloque "Aún sin ranking" al
// final para quienes no lo alcanzan (sin posición ni puntaje).
// v97 · títulos de la facultad como la fila de trofeos del perfil, en el hero.
// v95 · la lista de participantes filtra por la categoría elegida y usa la
// ficha compartida supabase/player-card.js (extraída de academic-page.js).
// v94 · la lista previa al sorteo se muestra en Pagina Torneo.html (arriba de
// Fase de Grupos): suben pre-group-roster.js y torneo-groups-live.js a ?v=94.
// v93 · lista previa al sorteo: se agregan supabase/pre-group-roster.js (público,
// Grupos.html) y supabase/pre-group-admin.js (ControlTorneo.html), y se sube la
// versión de supabase/control-torneo-v2.js. Las tres con ?v=93, igual que el HTML.
// v92 · precache revisado: solo HTML/CSS/JS que las páginas cargan de verdad.
// Se agregaron los scripts reales del formulario de registro. No se precachea
// ninguna librería de CDN ni ningún archivo de herramientas de diseño.

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC.map(u => new Request(u, { cache: 'reload' })))).catch(()=>{}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function isSupabase(url){
  return /\.supabase\.co\//.test(url) || /\/(rest|auth|rpc|storage|realtime)\//.test(url);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // no interceptar POST/RPC
  const url = req.url;

  // Supabase → network-only, jamás cachear datos
  if (isSupabase(url)){
    e.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  // CDN de supabase-js / fuentes → stale-while-revalidate
  if (/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url)){
    e.respondWith(caches.open(CACHE).then(async c => {
      const cached = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => cached);
      return cached || net;
    }));
    return;
  }
  // Navegación HTML → network-first (evita servir páginas viejas)
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')){
    e.respondWith(
      fetch(req).then(r => {
        if (r.ok){ const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
        return r;
      }).catch(() => caches.match(req).then(cached => cached || caches.match('offline.html')))
    );
    return;
  }
  // JS y CSS propios → stale-while-revalidate (evita servir versiones viejas)
  if (/\.(js|css)$/.test(url.split('?')[0])){
    e.respondWith(caches.open(CACHE).then(async c => {
      const cached = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok){ c.put(req, r.clone()); } return r; }).catch(() => cached);
      return net;
    }));
    return;
  }
  // Estáticos propios → cache-first con fallback offline para navegación
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(r => {
      if (r.ok && r.type === 'basic'){ const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => req.mode === 'navigate' ? caches.match('offline.html') : undefined))
  );
});
