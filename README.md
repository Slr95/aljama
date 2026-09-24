# Aljama — Caminantes del Velo

RPG de combate por turnos en el navegador. En el borde de un desierto de cristal-arena se alza **Aljama**, una ciudad-caravana de teja, turquesa y faroles. El último eclipse hundió tres templos; cuatro caminantes bajan a sellarlos. Si caen, se quedan. Si vuelven, la ciudad crece.

Jugar en línea: [aljama.vercel.app](https://aljama.vercel.app)

## Cómo se juega

- Recluta caminantes en la plaza y arma una **compañía de cuatro**.
- El **puesto** importa: el 1 es la vanguardia y el 4, la retaguardia. Cada arte se lanza desde ciertos puestos y pega a ciertos rangos.
- Elige un umbral (Templo de la Arena Roja, Jardines de Coral Seco, Núcleo del Eclipse) y avanza sala a sala.
- Tras cada combate puedes equipar el botín antes de seguir. Si huyes, los héroes vuelven y el saco se pierde. Si todos mueren, mueren de verdad.

La partida se guarda en el navegador.

## Clases

| Clase | Rol | Idea |
| --- | --- | --- |
| Guerrero | Vanguardia | Aguanta el frente y obliga al enemigo a mirarlo. |
| Pícaro | Filo | Críticos, veneno y desvalijar. |
| Clérigo | Baliza | Cura, bendice y golpea con luz. |
| Mago | Canal | Magia a distancia y daño en área. |
| Explorador | Ojo | Disparos desde atrás y marcas. |
| Bardo | Eco | Cambia el ritmo de toda la compañía. |
| Alquimista | Crisol | Ácidos, tónicos y vapores. |
| Tejedor | Hilo | Arrastra enemigos al frente y les quita refuerzos. |
| Danzante | Paso | Golpea desde casi cualquier puesto y cambia de sitio. |

## Técnica

SPA en vanilla JavaScript con [Vite](https://vite.dev). Sin backend: estado y guardado en `localStorage`.

```bash
npm install
npm run dev
```

La build de producción es `npm run build` (salida en `dist/`).
