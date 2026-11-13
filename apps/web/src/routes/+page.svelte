<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let stats = $state(null);
  let error = $state('');

  onMount(async () => {
    try {
      stats = await api('/stats');
    } catch (e) {
      error = e.message;
    }
  });
</script>

<h1>Dashboard</h1>
{#if error}<p class="error">{error}</p>{/if}

{#if stats}
  <div class="grid">
    <div class="card"><div class="stat">{stats.topics}</div><div class="stat-label">Temas</div></div>
    <div class="card"><div class="stat">{stats.entries}</div><div class="stat-label">Registros</div></div>
    <div class="card"><div class="stat">{stats.analyses}</div><div class="stat-label">Análisis</div></div>
  </div>

  <div class="card">
    <h3>Registros por tema</h3>
    {#each Object.entries(stats.byTopic) as [name, count]}
      <p>{name}: <strong>{count}</strong></p>
    {:else}
      <p class="muted">Sin registros todavía.</p>
    {/each}
  </div>

  <div class="card">
    <h3>Balanceador de cargas (nodos Supabase)</h3>
    <table>
      <thead><tr><th>Nodo</th><th>Endpoint</th><th>Estado</th><th>Carga en vuelo</th></tr></thead>
      <tbody>
        {#each stats.loadBalancer as n}
          <tr>
            <td>{n.node}</td>
            <td class="muted">{n.url}</td>
            <td>{n.healthy ? 'OK' : 'Caído'}</td>
            <td>{n.inFlight} / {n.maxInFlight}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
