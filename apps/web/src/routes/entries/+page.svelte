<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let entries = $state([]);
  let topics = $state([]);
  let total = $state(0);
  let filterTopic = $state('');
  let search = $state('');
  let error = $state('');
  let showForm = $state(false);

  let form = $state({ topic_id: '', title: '', summary: '', url: '', source_name: '', published_at: '', relevance: 'media' });

  async function load() {
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (filterTopic) params.set('topic_id', filterTopic);
      if (search) params.set('search', search);
      const [e, t] = await Promise.all([
        api(`/entries?${params}`),
        api('/topics'),
      ]);
      entries = e.entries;
      total = e.total;
      topics = t.topics;
    } catch (err) {
      error = err.message;
    }
  }

  onMount(load);

  async function create(e) {
    e.preventDefault();
    error = '';
    try {
      await api('/entries', {
        method: 'POST',
        body: { ...form, published_at: form.published_at || null },
      });
      showForm = false;
      form = { topic_id: '', title: '', summary: '', url: '', source_name: '', published_at: '', relevance: 'media' };
      await load();
    } catch (err) {
      error = err.message;
    }
  }

  async function remove(id) {
    if (!confirm('¿Eliminar registro?')) return;
    await api(`/entries/${id}`, { method: 'DELETE' });
    await load();
  }
</script>

<h1>Registros de inteligencia</h1>
<div class="row" style="margin-bottom:1rem">
  <select bind:value={filterTopic} onchange={load} style="width:auto;margin:0">
    <option value="">Todos los temas</option>
    {#each topics as t}<option value={t.id}>{t.name}</option>{/each}
  </select>
  <input placeholder="Buscar por título…" bind:value={search} onkeydown={(e) => e.key === 'Enter' && load()} style="width:auto;flex:1;margin:0" />
  <button onclick={load}>Buscar</button>
  <button onclick={() => (showForm = !showForm)}>{showForm ? 'Cancelar' : 'Nuevo registro'}</button>
</div>
{#if error}<p class="error">{error}</p>{/if}
<p class="muted">{total} registros</p>

{#if showForm}
  <div class="card">
    <form onsubmit={create}>
      <div class="row">
        <select bind:value={form.topic_id} required style="flex:1;margin:0">
          <option value="" disabled>Selecciona tema</option>
          {#each topics as t}<option value={t.id}>{t.name}</option>{/each}
        </select>
        <select bind:value={form.relevance} style="width:auto;margin:0">
          <option value="alta">Relevancia alta</option>
          <option value="media">Relevancia media</option>
          <option value="baja">Relevancia baja</option>
        </select>
      </div>
      <input placeholder="Título" bind:value={form.title} required />
      <textarea placeholder="Resumen" bind:value={form.summary} rows="3"></textarea>
      <div class="row">
        <input placeholder="URL fuente" bind:value={form.url} style="flex:2;margin:0" />
        <input placeholder="Nombre de fuente" bind:value={form.source_name} style="flex:1;margin:0" />
        <input type="date" bind:value={form.published_at} style="width:auto;margin:0" />
      </div>
      <button type="submit">Guardar</button>
    </form>
  </div>
{/if}

<div class="card">
  <table>
    <thead>
      <tr><th>Fecha</th><th>Título</th><th>Tema</th><th>Fuente</th><th>Relevancia</th><th></th></tr>
    </thead>
    <tbody>
      {#each entries as e}
        <tr>
          <td class="muted">{e.published_at ? new Date(e.published_at).toLocaleDateString('es-MX') : '—'}</td>
          <td>
            {#if e.url}<a href={e.url} target="_blank" rel="noopener">{e.title}</a>{:else}{e.title}{/if}
            {#if e.summary}<br /><span class="muted">{e.summary.slice(0, 120)}{e.summary.length > 120 ? '…' : ''}</span>{/if}
          </td>
          <td>{e.topics?.name ?? '—'}</td>
          <td class="muted">{e.source_name ?? '—'}</td>
          <td><span class="badge {e.relevance}">{e.relevance}</span></td>
          <td><button class="danger" onclick={() => remove(e.id)}>✕</button></td>
        </tr>
      {:else}
        <tr><td colspan="6" class="muted">Sin registros.</td></tr>
      {/each}
    </tbody>
  </table>
</div>
