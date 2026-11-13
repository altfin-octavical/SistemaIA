<script>
  import { goto } from '$app/navigation';
  import { api, setToken, getToken } from '$lib/api';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  if (getToken()) goto('/');

  async function submit(e) {
    e.preventDefault();
    error = '';
    loading = true;
    try {
      const { token } = await api('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setToken(token);
      goto('/');
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-wrap card">
  <h1>GeoIntel</h1>
  <p class="muted">Panel de Administración</p>
  <form onsubmit={submit}>
    <input type="email" placeholder="Correo" bind:value={email} required />
    <input type="password" placeholder="Contraseña" bind:value={password} required />
    {#if error}<p class="error">{error}</p>{/if}
    <button type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
  </form>
  <p class="muted" style="text-align:center; margin-top:1rem">
    <a href="/auth">Probar login con Google (Supabase Auth)</a>
  </p>
</div>
