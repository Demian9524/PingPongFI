# Archivos a subir (deploy)

Copia estos archivos sobre tu repo, respetando las rutas, y despliega.
Los cambios NO se ven en ping-pong-fi.vercel.app hasta que estos archivos estén en el repo.

## Nuevos
- registro-gate.js  ← archivo NUEVO, va en la raíz

## Modificados
- supabase/public-sections-admin.js  (filas «Botones rápidos del hero» y «Formulario de inscripción»)
- supabase/academic-page.js          (planteles por categoría vigente + criterio de «Mejor defensa»)
- perfil-jugador.js                  (medallas de podio = mismo ranking que las listas)
- service-worker.js                  (CACHE v253 + precache)
- ControlTorneo.html                 (carga public-sections-admin.js?v=130)
- Pagina Torneo.html                 (oculta la fila .cta-prizes-row + carga registro-gate.js)
- Registro.html, PerfilJugador.html, Categoria2.html, Facultad.html, Directorio.html,
  Grupos.html, Resultados.html, Bracket.html, BracketPublico.html, TableroGrupos.html,
  index.html                         (cargan registro-gate.js)

## Después del deploy
1. Abre ControlTorneo.html con Ctrl+Shift+R (el service worker nuevo debe activarse).
2. Inicia sesión como organizador.
3. En «Secciones de la página pública» las dos filas nuevas aparecen al final de la lista.
