/** Abre el selector de archivos del teléfono y devuelve los bytes, o null si no eligió nada. */
export function elegirArchivo(tipos = '.zip,application/zip'): Promise<{ nombre: string; bytes: Uint8Array } | null> {
  return new Promise((ok) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = tipos;
    i.addEventListener('change', async () => {
      const f = i.files?.[0];
      ok(f ? { nombre: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null);
    });
    i.addEventListener('cancel', () => ok(null));
    i.click();
  });
}

/** Comparte el archivo (Drive, Archivos…) o, si no se puede, lo descarga. */
export async function entregarArchivo(nombre: string, bytes: Uint8Array, tipo = 'application/zip'): Promise<'compartido' | 'descargado' | 'cancelado'> {
  const archivo = new File([bytes as BlobPart], nombre, { type: tipo });
  if (navigator.canShare?.({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: nombre }); return 'compartido'; }
    catch (e) { if ((e as DOMException)?.name === 'AbortError') return 'cancelado'; }
  }
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'descargado';
}
