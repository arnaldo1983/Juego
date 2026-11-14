# Kiko y las Estrellas Perdidas — Arquitectura

Juego de plataformas 2.5D en **Three.js** (r181, en `vendor/`, sin build). Todo en español.
Abrir con `node tools/serve.mjs 8080` → http://localhost:8080

## Dirección de arte (común a todos)
Estilo **AAA estilizado** tipo plataformas modernas de Nintendo / Pixar: formas redondeadas y biseladas,
colores saturados pero armónicos, iluminación suave y cálida, PBR (MeshStandard/Physical), sombras suaves,
bloom sutil, profundidad atmosférica, micro-detalle en texturas (procedurales con canvas, NUNCA imágenes externas).
Nada de copiar a Nintendo: personajes, enemigos y objetos son **originales**.

Temas (`level.theme`):
- `pradera` — mañana dorada: cielo azul intenso, nubes volumétricas, colinas verdes, árboles redondeados, flores. Sol cálido.
- `cueva` — gruta de cristales: roca oscura azul-violeta, cristales luminosos cian/magenta, niebla, luciérnagas.
- `cielo` — islas flotantes al atardecer: cielo rosa/naranja/violeta, mar de nubes debajo, sol bajo enorme.
- `castillo` — fortaleza volcánica nocturna: piedra oscura, lava brillante, brasas, luna roja.

## Coordenadas
1 unidad = 1 casilla. La casilla (x,y) ocupa [x,x+1]×[y,y+1]; y=0 es la fila inferior. El plano de juego es z=0
(los bloques ocupan z∈[-0.5,0.5]). El suelo puede extenderse en profundidad (z negativo) y hacia abajo hasta y≈-12
para que nunca se vea el vacío bajo el terreno. Decorado de fondo en z<-2, primer plano opcional en z>1.5 (sin tapar el juego).
Cámara en perspectiva (fov 36) en z≈18–25 mirando a z=0; se ven ~13.5 casillas de alto.

## Módulos y propietarios (contratos — NO romper firmas)
| Archivo | Contrato |
|---|---|
| `src/main.js` | Bucle, estados, cámara, colisiones. (integrador) |
| `src/config.js`, `physics.js`, `level.js`, `input.js` | Núcleo. (integrador) |
| `src/entities/player.js`, `enemies.js`, `items.js` | Lógica de entidades. (integrador) |
| `src/render/blocks.js` | `new BlockRenderer({scene, level, theme, renderer, quality})`; `onTileChange(x,y,old,new)`; `bump(x,y)`; `update(dt,time,camX)`; `dispose()` |
| `src/render/environment.js` | `new Environment({renderer, scene, camera, quality})`; `setTheme(theme, level)`; `update(dt, camX, camY, time, player)`; `dispose()`. Luces, cielo, fondos parallax, niebla. |
| `src/render/post.js` | `new Post(renderer, scene, camera, {quality})`; `setSize(w,h,pr)`; `setTheme(theme)`; `render(dt)`; `dispose()` |
| `src/entities/playerModel.js` | `createPlayerModel()` → `{root, update(dt, s)}` (ver JSDoc) |
| `src/entities/models.js` | Fábricas de modelos de enemigos/objetos/meta → `{root, update(dt, s)}` |
| `src/fx/particles.js` | `new Particles(scene, camera)`; `emit(type,x,y,opts)`; `popup(text,x,y)`; `update(dt)`; `clear()` |
| `src/audio.js` | `audio.unlock()`, `sfx(name)`, `playMusic(name,{resume})`, `stopMusic()`, `setMusicRate(r)`, `setMuted(m)` |
| `src/ui/hud.js`, `src/ui/touch.js`, `style.css` | HUD/menús DOM y controles táctiles |
| `src/levels/data.js` | `LEVELS` (array de defs `{id, name, theme, time, rows}`) usando `Builder` |

Leyenda de casillas en `src/config.js` (`CHAR_TILE`, `CHAR_ENTITY`).

## Rendimiento (móvil primero)
- `loadLevel()` se llama en cada muerte: **cachear a nivel de módulo** texturas, geometrías y materiales
  (marcar geometrías compartidas con `geometry.userData.shared = true` para que no se liberen).
- Presupuesto: < 250 draw calls, InstancedMesh / geometrías fusionadas para casillas y decorado repetido.
- `quality` ∈ `low|medium|high`: reducir sombras, postprocesado y densidad de decorado en `low`.

## Pruebas visuales
`node tools/shot.mjs "<query>" salida.png [--wait ms] [--keys "ArrowRight:1000,Space:300"] [--mobile] [--eval js]`
Parámetros de URL: `auto=1` (salta el título), `level=N`, `x=NN` (posición inicial), `power=0|1|2`, `fixed=1`, `touch=1`, `q=low|medium|high`.
`window.game` expone el estado del juego para depurar.
