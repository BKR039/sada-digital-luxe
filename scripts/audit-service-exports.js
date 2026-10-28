const fs = require('fs');
const path = require('path');

const libDir = path.resolve('src/lib');
const files = fs.readdirSync(libDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

for (const file of files) {
  const content = fs.readFileSync(path.join(libDir, file), 'utf-8');
  const lines = content.split(/\r?\n/);
  const exports = [];
  lines.forEach((line, idx) => {
    if (line.match(/^export (async )?function /) || line.match(/^export const [a-zA-Z0-9_]+ =/)) {
      exports.push(`L${idx + 1}: ${line.trim().slice(0, 90)}`);
    }
  });
  console.log(`\n=== ${file} (${lines.length} lines, ${exports.length} exports) ===`);
  exports.forEach(e => console.log('  ' + e));
}
