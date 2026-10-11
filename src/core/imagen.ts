/** Reduce una foto para que ocupe poco: lado largo de 1280 px, JPEG. Si el teléfono no puede, guarda la original. */
export async function reducirFoto(archivo: File | Blob, lado = 1280): Promise<Blob> {
  try {
    const img = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    const k = Math.min(1, lado / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
    const lienzo = document.createElement('canvas');
    lienzo.width = w; lienzo.height = h;
    const c = lienzo.getContext('2d');
    if (!c) return archivo;
    c.drawImage(img, 0, 0, w, h);
    img.close?.();
    const b = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.82));
    return b ?? archivo;
  } catch {
    return archivo;
  }
}
