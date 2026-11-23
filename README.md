# Concurso de pulsadores

Concurso de preguntas para dos equipos, pensado para proyectarse en pantalla grande. Las preguntas se leen de `preguntas.json`; el primer equipo que pulsa bloquea al otro y responde, con rebote automático si falla.

## Puesta en marcha

Necesitas Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abre http://localhost:3000 en el navegador del equipo conectado al proyector y pulsa **F** para pantalla completa.

Para el día del evento es mejor la versión optimizada:

```bash
npm run build
npm start
```

### Abrirla desde otro equipo de la red

Usa la dirección «Network» que muestra la terminal al arrancar, por ejemplo `http://192.168.1.20:3000`.

En modo desarrollo (`npm run dev`), Next.js solo entrega el código interactivo a `localhost`: desde otra IP la página se ve pero los botones no responden. Por eso `next.config.ts` autoriza las redes locales privadas (192.168.x.x, 10.x.x.x, 172.16–31.x.x y nombres `.local`). Si tu red usa otro rango o un nombre propio, añádelo en `allowedDevOrigins` y reinicia `npm run dev`. En modo producción (`npm run build` y `npm start`) esta restricción no existe.

No necesita internet durante el juego: la tipografía y los iconos van incluidos y los sonidos se generan en el navegador.

## Publicarla en Vercel

Útil para abrirla desde cualquier sitio sin instalar nada. Para el evento en sí sigue siendo mejor `npm start` en el equipo del proyector: no depende de la conexión de la sala.

**1. Sube el proyecto a GitHub.** Si todavía no es un repositorio:

```bash
git init
git add .
git commit -m "Concurso de pulsadores"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/concurso.git
git push -u origin main
```

`node_modules` y `.next` ya están en `.gitignore`, así que no se suben.

**2. Impórtalo en Vercel.** En [vercel.com/new](https://vercel.com/new), elige el repositorio y pulsa **Deploy**. Vercel detecta Next.js solo: no hay que tocar el framework, ni los comandos de compilación, ni las variables de entorno. El primer despliegue tarda un par de minutos y deja una URL del tipo `https://concurso.vercel.app`.

A partir de ahí, cada `git push` a `main` vuelve a desplegar.

**Alternativa sin GitHub**, desde la carpeta del proyecto:

```bash
npx vercel          # despliegue de prueba
npx vercel --prod   # despliegue definitivo
```

### Qué cambia respecto a jugar en local

- **Las preguntas viajan dentro del despliegue.** `preguntas.json` se empaqueta con la aplicación, así que para cambiarlas hay que volver a desplegar. «Volver a leer» ya no recoge ediciones del archivo. Lo que sí funciona igual es **«Abrir otro archivo»**: carga un JSON desde el equipo, se lee en el navegador y sirve para una partida puntual sin tocar el despliegue.
- **Por defecto la página pide iniciar sesión en Vercel.** Los proyectos dentro de un equipo llevan activada la *Vercel Authentication*, así que quien abra la dirección sin pertenecer al equipo verá un muro de acceso. Para que entre cualquiera: *Settings → Deployment Protection → Vercel Authentication → Disabled*, y guarda. Si prefieres dejarla restringida, ábrela tú desde la sesión del equipo.
- **Los pulsadores siguen siendo teclas de ese equipo**, igual que en local: la página no se juega entre varios dispositivos, se proyecta desde uno solo.

### Si algo no sale

- **«No Production Deployment. Your Production Domain is not serving traffic.»** El proyecto está creado pero nunca se construyó: importarlo no despliega solo. Entra en la pestaña *Deployments* del proyecto y pulsa **Deploy**, o fuerza uno desde la terminal:

  ```bash
  git commit --allow-empty -m "Desplegar"
  git push
  ```

- **Cambiaste `preguntas.json` y la página sigue mostrando las antiguas.** Falta el despliegue nuevo: haz `git push` y espera a que Vercel termine.

## Diseño

La interfaz sigue Material Design 3, el sistema de diseño de Google:

- **Tipografía:** Google Sans Flex con la escala tipográfica de Material 3 (Display, Headline, Title, Body, Label) y su tamaño óptico ajustado a cada estilo.
- **Medidas:** lienzo de 960 × 540 dp, el que usa Google TV para pantallas vistas a distancia, con márgenes de área segura de 48 × 28 dp y espaciado en rejilla de 4 dp. Todo escala con la resolución del proyector.
- **Color:** esquemas generados con Material Color Utilities. Cada equipo recibe sus propios roles (principal, contenedor y texto sobre contenedor) a partir del color elegido, con contraste garantizado en tema claro y oscuro.
- **Componentes:** tarjetas, campos de texto con contorno, interruptor, chips, botones, botón flotante, barra de herramientas flotante, diálogo e indicador circular de progreso de Material 3, con iconos Material Symbols Rounded.

## Cómo se juega

1. **Configuración.** Elige cuántas **preguntas por ronda** (5 por defecto): se sacan al azar del archivo y la ronda siguiente trae otras distintas, sin repetir ninguna hasta agotarlas. Revisa nombres, colores y pulsadores. Pulsa la tecla de cada equipo para probarla: su mitad de la pantalla se ilumina. «Cambiar pulsador» acepta cualquier tecla, incluidos los pulsadores USB que se presentan como teclado.
2. **Pregunta.** Aparece el número de pregunta; el moderador pulsa **Espacio** para lanzarla. Empieza la cuenta atrás y los pulsadores se activan.
3. **Pulsación.** El primer equipo que pulsa bloquea al rival y la pantalla se llena de su color. El bote de puntos se congela en ese instante: cuanto antes se pulsa, más vale (del 100 % al mínimo configurado).
4. **Veredicto.**
   - Preguntas con opciones: el moderador pulsa **1–6** con la opción que dijo el equipo y el sistema la corrige solo.
   - Preguntas abiertas: **C** si es correcta, **X** si no.
5. **Resultados.**
   - **Acierto:** el equipo suma el bote (confeti en su color).
   - **Fallo:** emojis que salen disparados de la pantalla y la pregunta rebota al otro equipo, con su propio tiempo para responder. Si acierta, se lleva el bote.
   - **Desierta:** si nadie pulsa a tiempo o fallan los dos, cactus y grillos cruzan la pantalla y nadie suma.
6. **Final.** Tras la última pregunta de la ronda, redoble y podio animado. Gana quien tenga más puntos; si empatan, el de menor tiempo medio de respuesta. **Jugar de nuevo** arranca otra ronda con preguntas nuevas.

La pantalla de inicio indica cuántas preguntas quedan sin jugar y **Reiniciar jugadas** las devuelve todas al sorteo. Al cambiar de archivo de preguntas la cuenta empieza de cero.

## Teclas del moderador

| Tecla | Acción |
| --- | --- |
| Espacio | Lanzar la pregunta / pasar a la siguiente |
| 1 – 6 | Opción que respondió el equipo (se corrige sola) |
| C / X | Respuesta correcta / incorrecta |
| Z | Deshacer el último paso (veredicto, pulsación o avance) |
| P | Pausar o continuar el reloj |
| S | Anular la pregunta |
| F | Pantalla completa |
| M | Silenciar o activar el sonido |
| T | Tema claro u oscuro (el claro se ve mejor en salas iluminadas) |
| H | Fijar la barra de controles |
| − / + / 0 | Reducir, aumentar o restablecer el tamaño de la interfaz (también con Ctrl o ⌘) |

Al mover el ratón aparece una barra con estos mismos controles; se oculta sola junto con el cursor a los pocos segundos. Las teclas del moderador no pueden asignarse como pulsador.

Si se recarga la página por accidente, la pantalla de inicio ofrece **Reanudar partida** desde la pregunta en curso con los marcadores intactos.

## El archivo `preguntas.json`

Está en la raíz del proyecto y se vuelve a leer cada vez que se abre la pantalla de inicio o se pulsa «Volver a leer preguntas.json», sin reiniciar el servidor. También puedes arrastrar cualquier otro JSON a la pantalla de inicio o abrirlo con «Abrir otro archivo».

```json
{
  "titulo": "Gran Concurso de Saberes",
  "configuracion": {
    "tiempoPulsar": 20,
    "tiempoResponder": 10,
    "puntos": 100,
    "puntosMinimos": 0.5,
    "factorRebote": 1,
    "mezclar": false,
    "preguntasPorRonda": 5
  },
  "equipos": [
    { "nombre": "Equipo Coral", "color": "#FF5A4A", "tecla": "A" },
    { "nombre": "Equipo Azul", "color": "#3F8CFF", "tecla": "L" }
  ],
  "preguntas": [
    {
      "categoria": "Historia",
      "pregunta": "¿En qué año llegó el ser humano a la Luna?",
      "opciones": ["1965", "1969", "1972", "1959"],
      "correcta": "B"
    },
    {
      "categoria": "Ciencia",
      "pregunta": "¿Cuál es el símbolo químico del oro?",
      "respuesta": "Au",
      "puntos": 150,
      "tiempoPulsar": 15
    }
  ]
}
```

**Configuración** (todo opcional)

| Campo | Qué hace | Por defecto |
| --- | --- | --- |
| `tiempoPulsar` | Segundos para que algún equipo pulse | 20 |
| `tiempoResponder` | Segundos para responder una vez se tiene el turno | 10 |
| `puntos` | Puntos máximos de cada pregunta | 100 |
| `puntosMinimos` | Parte de los puntos garantizada aunque se pulse al final (0,5 = 50 %) | 0.5 |
| `factorRebote` | Parte del bote que gana quien acierta en el rebote (1 = todo) | 1 |
| `mezclar` | Barajar el orden de las preguntas dentro de la ronda | false |
| `preguntasPorRonda` | Cuántas preguntas se juegan en cada ronda, elegidas al azar (`0` = todas) | 5 |

**Equipos** (opcional): `nombre`, `color` en hexadecimal y `tecla`. La tecla puede ser una letra o número (`"A"`, `"7"`) o un código de teclado como `"ShiftLeft"` o `"ShiftRight"`. No se pueden usar las del moderador: Espacio, Enter, C, X, Z, P, S, M, F, H, T, 1–6 ni las del zoom (− + 0).

**Preguntas**

| Campo | Obligatorio | Notas |
| --- | --- | --- |
| `pregunta` | Sí | Texto que se proyecta. Si es largo, se encoge solo para caber entero |
| `opciones` | No | De 2 a 6 opciones. Sin opciones, la pregunta es abierta |
| `correcta` | Con opciones | Letra (`"B"`), número de la opción empezando en 1 (`2`) o el texto exacto (`"1969"`) |
| `respuesta` | Sin opciones | Se muestra al cerrar la pregunta |
| `categoria` | No | Aparece antes de lanzar la pregunta |
| `puntos`, `tiempoPulsar`, `tiempoResponder` | No | Sustituyen a la configuración general solo en esa pregunta |

Si el archivo tiene errores, la pantalla de inicio indica qué pregunta y qué campo corregir, y no deja empezar hasta que esté bien.

## Puntuación y tiempos

- El bote baja en línea recta desde `puntos` hasta `puntos × puntosMinimos` a lo largo de `tiempoPulsar`, y queda fijo cuando un equipo pulsa. Se ve en pantalla bajo el reloj.
- El tiempo de respuesta de un acierto directo es lo que tardó el equipo en pulsar, medido con la marca de tiempo de la propia tecla. En un rebote es el tiempo desde que empezó su turno hasta el veredicto.
- En el podio se muestran aciertos, aciertos en rebote y tiempo medio de respuesta de cada equipo.

## Estructura

```
app/
  api/preguntas/route.ts   lee preguntas.json del disco en cada petición
  layout.tsx, page.tsx, globals.css
components/
  App.tsx       pantalla de inicio o partida
  Setup.tsx     equipos, pulsadores, carga del archivo y reanudar
  Game.tsx      pantalla de juego, teclado y efectos
  Clock.tsx     indicador circular de progreso con centésimas
  Icon.tsx      iconos Material Symbols
  Podium.tsx    redoble y podio final
lib/
  game.ts       reglas del juego (pulsación, rebote, desierta, deshacer)
  questions.ts  lectura y validación del JSON
  effects.ts    confeti, emojis que salen disparados, rodadero del desierto
  sound.ts      sonidos sintetizados con Web Audio
  storage.ts    guardado automático de la partida
  theme.ts      colores Material 3 de cada equipo
next.config.ts  redes locales en desarrollo y empaquetado de preguntas.json al desplegar
preguntas.json
```
