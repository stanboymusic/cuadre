const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'pb_migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js') && f.startsWith('1785'));

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace app.save(collection); with try/catch
  // Some files have `return app.save(collection);`
  // Some have `app.save(collection);`
  
  if (!content.includes('/* FIXED */')) {
    content = content.replace(/return app\.save\(collection\);/g, `try { return app.save(collection); } catch (e) { if (e.message && e.message.includes("unique")) { console.log("Skipping creation of existing collection in " + "${file}"); } else { throw e; } }`);
    content = content.replace(/app\.save\(collection\);/g, `try { app.save(collection); } catch (e) { if (e.message && e.message.includes("unique")) { console.log("Skipping creation of existing collection in " + "${file}"); } else { throw e; } }`);
    
    // Also handle app.save(companies); etc in multitenancy migration
    content = content.replace(/app\.save\(([^)]+)\);/g, `try { app.save($1); } catch (e) { if (e.message && e.message.includes("unique")) { console.log("Skipping existing in " + "${file}"); } else { throw e; } }`);

    content = `/* FIXED */\n` + content;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${file}`);
  }
}
