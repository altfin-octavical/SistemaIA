import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    // SPA pura: ssr=false en +layout.js, fallback a index.html para el router cliente.
    adapter: adapter({ fallback: 'index.html' }),
  },
};

export default config;
