// Voz: el reconocimiento de voz del navegador (en Chrome de Android lo procesa Google). La app no guarda ni envía el audio.
interface Reconocedor {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type Fabrica = new () => Reconocedor;
const fabrica = (): Fabrica | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: Fabrica; webkitSpeechRecognition?: Fabrica };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
export const hayVoz = () => !!fabrica();

const ERRORES: Record<string, string> = {
  'not-allowed': 'No tengo permiso para usar el micrófono. Puedes escribir tu frase.',
  'service-not-allowed': 'El navegador no deja usar la voz aquí. Puedes escribir tu frase.',
  'no-speech': 'No escuché nada. Intenta otra vez o escribe tu frase.',
  'audio-capture': 'No encontré un micrófono. Puedes escribir tu frase.',
  network: 'La voz necesita internet. Puedes escribir tu frase.'
};
/** Escucha una frase. Devuelve cómo detenerla. `alTexto` recibe lo que se va entendiendo y si ya es la versión final. */
export function escuchar(alTexto: (t: string, final: boolean) => void, alTerminar: (problema?: string) => void): () => void {
  const R = fabrica();
  if (!R) { alTerminar('Este navegador no tiene reconocimiento de voz. Puedes escribir tu frase.'); return () => {}; }
  const r = new R();
  r.lang = 'es-MX';
  r.interimResults = true;
  r.maxAlternatives = 1;
  r.continuous = false;
  let problema: string | undefined;
  r.onresult = (e) => {
    const lista = Array.from(e.results as ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>);
    const t = lista.map((x) => x[0]?.transcript ?? '').join(' ').trim();
    const final = lista.length > 0 && !!(lista[lista.length - 1] as { isFinal?: boolean }).isFinal;
    if (t) alTexto(t, final);
  };
  r.onerror = (e) => { problema = ERRORES[e.error ?? ''] ?? 'No pude usar la voz. Puedes escribir tu frase.'; };
  r.onend = () => alTerminar(problema);
  try { r.start(); } catch { alTerminar('No pude usar la voz. Puedes escribir tu frase.'); }
  return () => { try { r.stop(); } catch { /* ya estaba detenido */ } };
}
