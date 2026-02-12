/**
 * SSMUH Yield Calculator - localStorage Handling
 */

const Storage = {
  DEALS_KEY: 'ssmuh_deals',

  getDeals() {
    try {
      const data = localStorage.getItem(this.DEALS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveDeal(deal) {
    const deals = this.getDeals();
    deal.id = Date.now().toString();
    deal.date = new Date().toISOString().split('T')[0];
    deals.unshift(deal);
    localStorage.setItem(this.DEALS_KEY, JSON.stringify(deals));
    return deal;
  },

  deleteDeal(id) {
    const deals = this.getDeals().filter(d => d.id !== id);
    localStorage.setItem(this.DEALS_KEY, JSON.stringify(deals));
  },

  clearAll() {
    localStorage.removeItem(this.DEALS_KEY);
  },

  getDealById(id) {
    return this.getDeals().find(d => d.id === id) || null;
  },
};
