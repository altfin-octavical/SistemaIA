<script>
  import { onMount } from 'svelte';
  import { supabase, supabaseConfigured } from '$lib/supabase';

  let session = $state(null);
  let user = $state(null);
  let loading = $state(false);
  let error = $state('');
  let ready = $state(false);

  onMount(() => {
    if (!supabase) {
      ready = true;
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      session = data.session;
      user = data.session?.user ?? null;
      ready = true;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      session = s;
      user = s?.user ?? null;
    });
    return () => sub.subscription.unsubscribe();
  });

  async function signInWithGoogle() {
    error = '';
    loading = true;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    if (err) {
      error = err.message;
      loading = false;
    }
    // Si no hay error, el navegador redirige a Google.
  }

  async function signOut() {
    await supabase.auth.signOut();
  }
</script>

<div class="login-wrap card">
  <h1>Supabase Auth</h1>
  <p class="muted">Prueba de creación de usuarios con Google OAuth</p>

  {#if !supabaseConfigured}
    <p class="error">
      Falta configurar <code>VITE_SUPABASE_URL</code> y
      <code>VITE_SUPABASE_ANON_KEY</code> en el <code>.env</code> del frontend.
    </p>
  {:else if !ready}
    <p class="muted">Cargando sesión…</p>
  {:else if user}
    <div class="session">
      <p><strong>Sesión activa</strong></p>
      <dl>
        <dt>ID (auth.users)</dt><dd><code>{user.id}</code></dd>
        <dt>Email</dt><dd>{user.email}</dd>
        <dt>Nombre</dt><dd>{user.user_metadata?.full_name ?? user.user_metadata?.name ?? '—'}</dd>
        <dt>Proveedor</dt><dd>{user.app_metadata?.provider ?? '—'}</dd>
        <dt>Creado</dt><dd>{new Date(user.created_at).toLocaleString()}</dd>
      </dl>
      <p class="muted">
        Este usuario fue creado en <code>auth.users</code> de Supabase.
        Puedes verlo en Dashboard → Authentication → Users.
      </p>
      <button class="logout" onclick={signOut}>Cerrar sesión</button>
    </div>
  {:else}
    <button class="google" onclick={signInWithGoogle} disabled={loading}>
      {loading ? 'Redirigiendo…' : 'Continuar con Google'}
    </button>
    {#if error}<p class="error">{error}</p>{/if}
    <p class="muted">
      La primera vez que entres con una cuenta de Google se crea un usuario
      nuevo en la tabla <code>auth.users</code> de Supabase (login/registro automático).
    </p>
  {/if}
</div>

<style>
  .session dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 16px;
    text-align: left;
    margin: 12px 0;
  }
  .session dt {
    color: var(--muted, #888);
  }
  .session dd {
    margin: 0;
    word-break: break-all;
  }
  .google {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
    border: 1px solid #dadce0;
    border-radius: 6px;
    background: #fff;
    color: #3c4043;
    font-weight: 500;
    cursor: pointer;
  }
  .google:hover {
    background: #f8f9fa;
  }
  code {
    background: rgba(127, 127, 127, 0.15);
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 0.9em;
  }
</style>
