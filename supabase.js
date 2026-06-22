/* ── Supabase minimal client (no npm needed) ── */
const SUPABASE_URL = 'https://pnpblkrgansvuhhhajwg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucGJsa3JnYW5zdnVoaGhhandnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzMzMDUsImV4cCI6MjA5NzcwOTMwNX0.iebKL_Lm7Db2ZVRvZvwXExQpDrghCW6VRq3RWBppbDU';

const sb = {
  async query(path, opts = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': opts.prefer || 'return=representation',
        ...(opts.headers || {}),
      },
      method: opts.method || 'GET',
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || res.statusText);
    }
    if (res.status === 204) return null;
    return res.json();
  },

  /* get user by username */
  async getUser(username) {
    const rows = await this.query(`users?username=eq.${encodeURIComponent(username)}&select=*`);
    return rows?.[0] || null;
  },

  /* update crona/bonus for a user */
  async updateUser(username, { crona, bonus }) {
    return this.query(
      `users?username=eq.${encodeURIComponent(username)}`,
      {
        method: 'PATCH',
        body: { crona, bonus },
        prefer: 'return=representation',
      }
    );
  },

  /* leaderboard — top 10 by crona */
  async topByCrona() {
    return this.query('users?select=username,crona&order=crona.desc&limit=10');
  },

  /* leaderboard — top 10 by bonus */
  async topByBonus() {
    return this.query('users?select=username,bonus&order=bonus.desc&limit=10');
  },
};

async createUser(username) {
  return this.query('users', {
    method: 'POST',
    body: { username: username, crona: 0, bonus: 0 },
    prefer: 'return=representation',
  });
},


