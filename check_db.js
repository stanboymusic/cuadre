const fs = require('fs');
const pbPath = 'pb_data/data.db';

if (!fs.existsSync(pbPath)) {
  console.log('No db found');
  process.exit(0);
}

// Basic parse for sqlite
const exec = require('child_process').execSync;
try {
  // Use sqlite3 binary if available, or just read strings
  const out = exec(`sqlite3 ${pbPath} "SELECT name, schema, updateRule FROM _collections WHERE name IN ('users', 'sales');"`);
  console.log(out.toString());
} catch(e) {
  console.log('No sqlite3 available on Windows probably');
}
