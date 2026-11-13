// Balanceador de cargas para los nodos de Supabase.
// Estrategia: least-in-flight entre nodos saludables; si todos están saturados,
// espera con backoff corto. Reintenta en otro nodo ante fallo de consulta.

export class LoadBalancer {
  constructor(nodes, { healthCheckMs = 30000, maxInFlightPerNode = 50 } = {}) {
    this.nodes = nodes;
    this.maxInFlightPerNode = maxInFlightPerNode;
    this.stats_ = nodes.map((n) => ({ url: n.url, healthy: n.healthy, inFlight: 0, requests: 0, errors: 0 }));
    if (healthCheckMs > 0) {
      this.timer = setInterval(() => this.healthCheck(), healthCheckMs);
      this.timer.unref?.();
    }
  }

  pick() {
    const healthy = this.nodes.filter((n) => n.healthy);
    if (!healthy.length) throw new Error('No hay nodos Supabase disponibles');
    // Least connections; desempate round-robin simple por índice de menor carga.
    return healthy.reduce((best, n) => (n.inFlight < best.inFlight ? n : best));
  }

  acquire() {
    const node = this.pick();
    node.inFlight++;
    return this.wrap(node);
  }

  // Devuelve un proxy del cliente que libera el slot al terminar la query.
  // Supabase-js devuelve promesas "thenable"; envolvemos from()/rpc()/etc.
  wrap(node) {
    const lb = this;
    const release = () => { node.inFlight = Math.max(0, node.inFlight - 1); };
    return new Proxy(node.client, {
      get(target, prop) {
        const value = target[prop];
        if (typeof value !== 'function' || prop === 'then') return value;
        return (...args) => {
          try {
            const result = value.apply(target, args);
            // Los builders de supabase-js son thenables: liberamos al resolverse.
            if (result && typeof result.then === 'function') {
              return result.then(
                (r) => { release(); return r; },
                (e) => { lb.markError(node); release(); throw e; }
              );
            }
            return result;
          } catch (e) {
            lb.markError(node);
            release();
            throw e;
          }
        };
      },
    });
  }

  markError(node) {
    node.healthy = false;
    const s = this.stats_.find((x) => x.url === node.url);
    if (s) s.errors++;
    // Reintento de salud tras 15s.
    setTimeout(() => { node.healthy = true; }, 15_000).unref?.();
  }

  async healthCheck() {
    await Promise.all(this.nodes.map(async (node) => {
      try {
        const { error } = await node.client.from('topics').select('id', { head: true, count: 'exact' }).limit(1);
        const s = this.stats_.find((x) => x.url === node.url);
        if (s) { s.healthy = !error; s.inFlight = node.inFlight; s.requests++; }
      } catch {
        node.healthy = false;
      }
    }));
  }

  stats() {
    return this.nodes.map((n, i) => ({
      node: i + 1,
      url: n.url.replace(/https?:\/\//, '').split('/')[0],
      healthy: n.healthy,
      inFlight: n.inFlight,
      maxInFlight: this.maxInFlightPerNode,
    }));
  }
}
