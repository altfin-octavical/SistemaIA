<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let topics = $state([]);
  let error = $state('');
  let name = $state('');
  let description = $state('');

  async function load() {
    try {
      const { topics: t } = await api('/topics');
      topics = t;
    } catch (e) {
      error = e.message;
    }
  }

  onMount(load);

  async function create(e) {
    e.preventDefault();
    try {
      await api('/topics', { method: 'POST', body: { name, description } });
      name = '';
      description = '';
      await load();
    } catch (err) {
      error = err.message;
    }
  }

  async function toggle(t) {
    await api(`/topics/${t.id}`, { method: 'PATCH', body: { active: !t.active } });
    await load();
  }
</script>

<h1>Temas</h1>
{#if error}<p class="error">{error}</p>{/if}

<div class="card">
  <form onsubmit={create} class="row">
    <input placeholder="Nombre del tema" bind:value={name} required style="flex:2;margin:0" />
    <input placeholder="Descripción" bind:value={description} style="flex:3;margin:0" />
    <button type="submit">Agregar</button>
  </form>
</div>

<div class="card">
  <table>
    <thead><tr><th>Nombre</th><th>Descripción</th><th>Estado</th><th></th></tr></thead>
    <tbody>
      {#each topics as t}
        <tr>
          <td>{t.name}</td>
          <td class="muted">{t.description ?? '—'}</td>
          <td>{t.active ? 'Activo' : 'Inactivo'}</td>
          <td><button class="secondary" onclick={() => toggle(t)}>{t.active ? 'Desactivar' : 'Activar'}</button></td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
