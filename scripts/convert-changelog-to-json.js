const fs = require('fs');
const path = require('path');

const changelogPath = path.resolve(__dirname, '../CHANGELOG.md');
const outputPath = path.resolve(__dirname, '../frontend/src/changelog.json');

try {
  if (!fs.existsSync(changelogPath)) {
    console.log('CHANGELOG.md not found, skipping JSON generation.');
    fs.writeFileSync(outputPath, '[]');
    process.exit(0);
  }

  const content = fs.readFileSync(changelogPath, 'utf8');
  
  // バージョンヘッダーのマッチング (例: ## [1.1.0](...) (2025-01-04) または # 1.1.0 (2025-01-04))
  const versionRegex = /^#+ \[?([0-9.]+)\]?(?:\(.*\))? \(([0-9-]+)\)/gm;
  
  const entries = [];
  let match;
  
  const matches = [];
  while ((match = versionRegex.exec(content)) !== null) {
    matches.push({
      version: match[1],
      date: match[2],
      index: match.index,
      endIndex: match.index + match[0].length
    });
  }
  
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    
    const start = current.endIndex;
    const end = next ? next.index : content.length;
    
    let body = content.substring(start, end).trim();
    
    entries.push({
      version: current.version,
      date: current.date,
      body: body
    });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2));
  console.log(`Changelog converted to JSON: ${entries.length} entries`);
  
} catch (error) {
  console.error('Error converting changelog:', error);
  process.exit(1);
}
