# Cuerpo, Mente y Alma

App personal de bienestar de Les (PWA). Se publica en https://bienestar.lesliedickinson.dev.

- Todos los datos viven solo en el teléfono (IndexedDB). Sin cuentas ni servidor.
- Este repositorio es público y solo tiene código. El contenido del libro Strong Curves, del Reto 25 y las letras de canciones llegan en un archivo privado ("contenido personal") que se carga dentro de la app.
- Svelte 5 + TypeScript + Vite, Dexie, fflate, vite-plugin-pwa.

## Módulos
`src/core` es la base común. Cada módulo de `src/modules/<módulo>` abre una puerta pública (`index.ts`); ESLint impide usar archivos internos de otro módulo.

## Comandos
- `npm run dev`: probar en la computadora.
- `npm test`: reglas (Vitest).
- `npm run e2e`: pantallas a 412, 384 y 360 px (Playwright + axe-core).
- `npm run lint` y `npm run check`.

Cada push a `main` pasa por estas revisiones y, si todo pasa, se publica en GitHub Pages.
