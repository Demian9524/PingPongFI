# Instrucciones del proyecto — Torneo y casa de apuestas

## Hero loading-screen: principios de animación

Cada slide del hero tiene **dos capas animadas independientes** (fondo + persona). Las animaciones deben ser **contrastantes entre sí** — nunca hacer lo mismo en ambas capas ni lo mismo en todos los slides.

### Reglas:
1. **Ejes distintos por slide**: si el fondo se mueve en X, la persona se mueve en Y (slide 1). Si el fondo se mueve en X, la persona también puede moverse en X pero en **sentido contrario** (parallax — slide 2).
2. **Sentido contrario = profundidad**: cuando persona y fondo se mueven en ejes iguales, la persona debe ir en dirección opuesta al fondo para crear ilusión de parallax.
3. **Velocidades diferentes**: el fondo siempre más lento que la persona (fondo: 12-22s, persona: 5-8s).
4. **Varía el efecto por slide**: no repitas el mismo par de animaciones. Ideas disponibles:
   - Fondo: pan X, pan Y diagonal, zoom, combinación
   - Persona: float Y, sway X opuesto al fondo, zoom pulse, diagonal suave, micro-rotación (±0.5deg)
5. **El zoom del fondo va siempre separado** (`heroZoom`, ~22s ease-in-out) para no interferir con el pan.

### Slides actuales:
- **Slide 0** — BG pan derecha→izquierda (`heroPanX`), Persona float Y arriba↔abajo (`heroFloat`)
- **Slide 1** — BG pan izquierda→derecha (`heroPanX2`), Persona sway X derecha→izquierda (sentido contrario al BG, `heroFloat2`)
- **Slide 2** — BG diagonal tl→br (`heroPanDiag`), Persona zoom-pulse sin translate (`heroZoomPulse`) — eje completamente diferente
- **Slide 3** — BG pan vertical Y (`heroPanY`), Persona micro-rotación ±0.4° + sway X (`heroRotateSway`) — combinación única
- **Slide 4** — BG diagonal br→tl (`heroPanDiagRev`, inverso al slide 2), Persona drift diagonal Y+X suave (`heroFloat3`)
- **Slide 7** — BG zoom lento sin pan (`heroZoomStill`), Persona sway X puro (`heroSwayTaco`) — eje distinto al del fondo; taquero en puesto de tacos de canasta
- **Slide 8** — BG diagonal br→tl lento (`heroPanEntrada`, 18s) + zoom propio (`heroZoomEntrada`, 26s) — **sin persona** (`show:'bg'`); entrada de la FI, día
- **Slide 9** — BG paneo horizontal puro L→R (`heroPanVagon`, 20s) + zoom muy leve (`heroZoomVagon`, 30s) — **sin persona** (`show:'bg'`); vagón rojo de la FI
- **Slide 6** — BG pan R→L (`heroPanX`, reuso slide 0), Persona sway X L→R en sentido contrario al BG (`heroSwayR`) — parallax horizontal; rata gordita en papelería FI

### Archivos de assets hero:
- `assets/hero-park.png` — fondo 1 (parque exterior, día)
- `assets/hero-court.png` — fondo 2 (cancha FI, tarde)
- `assets/hero-office.png` — fondo 3 (oficina madera, interior)
- `assets/hero-night.png` — fondo 4 (mesa exterior, noche)
- `assets/hero-office2.png` — fondo 3-bis (oficina FI con diplomas + maqueta, lavish wood paneling) — usado en slide 2
- `assets/hero-unam.png` — fondo 5 (campus UNAM, escultura roja)
- `assets/hero-papeleria.png` — fondo 7 (papelería FI exterior, día)
- `assets/person-1-cut.png` — persona 1 (playera negra Nike)
- `assets/person-2-cut.png` — persona 2 (playera amarilla Brasil)
- `assets/person-3-cut.png` — persona 3 (director en escritorio FI/UNAM)
- `assets/person-4-cut.png` — persona 4 (estudiante traje + gorra)
- `assets/person-5-cut.png` — persona 5 (traje azul, teléfono)
- `assets/person-rata.png` — rata gordita con bote de pelotas (slide 6)
- `assets/hero-entrada.png` — fondo 9 (entrada FI, paso peatonal, día) — slide 8, solo fondo
- `assets/hero-vagon.png` — fondo 10 (vagón rojo UNAM/FI, jardín) — slide 9, solo fondo
- `assets/hero-tacos.png` — fondo 8 (puesto de tacos de canasta, UNAM) — slide 7
- `assets/person-tacos.png` — taquero con charola de tacos (slide 7)
