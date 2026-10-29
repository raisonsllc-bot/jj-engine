var VERSION = "golden-train-platform-1.0";
var MATH_VERSION = "golden-train-platform-1.1";
var UNIT = 30;
var MODES = { "low": { "line": 1, "feature": 1, "express": 0.040398495392563315 }, "std": { "line": 1, "feature": 1, "express": 0.040398495392563315 }, "high": { "line": 1, "feature": 1, "express": 0.040398495392563315 } };
var RULES = { wild: 0.025, scatter: 0.022, gold: 0.03, engine: 15e-4, pickConditional: 0.02, freeConditional: 0.012, expressConditional: 0.03305035265353472 };
var FREE_SPINS = 10;
var LINES = [[1, 4, 7, 10, 13], [0, 3, 6, 9, 12], [2, 5, 8, 11, 14], [0, 4, 8, 10, 12], [2, 4, 6, 10, 14], [0, 3, 7, 11, 14], [2, 5, 7, 10, 12], [1, 3, 7, 11, 13], [1, 5, 7, 9, 13], [0, 4, 7, 10, 12], [2, 4, 7, 10, 14], [1, 3, 6, 10, 14], [1, 5, 8, 10, 12], [1, 4, 6, 10, 14], [1, 4, 8, 10, 12], [0, 3, 7, 11, 13], [2, 5, 7, 9, 13], [1, 3, 7, 11, 14], [1, 5, 7, 9, 12], [0, 3, 6, 10, 14], [2, 5, 8, 10, 12], [0, 4, 8, 11, 14], [2, 4, 6, 9, 12], [0, 4, 6, 10, 12], [2, 4, 8, 10, 14], [0, 4, 7, 10, 14], [2, 4, 7, 10, 12], [1, 3, 6, 9, 13], [1, 5, 8, 11, 13], [0, 4, 6, 10, 14]];
var ODD = { "1001": { "3": "300", "4": "300", "5": "300" }, "3001": { "3": "25", "4": "100", "5": "500" }, "6001": { "3": "20", "4": "50", "5": "300" }, "6002": { "3": "15", "4": "30", "5": "200" }, "6003": { "3": "10", "4": "20", "5": "100" }, "6004": { "3": "10", "4": "20", "5": "50" }, "6005": { "3": "10", "4": "20", "5": "50" }, "6006": { "3": "5", "4": "15", "5": "30" }, "6007": { "3": "5", "4": "15", "5": "30" }, "6008": { "3": "5", "4": "10", "5": "20" }, "6009": { "3": "5", "4": "10", "5": "20" } };
var rnd = (seed) => () => {
  seed |= 0;
  seed = seed + 1831565813 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
var pick = (r, a) => a[Math.floor(r() * a.length)];
function evaluate(board, bet) {
  const wins = [];
  for (const [line, ps] of LINES.entries()) {
    const ids = ps.map((p) => board[p]?.id || board[p]);
    const candidate = ids.find((x) => x !== 3001) || 3001;
    let count = 0;
    if (candidate !== 1001 && ODD[candidate]) for (const id of ids) {
      if (id === candidate || id === 3001) count++;
      else break;
    }
    let value = (candidate !== 1001 ? +ODD[candidate]?.[count] || 0 : 0) * bet / 30, symbol = candidate;
    let wilds = 0;
    for (const id of ids) {
      if (id === 3001) wilds++;
      else break;
    }
    const wildPay = (+ODD[3001]?.[wilds] || 0) * bet / 30;
    if (wildPay > value) {
      value = wildPay;
      count = wilds;
      symbol = 3001;
    }
    if (value) wins.push({ line, symbol, count, positions: ps.slice(0, count), value });
  }
  return { wins, total: Math.round(wins.reduce((s, w) => s + w.value, 0) * 100) / 100 };
}
function base(r, bet, free = false, mode = "std") {
  const symbols = free ? [6001, 6002, 6003, 6004, 6005] : [6001, 6002, 6003, 6004, 6005, 6006, 6007, 6008, 6009, 6006, 6007, 6008, 6009];
  const board = Array.from({ length: 15 }, (_, i) => {
    const p = r(), { wild: w, scatter: s, gold: g, engine: t } = RULES;
    return p < w ? 3001 : p < w + s ? 1001 : p < w + s + g ? { id: 2001, value: Math.round(bet * pick(r, [1, 2, 3, 5, 10]) * 100) / 100 } : i < 3 && p < w + s + g + t ? 5001 : pick(r, symbols);
  });
  return finishBase(board, r, bet, free, mode);
}
function finishBase(board, r, bet, free = false, mode = "std") {
  const ids = board.map((v) => v?.id || v), line = evaluate(board, bet);
  const scatters = ids.filter((x) => x === 1001).length;
  const gold = ids.includes(2001);
  line.wins.forEach((w) => w.value *= MODES[mode].line);
  line.total = Math.round(line.wins.reduce((a, w) => a + w.value, 0) * 100) / 100;
  return { board, ...line, pick: ids.includes(3001) && r() < RULES.pickConditional, express: gold && (ids.slice(0, 3).includes(5001) || r() < MODES[mode].express), free: scatters >= 3 || !free && scatters > 0 && r() < RULES.freeConditional, scatterWin: scatters >= 3 ? bet * 10 * MODES[mode].line : 0 };
}
var PICK_WEIGHTS = [["mini", 0.97], ["minor", 0.025], ["major", 49e-4], ["grand", 1e-4]];
var weighted = (r, items) => {
  let u = r();
  for (const [value, p] of items) if ((u -= p) < 0) return value;
  return items.at(-1)[0];
};
var COIN_PROFILES = {
  low: { gold: [[1, 0.275], [2, 0.7], [3, 0.025]], normal: [[0.2, 0.02], [0.5, 0.02], [1, 0.254], [2, 0.686], [5, 0.02]] },
  std: { gold: [[1, 0.5], [2, 0.25], [3, 0.25]], normal: [[0.2, 0.2], [0.5, 0.2], [1, 0.2], [2, 0.2], [5, 0.2]] },
  high: { gold: [[1, 0.58125], [2, 0.0875], [3, 0.33125]], normal: [[0.2, 0.5114583333333333], [0.5, 0.07], [1, 0.07], [2, 0.07], [5, 0.2785416666666667]] }
};
function makePick(r, bet, mode = "std") {
  const tiers = ["mini", "minor", "major", "grand"], winner = weighted(r, PICK_WEIGHTS);
  let deck;
  for (let attempt = 0; attempt < 160; attempt++) {
    deck = tiers.flatMap((t) => Array(3).fill(t));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const seen = {};
    let first;
    for (const t of deck) {
      seen[t] = (seen[t] || 0) + 1;
      if (seen[t] === 3) {
        first = t;
        break;
      }
    }
    if (first === winner) return { deck, awards: { mini: bet * 20, minor: bet * 50, major: bet * 200, grand: bet * 2e3 } };
  }
  deck = [...tiers.filter((t) => t !== winner).flatMap((t) => [t, t]), winner, winner, winner, ...tiers.filter((t) => t !== winner)];
  return { deck, awards: { mini: bet * 20, minor: bet * 50, major: bet * 200, grand: bet * 2e3 } };
}
function trainCells(pos, size) {
  const cells = [];
  for (let c = 0; c < size; c++) for (let row = 0; row < size; row++) cells.push(pos + c * 5 + row);
  return cells;
}
function express(r, bet, mode = "std") {
  bet *= MODES[mode].feature;
  let size = 2, count = 0, left = 5, total = 0, pos = 2;
  const steps = [];
  while (left > 0) {
    left--;
    const before = { size, count, left: left + 1, pos };
    const board = Array.from({ length: 25 }, () => {
      const p = r();
      if (p >= 0.14) return null;
      const gold = p < 0.032, q = r();
      const tier = q < 1e-5 ? "grand" : q < 11e-5 ? "major" : q < 211e-5 ? "minor" : q < 0.01211 ? "mini" : null;
      if (tier) return { id: (gold ? 4001 : 4005) + ["grand", "major", "minor", "mini"].indexOf(tier), tier, value: bet * { grand: 2e3, major: 200, minor: 50, mini: 20 }[tier] };
      return { id: gold ? 2001 : 2002, value: bet * weighted(r, COIN_PROFILES[mode][gold ? "gold" : "normal"]) };
    });
    const collected = new Set(), events = [];
    const collect = () => {
      let changed = true;
      while (changed) {
        changed = false;
        for (const i of trainCells(pos, size)) {
          const v = board[i];
          if (!v || collected.has(i)) continue;
          collected.add(i);
          total += v.value;
          events.push({ type: "collect", pos: i, id: v.id, tier: v.tier, value: v.value, total: Math.round(total * 100) / 100 });
          if (isGold(v)) {
            count++;
            const next = count >= 12 ? 5 : count >= 9 ? 4 : count >= 5 ? 3 : 2;
            if (next > size) {
              const old = size;
              size = next;
              const add = { 3: 3, 4: 2, 5: 1 }[size];
              left += add;
              pos = Math.min(Math.floor(pos / 5), 5 - size) * 5 + Math.min(pos % 5, 5 - size);
              events.push({ type: "upgrade", from: old, size, count, extra: add, left, pos });
              changed = true;
            }
          }
        }
      }
    };
    collect();
    for (let i = 0; i < 25; i++) {
      if (!isGold(board[i]) || collected.has(i)) continue;
      pos = Math.min(Math.floor(i / 5), 5 - size) * 5 + Math.min(i % 5, 5 - size);
      events.push({ type: "move", pos, size });
      collect();
    }
    steps.push({ board, before, events, after: { size, count, left, pos, total: Math.round(total * 100) / 100 } });
    if (steps.length > 11) throw Error("Express exceeded legal spin count");
  }
  return { steps, total: Math.round(total * 100) / 100 };
}
var isGold = (v) => v?.id === 2001 || v?.id >= 4001 && v?.id <= 4004;
var initialState = () => ({ version: 1, counts: { jackpot: 0, gold: 0, free: 0 } });
var progressionKey = (cfg) => String(cfg.betIdx) + ":" + cfg.vol;
function round(mode = "std", random = Math.random, cfg = {}, state = null) {
  if (!Object.hasOwn(MODES, mode)) throw Error("Invalid Golden Train mode");
  const counts = { ...initialState().counts, ...state?.counts };
  for (const k in counts) if (!Number.isInteger(counts[k]) || counts[k] < 0 || counts[k] > 200) counts[k] = 0;
  const before = { ...counts }, sequence = [], components = { base: 0, pick: 0, express: 0, free: 0 };
  let total = 0, freeLeft = 0, freePlayed = 0, bonus = false;
  const boardRound = (free) => {
    const b = base(random, UNIT, free, mode), before2 = { ...counts };
    for (const v of b.board) {
      const id = v?.id || v, k = id === 3001 ? "jackpot" : id === 1001 ? "free" : id === 2001 ? "gold" : null;
      if (k) counts[k] = Math.min(200, counts[k] + 1);
    }
    const collected = { ...counts }, features2 = [];
    let featureWin = 0;
    if (b.pick) {
      const p = makePick(random, UNIT, mode), seen = {};
      let winner, stop = 0;
      for (const tier of p.deck) {
        stop++;
        seen[tier] = (seen[tier] || 0) + 1;
        if (seen[tier] === 3) {
          winner = tier;
          break;
        }
      }
      const value = p.awards[winner];
      features2.push({ type: "pick", ...p, revealOrder: p.deck.slice(0, stop), winner, total: value });
      featureWin += value;
      components.pick += value;
      counts.jackpot = 0;
    }
    if (b.express) {
      const e = express(random, UNIT, mode);
      features2.push({ type: "express", ...e });
      featureWin += e.total;
      components.express += e.total;
      counts.gold = 0;
    }
    if (b.free) {
      freeLeft += FREE_SPINS;
      counts.free = 0;
    }
    const award = b.total + b.scatterWin + featureWin;
    total += award;
    if (free) components.free += b.total + b.scatterWin;
    else components.base += b.total + b.scatterWin;
    bonus || (bonus = !!(features2.length || b.free));
    sequence.push({ ...b, freeSpin: free, freeLeft, features: features2, progress: { before: before2, collected, after: { ...counts } }, award });
  };
  boardRound(false);
  while (freeLeft > 0) {
    freeLeft--;
    freePlayed++;
    if (freePlayed > 2e3) throw Error("Golden Train free sequence exceeded safety bound");
    boardRound(true);
  }
  total = Math.round(total * 100) / 100;
  const features = sequence.flatMap((b) => b.features), expresses = features.filter((f) => f.type === "express"), picks = features.filter((f) => f.type === "pick"), expressSpins = expresses.reduce((a, f) => a + f.steps.length, 0);
  const feature = [freePlayed ? "free" : null, expresses.length ? "express" : null, picks.length ? "pick" : null].filter(Boolean).join("+") || null;
  const detail = { freeSpins: freePlayed, expressCount: expresses.length, expressSpins, pickCount: picks.length, pickTiers: picks.map((p) => p.winner), trainUpgrades: expresses.flatMap((f) => f.steps.flatMap((s) => s.events.filter((e) => e.type === "upgrade").map((e) => e.size))), fixedJackpots: expresses.flatMap((f) => f.steps.flatMap((s) => s.events.filter((e) => e.type === "collect" && e.tier).map((e) => e.tier))), components, progressBefore: before, progressAfter: { ...counts } };
  return { version: VERSION, mathVersion: MATH_VERSION, feature, featureSpins: freePlayed + expressSpins, detail, win: total / UNIT, bonus, round: { model: VERSION, mode, stake: UNIT, total, sequence, freePlayed, components, progress: { before, after: { ...counts } } }, progression: { version: 1, counts } };
}
var GoldenTrainMath = { VERSION, MATH_VERSION, BETS: [0.3, 0.6, 0.9, 1.2, 1.5, 1.8], RTP: 0.86, BANK_FULL: 2, BANK_SHARE: 0.03, round, MODES, LINES, ODD, UNIT, FREE_SPINS, progressionKey, initialState };
export {
  GoldenTrainMath,
  rnd
};
