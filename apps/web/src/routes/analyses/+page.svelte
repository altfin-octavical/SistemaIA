<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let analyses = $state([]);
  let topics = $state([]);
  let error = $state('');
  let showForm = $state(false);
  let form = $state({ topic_id: '', title: '', body: '' });

  async function load() {
    try {
      const [a, t] = await Promise.all([api('/analyses'), api('/topics')]);
      analyses = a.analyses;
      topics = t.topics;
    } catch (e) {
      error = e.message;
    }
  }

  onMount(load);

  async function create(e) {
    e.preventDefault();
    try {
      await api('/analyses', { method: 'POST', body: { ...form, topic_id: form.topic_id || null } });
      showForm = false;
      form = { topic_id: '', title: '', body: '' };
      await load();
    } catch (err) {
      error = err.message;
    }
  }
</script>

<h1>Análisis</h1>
<div class="row" style="margin-bottom:1rem">
  <button onclick={() => (showForm = !showForm)}>{showForm ? 'Cancelar' : 'Nuevo análisis'}</button>
</div>
{#if error}<p class="error">{error}</p>{/if}

{#if showForm}
  <div class="card">
    <form onsubmit={create}>
      <select bind:value={form.topic_id} style="width:auto">
        <option value="">Sin tema</option>
        {#each topics as t}<option value={t.id}>{t.name}</option>{/each}
      </select>
      <input placeholder="Título del análisis" bind:value={form.title} required />
      <textarea placeholder="Contenido del análisis…" bind:value={form.body} rows="8" required></textarea>
      <button type="submit">Guardar análisis</button>
    </form>
  </div>
{/if}

{#each analyses as a}
  <div class="card">
    <h3>{a.title}</h3>
    <p class="muted">
      {a.topics?.name ?? 'General'} · {new Date(a.created_at).toLocaleString('es-MX')}
    </p>
    <p style="white-space:pre-wrap">{a.body}</p>
  </div>
{:else}
  <p class="muted">Sin análisis todavía.</p>
{/each}
