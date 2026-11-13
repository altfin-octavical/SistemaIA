<script>
  import '../app.css';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getToken, clearToken, api } from '$lib/api';

  let { children } = $props();

  let user = $state(null);
  const isPublic = $derived(
    $page.url.pathname.startsWith('/login') || $page.url.pathname.startsWith('/auth')
  );

  onMount(async () => {
    if (!getToken()) {
      if (!isPublic) goto('/login');
      return;
    }
    try {
      const { user: u } = await api('/auth/me');
      user = u;
    } catch {
      clearToken();
      if (!isPublic) goto('/login');
    }
  });

  async function logout() {
    clearToken();
    user = null;
    goto('/login');
  }
</script>

<nav class="topnav">
  <span class="brand">GeoIntel</span>
  {#if !isPublic}
    <a href="/" class:active={$page.url.pathname === '/'}>Dashboard</a>
    <a href="/entries" class:active={$page.url.pathname.startsWith('/entries')}>Registros</a>
    <a href="/analyses" class:active={$page.url.pathname.startsWith('/analyses')}>Análisis</a>
    <a href="/topics" class:active={$page.url.pathname.startsWith('/topics')}>Temas</a>
    <span class="spacer"></span>
    {#if user}<span class="who">{user.name} ({user.role})</span>{/if}
    <button class="logout" onclick={logout}>Salir</button>
  {/if}
</nav>

<main>
  {@render children?.()}
</main>
