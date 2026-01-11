const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
  
  function getReleaseDate(version) {
    try {
      // try v${version}
      let dateStr;
      try {
        dateStr = execSync(`git log -1 --format=%ai v${version}`, { stdio: 'pipe' }).toString().trim();
      } catch (e) {
        // ignore
      }

      if (!dateStr) {
        try {
          dateStr = execSync(`git log -1 --format=%ai ${version}`, { stdio: 'pipe' }).toString().trim();
        } catch (e) {
          // ignore
        }
      }

      if (!dateStr) return null;

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;

      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const H = String(date.getHours()).padStart(2, '0');
      const M = String(date.getMinutes()).padStart(2, '0');
      return `${y}/${m}/${d} ${H}:${M}`;
    } catch (error) {
      // Fallback to changelog date, assuming midnight if no time is available
      const fallbackDate = new Date(version);
      if (isNaN(fallbackDate.getTime())) return null;
      return `${fallbackDate.getFullYear()}/${String(fallbackDate.getMonth() + 1).padStart(2, '0')}/${String(fallbackDate.getDate()).padStart(2, '0')} 00:00`;
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    
    const start = current.endIndex;
    const end = next ? next.index : content.length;
    
    let body = content.substring(start, end).trim();
    
    const gitDate = getReleaseDate(current.version);

    entries.push({
      version: current.version,
      date: gitDate || 
            (current.date.match(/^\d{4}-\d{2}-\d{2}$/) 
              ? `${current.date.replace(/-/g, '/')}` + ' 00:00'
              : current.date.replace(/-/g, '/')),
      body: body
    });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2));
  console.log(`Changelog converted to JSON: ${entries.length} entries`);
  
} catch (error) {
  console.error('Error converting changelog:', error);
  process.exit(1);
}
