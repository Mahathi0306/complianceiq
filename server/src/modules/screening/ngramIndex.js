export class NgramIndex {
  constructor(size = 3) {
    this.size = size;
    this.postings = new Map();
    this.documents = new Map();
  }

  grams(text) {
    const padded = ` ${text} `;
    const grams = new Set();
    for (let i = 0; i <= padded.length - this.size; i += 1) {
      grams.add(padded.slice(i, i + this.size));
    }
    return grams;
  }

  add(id, text, payload) {
    const grams = this.grams(text);
    this.documents.set(id, { text, payload, size: grams.size });
    for (const gram of grams) {
      let ids = this.postings.get(gram);
      if (!ids) {
        ids = new Set();
        this.postings.set(gram, ids);
      }
      ids.add(id);
    }
  }

  candidates(text, { minDice = 0.3, limit = 50 } = {}) {
    const grams = this.grams(text);
    const shared = new Map();
    for (const gram of grams) {
      const ids = this.postings.get(gram);
      if (!ids) continue;
      for (const id of ids) shared.set(id, (shared.get(id) || 0) + 1);
    }
    const results = [];
    for (const [id, count] of shared) {
      const doc = this.documents.get(id);
      const dice = (2 * count) / (grams.size + doc.size);
      if (dice >= minDice) results.push({ id, text: doc.text, payload: doc.payload, dice });
    }
    results.sort((a, b) => b.dice - a.dice);
    return results.slice(0, limit);
  }

  get count() {
    return this.documents.size;
  }
}
