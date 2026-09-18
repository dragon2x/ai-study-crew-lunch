// 기존 Apps Script 에서 주차별 점심 데이터를 받아 lunch.json 으로 저장
const URL = 'https://script.google.com/macros/s/AKfycbyEErpXKVNuL3X4WWj5P3yfGIWyj8Px0oZgTtIzuKGIOcnoe3TpfBfW2Y-ScmuPrhZL/exec';
const fs = require('fs');
const weeks = [];
for (let w = 14; w <= 40; w++) weeks.push('2026-W' + String(w).padStart(2, '0'));
(async () => {
  const out = {}; let members = null;
  await Promise.all(weeks.map(async (weekId) => {
    const t0 = Date.now();
    const r = await fetch(URL + '?action=loadLunch&weekId=' + weekId);
    const j = await r.json();
    if (!j.success) { console.error(weekId, 'FAIL', j.error); return; }
    if (j.members) members = j.members;
    const n = Object.keys(j.lunchData || {}).length;
    if (n) out[weekId] = j.lunchData;
    console.log(weekId, n, 'rows', (Date.now() - t0) + 'ms');
  }));
  fs.writeFileSync('lunch.json', JSON.stringify({ members, lunch: out }, null, 2));
  let total = 0; for (const w in out) total += Object.keys(out[w]).length;
  console.log('weeks:', Object.keys(out).sort().join(', '), '\ntotal rows:', total, '\nmembers:', JSON.stringify(members));
})();
