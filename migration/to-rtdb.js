// pull.js 가 받은 lunch.json 을 Realtime Database 구조(lunch/{weekId}/{memberName}, members)로 변환
const fs = require('fs');
const src = JSON.parse(fs.readFileSync(__dirname + '/lunch.json', 'utf8'));
const lunch = {};
let rows = 0;
for (const [weekId, byMember] of Object.entries(src.lunch)) {
  lunch[weekId] = {};
  for (const [name, d] of Object.entries(byMember)) {
    lunch[weekId][name] = {
      menuChoice: String(d.menuChoice || ''),
      customMenu: String(d.customMenu || ''),
      restaurant: String(d.restaurant || ''),
      timestamp: String(d.timestamp || '')
    };
    rows++;
  }
}
fs.writeFileSync(__dirname + '/rtdb-lunch.json', JSON.stringify(lunch, null, 2));
fs.writeFileSync(__dirname + '/rtdb-members.json', JSON.stringify(src.members));
console.log('rows', rows, 'weeks', Object.keys(lunch).length, 'members', src.members.length);
