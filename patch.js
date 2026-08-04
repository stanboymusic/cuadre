const fs = require('fs');
let html = fs.readFileSync('cuadre.html', 'utf8');

// 1. Inject PocketBase script tag
if (!html.includes('pocketbase.umd.js')) {
  html = html.replace('</head>', '<script src="https://cdn.jsdelivr.net/npm/pocketbase@0.22.0/dist/pocketbase.umd.js"></script>\n</head>');
}

// 2. Add PocketBase initialization and replace loadDB / save
const dbFunctions = `
const pb = new PocketBase('http://127.0.0.1:8090');

async function loadDB(){
  const results = await Promise.all(STORE_KEYS.map(async k=>{
    try{ 
      if (k === 'config') {
        const records = await pb.collection(k).getFullList();
        return [k, records.length > 0 ? records[0] : null];
      }
      const records = await pb.collection(k).getFullList(); 
      return [k, records.length > 0 ? records : []]; 
    }
    catch(e){ console.error(e); return [k, null]; }
  }));
  results.forEach(([k,v])=>{ if(v!=null) DB[k]=v; });
  if(!DB.config) DB.config = defaultConfig();
}

async function save(key){
  try{
    if (key === 'config') {
      const existing = await pb.collection(key).getFullList();
      if (existing.length > 0) {
        await pb.collection(key).update(existing[0].id, DB.config);
      } else {
        await pb.collection(key).create(DB.config);
      }
      return;
    }

    const pbRecords = await pb.collection(key).getFullList();
    const pbMap = new Map(pbRecords.map(r => [r.id, r]));
    
    for (const item of DB[key]) {
      if (pbMap.has(item.id)) {
        await pb.collection(key).update(item.id, item);
        pbMap.delete(item.id);
      } else {
        const data = { ...item };
        delete data.id; 
        const created = await pb.collection(key).create(data);
        item.id = created.id; 
      }
    }
    
    for (const [id, _] of pbMap) {
      await pb.collection(key).delete(id);
    }
    
  }catch(e){ console.error(e); toast('Error guardando datos', true); }
}`;

const origRegex = /async function loadDB\(\)\{[\s\S]*?async function save\(key\)\{[\s\S]*?\}catch\(e\)\{ toast\('Error guardando datos', true\); \}\n\}/;

if (origRegex.test(html)) {
  html = html.replace(origRegex, dbFunctions);
  fs.writeFileSync('cuadre.html', html);
  console.log('Patched cuadre.html successfully using Regex!');
} else {
  console.log('Regex did not match. Trying fallback string replacement...');
  const startIdx = html.indexOf('async function loadDB()');
  const endIdx = html.indexOf('function defaultConfig()');
  if (startIdx !== -1 && endIdx !== -1) {
    html = html.substring(0, startIdx) + dbFunctions + '\n' + html.substring(endIdx);
    fs.writeFileSync('cuadre.html', html);
    console.log('Patched cuadre.html successfully using index substring!');
  } else {
    console.log('Failed to patch cuadre.html');
  }
}
