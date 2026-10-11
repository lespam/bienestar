<script lang="ts">
  import type { Receta } from '../../core/db';

  // Tus fotos de platillos y unas ideas dibujadas, para mirar antes de planear. Empieza cerrada.
  let { recetas }: { recetas: Receta[] } = $props();
  let abierta = $state(false);

  const fotos = $derived(recetas.filter((r) => r.img).sort((a, b) => a.n.localeCompare(b.n, 'es')).slice(0, 6));
  let urls = $state<Record<string, string>>({});
  $effect(() => {
    const nuevas: Record<string, string> = {};
    for (const r of fotos) nuevas[r.id] = URL.createObjectURL(r.img!);
    urls = nuevas;
    return () => { for (const u of Object.values(nuevas)) URL.revokeObjectURL(u); };
  });
</script>

<section aria-label="Inspiración">
  <button class="insp-h insp-tg" aria-expanded={abierta} aria-controls="insp" onclick={() => (abierta = !abierta)}>
    <span><b>Inspiración</b><small>Tus fotos e ideas</small></span><i aria-hidden="true">›</i>
  </button>
  <div class="insp" id="insp" hidden={!abierta}>
    {#each fotos as r (r.id)}
      <figure>
        {#if urls[r.id]}<img src={urls[r.id]} alt={'Tu foto de ' + r.n} style="width:148px;height:148px;object-fit:cover;display:block" />{/if}
        <figcaption><span class="tag t">Tu foto</span>{r.n}</figcaption>
      </figure>
    {/each}
    <figure>
      <svg viewBox="0 0 148 148" aria-hidden="true"><rect width="148" height="148" fill="#3a3049" /><circle cx="74" cy="74" r="52" fill="#f3eef7" opacity=".92" /><circle cx="74" cy="74" r="42" fill="none" stroke="#d9cfe6" stroke-width="2" /><path d="M40 78a34 34 0 0 1 34-34v34z" fill="#fffaf0" stroke="#e8dfcf" /><path d="M74 44a34 34 0 0 1 34 34H74z" fill="#5a2f2a" /><g fill="#fffaf0"><circle cx="86" cy="60" r="2" /><circle cx="94" cy="68" r="2" /></g><text x="74" y="108" text-anchor="middle" font-size="12" font-family="sans-serif" font-weight="700" fill="#322840">arroz + frijol</text></svg>
      <figcaption><span class="tag s">Ilustración</span>Arroz + frijoles: proteína completa</figcaption>
    </figure>
    <figure>
      <svg viewBox="0 0 148 148" aria-hidden="true"><rect width="148" height="148" fill="#3a3049" /><g><rect x="14" y="16" width="120" height="36" rx="8" fill="#a8dcc5" /><rect x="14" y="56" width="120" height="36" rx="8" fill="#f2b8c6" /><rect x="14" y="96" width="120" height="36" rx="8" fill="#c9b3f5" /></g><g font-family="sans-serif" font-size="13" font-weight="700" fill="#1b1622" text-anchor="middle"><text x="74" y="39">grano</text><text x="74" y="79">proteína</text><text x="74" y="119">verdura</text></g></svg>
      <figcaption><span class="tag s">Ilustración</span>Prep del domingo: 3 bases para la semana</figcaption>
    </figure>
  </div>
</section>
