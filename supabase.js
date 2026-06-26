
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


  async getUser(username) {
    const rows = await this.query(`users?username=eq.${encodeURIComponent(username)}&select=*`);
    return rows?.[0] || null;
  },
  async createUser(username) {
    return this.query('users', {
      method: 'POST',
      body: { username, crona: 0, bonus: 0 },
      prefer: 'return=representation',
    });
  },
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
  async topByCrona() {
    return this.query('users?select=username,crona&order=crona.desc&limit=10');
  },
  async topByBonus() {
    return this.query('users?select=username,bonus&order=bonus.desc&limit=10');
  },


  async createOrder(username, item) {
    return this.query('orders', {
      method: 'POST',
      body: {
        username,
        item_id:    item.id,
        item_name:  item.name,
        item_price: item.price,
        used: false,
      },
      prefer: 'return=representation',
    });
  },
  async getInventory(username) {
    return this.query(
      `orders?username=eq.${encodeURIComponent(username)}&select=*&order=created_at.desc`
    );
  },


  async useItem(orderId, username, item) {

    await this.query(
      `orders?id=eq.${encodeURIComponent(orderId)}`,
      {
        method: 'PATCH',
        body: { used: true },
        prefer: 'return=representation',
      }
    );
    
    return this.query('used_orders', {
      method: 'POST',
      body: {
        order_id:   orderId,
        username,
        item_id:    item.item_id,
        item_name:  item.item_name,
        item_price: item.item_price,
      },
      prefer: 'return=representation',
    });
  },


  async createUsedOrder(username, item) {
    return this.query('bonus_orders', {
      method: 'POST',
      body: {
        username,
        item_id:    item.id,
        item_name:  item.name,
        item_price: item.price,
      },
      prefer: 'return=representation',
    });
  },
};
