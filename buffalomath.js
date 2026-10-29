import {equalAccessDistribution} from './feature-weighting.js';
const BuffaloMath=(()=>{
var VERSION = "buffalo-1.0.0", MATH_VERSION = "buffalo-1.1.0";
var BETS = [0.2, 0.5, 1, 2];
var NAMES = ["Rising", "Gold", "Bucks"];
var PAY = { h1: [0, 0, 50, 200, 250, 300], h2: [0, 0, 20, 80, 200, 250], h3: [0, 0, 20, 80, 200, 250], m1: [0, 0, 10, 40, 100, 150], m2: [0, 0, 10, 40, 100, 150], l1: [0, 0, 0, 10, 60, 140], l2: [0, 0, 0, 10, 60, 140], l3: [0, 0, 0, 5, 40, 120], l4: [0, 0, 0, 5, 40, 120], l5: [0, 0, 0, 5, 20, 100], l6: [0, 0, 2, 5, 20, 100] };
var random = (seed) => () => {
  seed |= 0;
  seed = seed + 1831565813 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
var pick = (r, a) => a[Math.floor(r() * a.length)];
var clone = (x) => JSON.parse(JSON.stringify(x));
var shape = (rising) => rising ? [4, 5, 6, 5, 4] : [4, 4, 4, 4, 4];
function evaluate(board2, stake = 100) {
  const wins = [];
  let multiplier = 1;
  board2.flat().forEach((id) => {
    if (id === "w2") multiplier *= 2;
    if (id === "w3") multiplier *= 3;
  });
  for (const [id, pay] of Object.entries(PAY)) {
    let ways = 1, count = 0, positions = [];
    for (let c = 0; c < 5; c++) {
      const matches = board2[c].flatMap((s, r) => s === id || id === "h1" && s === "h1b" || s.startsWith("w") ? [[c, r]] : []);
      if (!matches.length) break;
      count++;
      ways *= matches.length;
      positions.push(...matches);
    }
    if (pay[count] > 0) {
      const amount = Math.round(stake * pay[count] * ways * multiplier / 20);
      wins.push({ id, count, ways, positions, amount });
    }
  }
  return { wins, multiplier, total: wins.reduce((n, w) => n + w.amount, 0) };
}
function board(r, rows = shape(false), free = false) {
  const pool = ["h1", "h2", "h3", "m1", "m2", "l1", "l1", "l2", "l2", "l3", "l3", "l4", "l4", "l5", "l5", "l6"];
  return rows.map((n, c) => Array.from({ length: n }, () => c > 0 && c < 4 && r() < (free ? 0.025 : 0.012) ? pick(r, free ? ["w2", "w3"] : ["w1", "w1", "w2"]) : pick(r, pool)));
}
function base(seed, stake = 100, kind = "any", features = [], triggerCount = features.length) {
  const r = random(seed);
  let b, e;
  for (let i = 0; i < 2e3; i++) {
    b = board(r);
    e = evaluate(b, stake);
    if (kind === "loss" ? e.total === 0 : kind === "win" ? e.total > 0 && e.total <= stake * 6 : true) break;
  }
  const collectors = [];
  const colors = features.length ? features : r() < 0.62 ? [pick(r, [0, 1, 2])] : [];
  const count = features.length ? Math.max(colors.length, triggerCount) : colors.length;
  for (let i = 0; i < count; i++) {
    const color = colors[i % colors.length];
    let c, row;
    do {
      c = pick(r, [0, 1, 2, 3, 4]);
      row = Math.floor(r() * 4);
    } while (collectors.some((x) => x.pos[0] === c && x.pos[1] === row));
    b[c][row] = ["s2", "s3", "s1"][color];
    collectors.push({ color, pos: [c, row] });
  }
  e = evaluate(b, stake);
  return { board: b, ...e, collectors };
}
function bonusTape(seed, features, stake = 100, scenario = "normal") {
  const r = random(seed), rows = shape(features.includes(0)), steps = [], bags = [], upgraded = [];
  const initialSpins = scenario === "twenty" ? 20 : scenario === "fifteen" ? 15 : 8;
  let remaining = initialSpins, gold = 0, spins = 0, total = 0, retriggered = false;
  while (remaining > 0 && spins < 40) {
    remaining--;
    spins++;
    const b = board(r, rows, true), events = [];
    if (r() < 0.55) {
      for (let c = 0; c < 2; c++) for (let j = 0; j < b[c].length; j++) b[c][j] = pick(r, c === 0 ? ["l1", "l2", "l3"] : ["l4", "l5", "l6"]);
    }
    for (const id of upgraded) for (const col of b) for (let j = 0; j < col.length; j++) if (col[j] === id) col[j] = "h1b";
    const before = clone(b), transforms = [];
    if (features.includes(1) && gold < 15) {
      let n = scenario === "gold-full" ? Math.min(3, 15 - gold) : r() < 0.55 ? 1 + (r() < 0.25 ? 1 : 0) : 0;
      for (let i = 0; i < n; i++) {
        const c = Math.floor(r() * 5), row = Math.floor(r() * rows[c]);
        if (transforms.some((t) => t.pos[0] === c && t.pos[1] === row)) continue;
        before[c][row] = "sj";
        b[c][row] = "h1b";
        gold++;
        transforms.push({ type: "gold", pos: [c, row], gold });
        [4, 7, 13, 15].forEach((threshold, k) => {
          if (gold === threshold) {
            const id = ["h2", "h3", "m1", "m2"][k];
            upgraded.push(id);
            events.push({ type: "upgrade", id, threshold });
          }
        });
      }
    }
    if (features.includes(2) && bags.length < 24) {
      const n = r() < 0.5 ? 1 + (r() < 0.18 ? 1 : 0) : 0;
      for (let i = 0; i < n; i++) {
        const c = Math.floor(r() * 5), row = Math.floor(r() * rows[c]);
        if (transforms.some((t) => t.pos[0] === c && t.pos[1] === row)) continue;
        const goldBag = r() < 0.25;
        const value = Math.round(stake * pick(r, goldBag ? [1, 2, 3, 5, 10, 20] : [0.2, 0.5, 1, 2, 3]));
        const bag = { gold: goldBag, value };
        bags.push(bag);
        before[c][row] = goldBag ? "b2" : "b1";
        b[c][row] = "h1";
        transforms.push({ type: "bag", pos: [c, row], bag, index: bags.length });
      }
    }
    if (!retriggered && spins <= initialSpins && (scenario === "retrigger" && spins === 3 || r() < 7e-3)) {
      retriggered = true;
      remaining += 5;
      const positions = [0, 4].map((c) => [c, Array.from({ length: rows[c] }, (_, j) => j).find((j) => !transforms.some((t) => t.pos[0] === c && t.pos[1] === j))]);
      for (const [c, j] of positions) {
        before[c][j] = "s4";
        b[c][j] = "s4";
      }
      events.push({ type: "retrigger", spins: 5, positions });
    }
    const result = evaluate(b, stake);
    total += result.total;
    steps.push({ before, board: b, transforms, events, gold, upgraded: [...upgraded], remaining, ...result, cumulative: total });
  }
  const bagTotal = bags.reduce((s, b) => s + b.value, 0);
  return { features, initialSpins, rows, steps, bags, bagTotal, total: total + bagTotal, gold };
}
var INITIAL = base(194, 100, "loss").board;

var catalog_default = { low: { loss: [{ seed: 4 }, { seed: 7 }, { seed: 8 }, { seed: 10 }, { seed: 11 }, { seed: 15 }, { seed: 16 }, { seed: 20 }, { seed: 22 }, { seed: 23 }, { seed: 25 }, { seed: 26 }, { seed: 27 }, { seed: 28 }, { seed: 29 }, { seed: 30 }, { seed: 34 }, { seed: 35 }, { seed: 41 }, { seed: 44 }, { seed: 45 }, { seed: 49 }, { seed: 50 }, { seed: 51 }, { seed: 52 }, { seed: 55 }, { seed: 57 }, { seed: 62 }, { seed: 65 }, { seed: 69 }, { seed: 73 }, { seed: 74 }, { seed: 75 }, { seed: 78 }, { seed: 79 }, { seed: 80 }, { seed: 81 }, { seed: 83 }, { seed: 84 }, { seed: 87 }, { seed: 88 }, { seed: 91 }, { seed: 94 }, { seed: 101 }, { seed: 104 }, { seed: 109 }, { seed: 110 }, { seed: 112 }, { seed: 113 }, { seed: 115 }, { seed: 116 }, { seed: 119 }, { seed: 122 }, { seed: 123 }, { seed: 128 }, { seed: 129 }, { seed: 131 }, { seed: 134 }, { seed: 135 }, { seed: 142 }, { seed: 145 }, { seed: 146 }, { seed: 147 }, { seed: 149 }, { seed: 162 }, { seed: 163 }, { seed: 165 }, { seed: 171 }, { seed: 174 }, { seed: 175 }, { seed: 176 }, { seed: 179 }, { seed: 182 }, { seed: 184 }, { seed: 190 }, { seed: 194 }, { seed: 196 }, { seed: 198 }, { seed: 202 }, { seed: 204 }, { seed: 206 }, { seed: 207 }, { seed: 210 }, { seed: 212 }, { seed: 214 }, { seed: 216 }, { seed: 218 }, { seed: 220 }, { seed: 221 }, { seed: 222 }, { seed: 229 }, { seed: 236 }, { seed: 237 }, { seed: 238 }, { seed: 240 }, { seed: 243 }], base: [{ seed: 1 }, { seed: 3 }, { seed: 5 }, { seed: 9 }, { seed: 12 }, { seed: 14 }, { seed: 19 }, { seed: 21 }, { seed: 36 }, { seed: 37 }, { seed: 38 }, { seed: 53 }, { seed: 56 }, { seed: 61 }, { seed: 64 }, { seed: 66 }, { seed: 68 }, { seed: 70 }, { seed: 71 }, { seed: 72 }, { seed: 76 }, { seed: 77 }, { seed: 82 }, { seed: 85 }, { seed: 89 }, { seed: 90 }, { seed: 92 }, { seed: 93 }, { seed: 95 }, { seed: 96 }, { seed: 103 }, { seed: 105 }, { seed: 111 }, { seed: 117 }, { seed: 120 }, { seed: 124 }, { seed: 130 }, { seed: 132 }, { seed: 133 }, { seed: 137 }, { seed: 138 }, { seed: 139 }, { seed: 140 }, { seed: 143 }, { seed: 150 }, { seed: 155 }, { seed: 157 }, { seed: 158 }, { seed: 159 }, { seed: 160 }, { seed: 164 }, { seed: 167 }, { seed: 169 }, { seed: 170 }, { seed: 177 }, { seed: 178 }, { seed: 185 }, { seed: 186 }, { seed: 187 }, { seed: 188 }, { seed: 192 }, { seed: 195 }, { seed: 197 }, { seed: 200 }, { seed: 203 }, { seed: 205 }, { seed: 209 }, { seed: 211 }, { seed: 213 }, { seed: 215 }, { seed: 219 }, { seed: 226 }, { seed: 227 }, { seed: 228 }, { seed: 230 }, { seed: 232 }, { seed: 234 }, { seed: 239 }, { seed: 241 }, { seed: 246 }, { seed: 250 }, { seed: 260 }, { seed: 261 }, { seed: 263 }, { seed: 265 }, { seed: 273 }, { seed: 274 }, { seed: 278 }, { seed: 281 }, { seed: 283 }, { seed: 286 }, { seed: 288 }, { seed: 290 }, { seed: 293 }, { seed: 296 }, { seed: 306 }], bonus: [{ seed: 1002, features: [0], scenario: "normal" }, { seed: 1007, features: [0], scenario: "normal" }, { seed: 1013, features: [0], scenario: "normal" }, { seed: 1019, features: [0], scenario: "normal" }, { seed: 1026, features: [0], scenario: "normal" }, { seed: 1028, features: [0], scenario: "normal" }, { seed: 1030, features: [0], scenario: "normal" }, { seed: 1033, features: [0], scenario: "normal" }, { seed: 1034, features: [0], scenario: "normal" }, { seed: 1035, features: [0], scenario: "normal" }, { seed: 1037, features: [0], scenario: "fifteen" }, { seed: 1040, features: [0], scenario: "twenty" }, { seed: 1e3, features: [1], scenario: "normal" }, { seed: 1006, features: [1], scenario: "normal" }, { seed: 1014, features: [1], scenario: "normal" }, { seed: 1016, features: [1], scenario: "normal" }, { seed: 1017, features: [1], scenario: "normal" }, { seed: 1020, features: [1], scenario: "normal" }, { seed: 1024, features: [1], scenario: "normal" }, { seed: 1027, features: [1], scenario: "normal" }, { seed: 1034, features: [1], scenario: "normal" }, { seed: 1035, features: [1], scenario: "normal" }, { seed: 1042, features: [1], scenario: "fifteen" }, { seed: 1052, features: [1], scenario: "twenty" }, { seed: 1e3, features: [2], scenario: "normal" }, { seed: 1002, features: [2], scenario: "normal" }, { seed: 1004, features: [2], scenario: "normal" }, { seed: 1007, features: [2], scenario: "normal" }, { seed: 1008, features: [2], scenario: "normal" }, { seed: 1011, features: [2], scenario: "normal" }, { seed: 1012, features: [2], scenario: "normal" }, { seed: 1015, features: [2], scenario: "normal" }, { seed: 1018, features: [2], scenario: "normal" }, { seed: 1022, features: [2], scenario: "normal" }, { seed: 1023, features: [2], scenario: "fifteen" }, { seed: 1033, features: [2], scenario: "twenty" }, { seed: 1003, features: [0, 1], scenario: "normal" }, { seed: 1006, features: [0, 1], scenario: "normal" }, { seed: 1009, features: [0, 1], scenario: "normal" }, { seed: 1010, features: [0, 1], scenario: "normal" }, { seed: 1011, features: [0, 1], scenario: "normal" }, { seed: 1017, features: [0, 1], scenario: "normal" }, { seed: 1026, features: [0, 1], scenario: "normal" }, { seed: 1030, features: [0, 1], scenario: "normal" }, { seed: 1043, features: [0, 1], scenario: "normal" }, { seed: 1044, features: [0, 1], scenario: "normal" }, { seed: 1051, features: [0, 1], scenario: "fifteen" }, { seed: 1053, features: [0, 1], scenario: "twenty" }, { seed: 1007, features: [0, 2], scenario: "normal" }, { seed: 1011, features: [0, 2], scenario: "normal" }, { seed: 1013, features: [0, 2], scenario: "normal" }, { seed: 1014, features: [0, 2], scenario: "normal" }, { seed: 1025, features: [0, 2], scenario: "normal" }, { seed: 1028, features: [0, 2], scenario: "normal" }, { seed: 1031, features: [0, 2], scenario: "normal" }, { seed: 1037, features: [0, 2], scenario: "normal" }, { seed: 1045, features: [0, 2], scenario: "normal" }, { seed: 1062, features: [0, 2], scenario: "normal" }, { seed: 1072, features: [0, 2], scenario: "fifteen" }, { seed: 1074, features: [0, 2], scenario: "twenty" }, { seed: 1007, features: [1, 2], scenario: "normal" }, { seed: 1008, features: [1, 2], scenario: "normal" }, { seed: 1011, features: [1, 2], scenario: "normal" }, { seed: 1012, features: [1, 2], scenario: "normal" }, { seed: 1016, features: [1, 2], scenario: "normal" }, { seed: 1017, features: [1, 2], scenario: "normal" }, { seed: 1018, features: [1, 2], scenario: "normal" }, { seed: 1021, features: [1, 2], scenario: "normal" }, { seed: 1022, features: [1, 2], scenario: "normal" }, { seed: 1024, features: [1, 2], scenario: "normal" }, { seed: 1035, features: [1, 2], scenario: "fifteen" }, { seed: 1078, features: [1, 2], scenario: "twenty" }, { seed: 1e3, features: [0, 1, 2], scenario: "normal" }, { seed: 1001, features: [0, 1, 2], scenario: "normal" }, { seed: 1005, features: [0, 1, 2], scenario: "normal" }, { seed: 1006, features: [0, 1, 2], scenario: "normal" }, { seed: 1010, features: [0, 1, 2], scenario: "normal" }, { seed: 1013, features: [0, 1, 2], scenario: "normal" }, { seed: 1017, features: [0, 1, 2], scenario: "normal" }, { seed: 1018, features: [0, 1, 2], scenario: "normal" }, { seed: 1023, features: [0, 1, 2], scenario: "normal" }, { seed: 1024, features: [0, 1, 2], scenario: "normal" }, { seed: 1040, features: [0, 1, 2], scenario: "fifteen" }, { seed: 1311, features: [0, 1, 2], scenario: "twenty" }] }, std: { loss: [{ seed: 4 }, { seed: 7 }, { seed: 8 }, { seed: 10 }, { seed: 11 }, { seed: 15 }, { seed: 16 }, { seed: 20 }, { seed: 22 }, { seed: 23 }, { seed: 25 }, { seed: 26 }, { seed: 27 }, { seed: 28 }, { seed: 29 }, { seed: 30 }, { seed: 34 }, { seed: 35 }, { seed: 41 }, { seed: 44 }, { seed: 45 }, { seed: 49 }, { seed: 50 }, { seed: 51 }, { seed: 52 }, { seed: 55 }, { seed: 57 }, { seed: 62 }, { seed: 65 }, { seed: 69 }, { seed: 73 }, { seed: 74 }, { seed: 75 }, { seed: 78 }, { seed: 79 }, { seed: 80 }, { seed: 81 }, { seed: 83 }, { seed: 84 }, { seed: 87 }, { seed: 88 }, { seed: 91 }, { seed: 94 }, { seed: 101 }, { seed: 104 }, { seed: 109 }, { seed: 110 }, { seed: 112 }, { seed: 113 }, { seed: 115 }, { seed: 116 }, { seed: 119 }, { seed: 122 }, { seed: 123 }, { seed: 128 }, { seed: 129 }, { seed: 131 }, { seed: 134 }, { seed: 135 }, { seed: 142 }, { seed: 145 }, { seed: 146 }, { seed: 147 }, { seed: 149 }, { seed: 162 }, { seed: 163 }, { seed: 165 }, { seed: 171 }, { seed: 174 }, { seed: 175 }, { seed: 176 }, { seed: 179 }, { seed: 182 }, { seed: 184 }, { seed: 190 }, { seed: 194 }, { seed: 196 }, { seed: 198 }, { seed: 202 }, { seed: 204 }, { seed: 206 }, { seed: 207 }, { seed: 210 }, { seed: 212 }, { seed: 214 }, { seed: 216 }, { seed: 218 }, { seed: 220 }, { seed: 221 }, { seed: 222 }, { seed: 229 }, { seed: 236 }, { seed: 237 }, { seed: 238 }, { seed: 240 }, { seed: 243 }], base: [{ seed: 3 }, { seed: 5 }, { seed: 9 }, { seed: 13 }, { seed: 14 }, { seed: 18 }, { seed: 19 }, { seed: 21 }, { seed: 31 }, { seed: 32 }, { seed: 36 }, { seed: 38 }, { seed: 42 }, { seed: 46 }, { seed: 47 }, { seed: 56 }, { seed: 59 }, { seed: 60 }, { seed: 61 }, { seed: 64 }, { seed: 66 }, { seed: 67 }, { seed: 71 }, { seed: 72 }, { seed: 76 }, { seed: 82 }, { seed: 85 }, { seed: 90 }, { seed: 93 }, { seed: 96 }, { seed: 97 }, { seed: 98 }, { seed: 100 }, { seed: 103 }, { seed: 105 }, { seed: 107 }, { seed: 114 }, { seed: 117 }, { seed: 118 }, { seed: 120 }, { seed: 121 }, { seed: 124 }, { seed: 126 }, { seed: 127 }, { seed: 130 }, { seed: 132 }, { seed: 133 }, { seed: 137 }, { seed: 138 }, { seed: 140 }, { seed: 141 }, { seed: 143 }, { seed: 148 }, { seed: 150 }, { seed: 151 }, { seed: 152 }, { seed: 153 }, { seed: 155 }, { seed: 156 }, { seed: 157 }, { seed: 159 }, { seed: 160 }, { seed: 161 }, { seed: 166 }, { seed: 169 }, { seed: 177 }, { seed: 178 }, { seed: 180 }, { seed: 185 }, { seed: 186 }, { seed: 187 }, { seed: 188 }, { seed: 189 }, { seed: 191 }, { seed: 192 }, { seed: 195 }, { seed: 197 }, { seed: 200 }, { seed: 205 }, { seed: 208 }, { seed: 209 }, { seed: 211 }, { seed: 213 }, { seed: 215 }, { seed: 217 }, { seed: 219 }, { seed: 223 }, { seed: 226 }, { seed: 227 }, { seed: 228 }, { seed: 233 }, { seed: 234 }, { seed: 235 }, { seed: 239 }, { seed: 241 }, { seed: 246 }], bonus: [{ seed: 1002, features: [0], scenario: "normal" }, { seed: 1006, features: [0], scenario: "normal" }, { seed: 1007, features: [0], scenario: "normal" }, { seed: 1008, features: [0], scenario: "normal" }, { seed: 1013, features: [0], scenario: "normal" }, { seed: 1014, features: [0], scenario: "normal" }, { seed: 1019, features: [0], scenario: "normal" }, { seed: 1021, features: [0], scenario: "normal" }, { seed: 1023, features: [0], scenario: "normal" }, { seed: 1025, features: [0], scenario: "normal" }, { seed: 1026, features: [0], scenario: "fifteen" }, { seed: 1028, features: [0], scenario: "twenty" }, { seed: 1e3, features: [1], scenario: "normal" }, { seed: 1003, features: [1], scenario: "normal" }, { seed: 1004, features: [1], scenario: "normal" }, { seed: 1006, features: [1], scenario: "normal" }, { seed: 1009, features: [1], scenario: "normal" }, { seed: 1012, features: [1], scenario: "normal" }, { seed: 1014, features: [1], scenario: "normal" }, { seed: 1016, features: [1], scenario: "normal" }, { seed: 1017, features: [1], scenario: "normal" }, { seed: 1019, features: [1], scenario: "normal" }, { seed: 1024, features: [1], scenario: "fifteen" }, { seed: 1026, features: [1], scenario: "twenty" }, { seed: 1002, features: [2], scenario: "normal" }, { seed: 1004, features: [2], scenario: "normal" }, { seed: 1006, features: [2], scenario: "normal" }, { seed: 1007, features: [2], scenario: "normal" }, { seed: 1008, features: [2], scenario: "normal" }, { seed: 1009, features: [2], scenario: "normal" }, { seed: 1010, features: [2], scenario: "normal" }, { seed: 1011, features: [2], scenario: "normal" }, { seed: 1012, features: [2], scenario: "normal" }, { seed: 1016, features: [2], scenario: "normal" }, { seed: 1019, features: [2], scenario: "fifteen" }, { seed: 1022, features: [2], scenario: "twenty" }, { seed: 1003, features: [0, 1], scenario: "normal" }, { seed: 1006, features: [0, 1], scenario: "normal" }, { seed: 1009, features: [0, 1], scenario: "normal" }, { seed: 1010, features: [0, 1], scenario: "normal" }, { seed: 1011, features: [0, 1], scenario: "normal" }, { seed: 1014, features: [0, 1], scenario: "normal" }, { seed: 1017, features: [0, 1], scenario: "normal" }, { seed: 1018, features: [0, 1], scenario: "normal" }, { seed: 1020, features: [0, 1], scenario: "normal" }, { seed: 1022, features: [0, 1], scenario: "normal" }, { seed: 1026, features: [0, 1], scenario: "fifteen" }, { seed: 1044, features: [0, 1], scenario: "twenty" }, { seed: 1002, features: [0, 2], scenario: "normal" }, { seed: 1003, features: [0, 2], scenario: "normal" }, { seed: 1006, features: [0, 2], scenario: "normal" }, { seed: 1007, features: [0, 2], scenario: "normal" }, { seed: 1009, features: [0, 2], scenario: "normal" }, { seed: 1010, features: [0, 2], scenario: "normal" }, { seed: 1013, features: [0, 2], scenario: "normal" }, { seed: 1015, features: [0, 2], scenario: "normal" }, { seed: 1018, features: [0, 2], scenario: "normal" }, { seed: 1019, features: [0, 2], scenario: "normal" }, { seed: 1021, features: [0, 2], scenario: "fifteen" }, { seed: 1025, features: [0, 2], scenario: "twenty" }, { seed: 1e3, features: [1, 2], scenario: "normal" }, { seed: 1002, features: [1, 2], scenario: "normal" }, { seed: 1003, features: [1, 2], scenario: "normal" }, { seed: 1004, features: [1, 2], scenario: "normal" }, { seed: 1005, features: [1, 2], scenario: "normal" }, { seed: 1006, features: [1, 2], scenario: "normal" }, { seed: 1008, features: [1, 2], scenario: "normal" }, { seed: 1009, features: [1, 2], scenario: "normal" }, { seed: 1011, features: [1, 2], scenario: "normal" }, { seed: 1012, features: [1, 2], scenario: "normal" }, { seed: 1016, features: [1, 2], scenario: "fifteen" }, { seed: 1024, features: [1, 2], scenario: "twenty" }, { seed: 1e3, features: [0, 1, 2], scenario: "normal" }, { seed: 1001, features: [0, 1, 2], scenario: "normal" }, { seed: 1003, features: [0, 1, 2], scenario: "normal" }, { seed: 1005, features: [0, 1, 2], scenario: "normal" }, { seed: 1006, features: [0, 1, 2], scenario: "normal" }, { seed: 1007, features: [0, 1, 2], scenario: "normal" }, { seed: 1008, features: [0, 1, 2], scenario: "normal" }, { seed: 1009, features: [0, 1, 2], scenario: "normal" }, { seed: 1013, features: [0, 1, 2], scenario: "normal" }, { seed: 1015, features: [0, 1, 2], scenario: "normal" }, { seed: 1030, features: [0, 1, 2], scenario: "fifteen" }, { seed: 1065, features: [0, 1, 2], scenario: "twenty" }] }, high: { loss: [{ seed: 4 }, { seed: 7 }, { seed: 8 }, { seed: 10 }, { seed: 11 }, { seed: 15 }, { seed: 16 }, { seed: 20 }, { seed: 22 }, { seed: 23 }, { seed: 25 }, { seed: 26 }, { seed: 27 }, { seed: 28 }, { seed: 29 }, { seed: 30 }, { seed: 34 }, { seed: 35 }, { seed: 41 }, { seed: 44 }, { seed: 45 }, { seed: 49 }, { seed: 50 }, { seed: 51 }, { seed: 52 }, { seed: 55 }, { seed: 57 }, { seed: 62 }, { seed: 65 }, { seed: 69 }, { seed: 73 }, { seed: 74 }, { seed: 75 }, { seed: 78 }, { seed: 79 }, { seed: 80 }, { seed: 81 }, { seed: 83 }, { seed: 84 }, { seed: 87 }, { seed: 88 }, { seed: 91 }, { seed: 94 }, { seed: 101 }, { seed: 104 }, { seed: 109 }, { seed: 110 }, { seed: 112 }, { seed: 113 }, { seed: 115 }, { seed: 116 }, { seed: 119 }, { seed: 122 }, { seed: 123 }, { seed: 128 }, { seed: 129 }, { seed: 131 }, { seed: 134 }, { seed: 135 }, { seed: 142 }, { seed: 145 }, { seed: 146 }, { seed: 147 }, { seed: 149 }, { seed: 162 }, { seed: 163 }, { seed: 165 }, { seed: 171 }, { seed: 174 }, { seed: 175 }, { seed: 176 }, { seed: 179 }, { seed: 182 }, { seed: 184 }, { seed: 190 }, { seed: 194 }, { seed: 196 }, { seed: 198 }, { seed: 202 }, { seed: 204 }, { seed: 206 }, { seed: 207 }, { seed: 210 }, { seed: 212 }, { seed: 214 }, { seed: 216 }, { seed: 218 }, { seed: 220 }, { seed: 221 }, { seed: 222 }, { seed: 229 }, { seed: 236 }, { seed: 237 }, { seed: 238 }, { seed: 240 }, { seed: 243 }], base: [{ seed: 3 }, { seed: 9 }, { seed: 13 }, { seed: 18 }, { seed: 21 }, { seed: 31 }, { seed: 32 }, { seed: 42 }, { seed: 46 }, { seed: 47 }, { seed: 59 }, { seed: 60 }, { seed: 67 }, { seed: 97 }, { seed: 98 }, { seed: 100 }, { seed: 107 }, { seed: 114 }, { seed: 118 }, { seed: 121 }, { seed: 126 }, { seed: 127 }, { seed: 130 }, { seed: 133 }, { seed: 141 }, { seed: 148 }, { seed: 151 }, { seed: 152 }, { seed: 153 }, { seed: 156 }, { seed: 157 }, { seed: 161 }, { seed: 166 }, { seed: 169 }, { seed: 180 }, { seed: 186 }, { seed: 189 }, { seed: 191 }, { seed: 192 }, { seed: 200 }, { seed: 205 }, { seed: 208 }, { seed: 209 }, { seed: 211 }, { seed: 217 }, { seed: 223 }, { seed: 227 }, { seed: 233 }, { seed: 235 }, { seed: 241 }, { seed: 247 }, { seed: 248 }, { seed: 253 }, { seed: 261 }, { seed: 263 }, { seed: 266 }, { seed: 267 }, { seed: 270 }, { seed: 280 }, { seed: 292 }, { seed: 297 }, { seed: 305 }, { seed: 306 }, { seed: 310 }, { seed: 323 }, { seed: 329 }, { seed: 335 }, { seed: 337 }, { seed: 338 }, { seed: 343 }, { seed: 346 }, { seed: 360 }, { seed: 361 }, { seed: 377 }, { seed: 386 }, { seed: 397 }, { seed: 414 }, { seed: 445 }, { seed: 448 }, { seed: 449 }, { seed: 455 }, { seed: 465 }, { seed: 467 }, { seed: 471 }, { seed: 472 }, { seed: 475 }, { seed: 478 }, { seed: 479 }, { seed: 488 }, { seed: 507 }, { seed: 508 }, { seed: 518 }, { seed: 520 }, { seed: 531 }, { seed: 540 }, { seed: 549 }], bonus: [{ seed: 1001, features: [0], scenario: "normal" }, { seed: 1004, features: [0], scenario: "normal" }, { seed: 1008, features: [0], scenario: "normal" }, { seed: 1009, features: [0], scenario: "normal" }, { seed: 1015, features: [0], scenario: "normal" }, { seed: 1020, features: [0], scenario: "normal" }, { seed: 1024, features: [0], scenario: "normal" }, { seed: 1025, features: [0], scenario: "normal" }, { seed: 1027, features: [0], scenario: "normal" }, { seed: 1039, features: [0], scenario: "normal" }, { seed: 1046, features: [0], scenario: "fifteen" }, { seed: 1049, features: [0], scenario: "twenty" }, { seed: 1002, features: [1], scenario: "normal" }, { seed: 1008, features: [1], scenario: "normal" }, { seed: 1021, features: [1], scenario: "normal" }, { seed: 1038, features: [1], scenario: "normal" }, { seed: 1043, features: [1], scenario: "normal" }, { seed: 1060, features: [1], scenario: "normal" }, { seed: 1062, features: [1], scenario: "normal" }, { seed: 1064, features: [1], scenario: "normal" }, { seed: 1065, features: [1], scenario: "normal" }, { seed: 1079, features: [1], scenario: "normal" }, { seed: 1080, features: [1], scenario: "fifteen" }, { seed: 1081, features: [1], scenario: "twenty" }, { seed: 1029, features: [2], scenario: "normal" }, { seed: 1039, features: [2], scenario: "normal" }, { seed: 1043, features: [2], scenario: "normal" }, { seed: 1044, features: [2], scenario: "normal" }, { seed: 1054, features: [2], scenario: "normal" }, { seed: 1060, features: [2], scenario: "normal" }, { seed: 1062, features: [2], scenario: "normal" }, { seed: 1065, features: [2], scenario: "normal" }, { seed: 1071, features: [2], scenario: "normal" }, { seed: 1082, features: [2], scenario: "normal" }, { seed: 1083, features: [2], scenario: "fifteen" }, { seed: 1086, features: [2], scenario: "twenty" }, { seed: 1001, features: [0, 1], scenario: "normal" }, { seed: 1004, features: [0, 1], scenario: "normal" }, { seed: 1005, features: [0, 1], scenario: "normal" }, { seed: 1013, features: [0, 1], scenario: "normal" }, { seed: 1016, features: [0, 1], scenario: "normal" }, { seed: 1018, features: [0, 1], scenario: "normal" }, { seed: 1021, features: [0, 1], scenario: "normal" }, { seed: 1028, features: [0, 1], scenario: "normal" }, { seed: 1033, features: [0, 1], scenario: "normal" }, { seed: 1038, features: [0, 1], scenario: "normal" }, { seed: 1048, features: [0, 1], scenario: "fifteen" }, { seed: 1049, features: [0, 1], scenario: "twenty" }, { seed: 1004, features: [0, 2], scenario: "normal" }, { seed: 1005, features: [0, 2], scenario: "normal" }, { seed: 1009, features: [0, 2], scenario: "normal" }, { seed: 1012, features: [0, 2], scenario: "normal" }, { seed: 1015, features: [0, 2], scenario: "normal" }, { seed: 1016, features: [0, 2], scenario: "normal" }, { seed: 1023, features: [0, 2], scenario: "normal" }, { seed: 1024, features: [0, 2], scenario: "normal" }, { seed: 1027, features: [0, 2], scenario: "normal" }, { seed: 1034, features: [0, 2], scenario: "normal" }, { seed: 1036, features: [0, 2], scenario: "fifteen" }, { seed: 1037, features: [0, 2], scenario: "twenty" }, { seed: 1002, features: [1, 2], scenario: "normal" }, { seed: 1010, features: [1, 2], scenario: "normal" }, { seed: 1059, features: [1, 2], scenario: "normal" }, { seed: 1060, features: [1, 2], scenario: "normal" }, { seed: 1067, features: [1, 2], scenario: "normal" }, { seed: 1068, features: [1, 2], scenario: "normal" }, { seed: 1075, features: [1, 2], scenario: "normal" }, { seed: 1082, features: [1, 2], scenario: "normal" }, { seed: 1085, features: [1, 2], scenario: "normal" }, { seed: 1087, features: [1, 2], scenario: "normal" }, { seed: 1092, features: [1, 2], scenario: "fifteen" }, { seed: 1093, features: [1, 2], scenario: "twenty" }, { seed: 1002, features: [0, 1, 2], scenario: "normal" }, { seed: 1004, features: [0, 1, 2], scenario: "normal" }, { seed: 1007, features: [0, 1, 2], scenario: "normal" }, { seed: 1008, features: [0, 1, 2], scenario: "normal" }, { seed: 1012, features: [0, 1, 2], scenario: "normal" }, { seed: 1033, features: [0, 1, 2], scenario: "normal" }, { seed: 1039, features: [0, 1, 2], scenario: "normal" }, { seed: 1041, features: [0, 1, 2], scenario: "normal" }, { seed: 1042, features: [0, 1, 2], scenario: "normal" }, { seed: 1045, features: [0, 1, 2], scenario: "normal" }, { seed: 1048, features: [0, 1, 2], scenario: "fifteen" }, { seed: 1053, features: [0, 1, 2], scenario: "twenty" }] } };

var cache = new Map();

const varietyCache=new Map();
function distribution(vol='std',stake=100){
 if(!['low','std','high'].includes(vol))throw Error('Invalid Buffalo mode');
 const ck=vol+':'+stake;if(varietyCache.has(ck))return varietyCache.get(ck);
 const d=legacyDistribution('std',stake),meta=new Map();
 const rows=d.rows.map(r=>({...r,bonus:r.kind==='bonus'}));
 for(const r of rows.filter(r=>r.bonus)){const b=bonusTape(r.entry.seed,r.entry.features,stake,r.entry.scenario);meta.set(r,{key:b.features.join('+'),nuance:[b.initialSpins,b.rows,b.bags.length>0,b.gold>0].join(':')});}
 const out=equalAccessDistribution(rows,vol,{stake,value:r=>r.total/stake,key:r=>meta.get(r).key,nuance:r=>meta.get(r).nuance});varietyCache.set(ck,out);return out;
}

function legacyDistribution(vol = "std", stake = 100) {
  vol = ["low", "std", "high"].includes(vol) ? vol : "std";
  stake = Math.round(stake);
  if (stake < 1 || stake > 1e6) throw Error("Invalid Buffalo stake");
  const key = vol + ":" + stake;
  if (cache.has(key)) return cache.get(key);
  const groups = {}, source = catalog_default[vol];
  for (const kind of ["loss", "base", "bonus"]) groups[kind] = source[kind].map((entry) => {
    const b = base(kind === "bonus" ? 401 : entry.seed, stake, kind === "bonus" ? "loss" : "any", entry.features || [], entry.scenario === "twenty" ? 5 : entry.scenario === "fifteen" ? 4 : entry.features?.length), bonus = kind === "bonus" ? bonusTape(entry.seed, entry.features, stake, entry.scenario) : null;
    return { entry, kind, total: b.total + (bonus?.total || 0) };
  }).filter((e) => kind === "loss" ? e.total === 0 : e.total > 0);
  const baseMean = groups.base.reduce((n, x) => n + x.total / stake, 0) / groups.base.length, bonusMean = groups.bonus.reduce((n, x) => n + x.total / stake, 0) / groups.bonus.length;
  const baseP = 0.2 / baseMean, bonusP = 0.66 / bonusMean, lossP = 1 - baseP - bonusP;
  if (lossP < 0) throw Error("Invalid Buffalo distribution");
  const rows = ["loss", "base", "bonus"].flatMap((kind) => groups[kind].map((row) => ({ ...row, p: { loss: lossP, base: baseP, bonus: bonusP }[kind] / groups[kind].length })));
  const expected = rows.reduce((n, x) => n + x.p * x.total / stake, 0), mass = rows.reduce((n, x) => n + x.p, 0);
  if (Math.abs(expected - 0.86) > 1e-10 || Math.abs(mass - 1) > 1e-10) throw Error("Buffalo expectation mismatch");
  const value = { rows, expected, baseP, bonusP, lossP, baseMean, bonusMean, stake, max: Math.max(...rows.map((x) => x.total / stake)) };
  cache.set(key, value);
  return value;
}
function round(vol = "std", rnd, settings = {}) {
  if (typeof rnd !== "function") throw Error("Server RNG required");
  const stake = Math.round((settings.bet ?? 1) * 100), d = distribution(vol, stake);
  let u = rnd(), row = d.rows[d.rows.length - 1];
  for (const e of d.rows) {
    u -= e.p;
    if (u < 0) {
      row = e;
      break;
    }
  }
  const { entry, kind } = row, b = base(kind === "bonus" ? 401 : entry.seed, stake, kind === "bonus" ? "loss" : "any", entry.features || [], entry.scenario === "twenty" ? 5 : entry.scenario === "fifteen" ? 4 : entry.features?.length), bonus = kind === "bonus" ? bonusTape(entry.seed, entry.features, stake, entry.scenario) : null, total = b.total + (bonus?.total || 0);
  return { version: VERSION, mathVersion: MATH_VERSION, win: total / stake, bonus: !!bonus, feature: bonus ? "buffalo_free" : null, featureSpins: bonus?.steps.length || 0, detail: bonus ? { features: bonus.features, gold: bonus.gold, bags: bonus.bags.length, spins: bonus.steps.length } : null, round: { model: VERSION, mathVersion: MATH_VERSION, stake, bet: stake / 100, board: b.board, wins: b.wins, collectors: b.collectors, baseWin: b.total, bonus, total } };
}
var BuffaloMath = { VERSION, MATH_VERSION, BETS, PAY, NAMES, INITIAL, evaluate, round, distribution, expected: (vol = "std", stake = 100) => distribution(vol, stake).expected, VOLATILITY: true, BANK_FULL: 2 };
return BuffaloMath;
})();
export {BuffaloMath};



