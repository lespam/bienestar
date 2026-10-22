import { mount } from 'svelte';
import '@fontsource/young-serif/400.css';
import '@fontsource-variable/nunito-sans/opsz.css';
import './core/calma.css';
import App from './App.svelte';
import { nav } from './core/nav.svelte';
import { avisos } from './core/aviso.svelte';
import { plataforma } from './core/plataforma.svelte';
import { copiaAntesDeActualizar, limpiarCopias } from './core/respaldo';
import { cargarPrefs } from './modules/ajustes';
import { cargarIA } from './modules/ia';

async function iniciar() {
  // Antes de abrir la base: si va a cambiar de estructura, guarda una copia interna de lo que ya tienes.
  await copiaAntesDeActualizar();
  await cargarPrefs();
  await cargarIA();
  await limpiarCopias();
  plataforma.revisarGuardado();
  nav.conectar((t) => avisos.mostrar(t));
  mount(App, { target: document.getElementById('app')! });

  // Versión nueva: Inicio muestra "Actualizar". La app nunca se recarga sola.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    const { registerSW } = await import('virtual:pwa-register');
    const actualizar = registerSW({ onNeedRefresh: () => plataforma.ofrecerVersion(() => actualizar(true)) });
  }
}
iniciar();
