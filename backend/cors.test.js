import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ALLOWED_ORIGINS, resolveAllowedOrigin } from './cors';

describe('cors', () => {
  it('許可オリジンの一覧が、serverless.ymlのcustom.allowedOriginsと一致する（issue #2185）', () => {
    const yml = readFileSync(new URL('./serverless.yml', import.meta.url), 'utf8');
    // allowedOrigins:の次の行から、"    - "で始まる行が続く間を、順に読む
    const lines = yml.split('\n');
    const start = lines.indexOf('  allowedOrigins:');
    expect(start).toBeGreaterThan(-1);
    const origins = [];
    for (let i = start + 1; lines[i].startsWith('    - '); i += 1) {
      origins.push(lines[i].slice('    - '.length).split(' ')[0]);
    }
    expect(ALLOWED_ORIGINS).toEqual(origins);
  });

  it('許可されたオリジンはそのまま返し、それ以外は先頭の本番オリジンを返す', () => {
    expect(resolveAllowedOrigin({ headers: { origin: 'http://localhost:5173' } })).toBe('http://localhost:5173');
    expect(resolveAllowedOrigin({ headers: { Origin: 'https://evil.example' } })).toBe(ALLOWED_ORIGINS[0]);
    expect(resolveAllowedOrigin({})).toBe(ALLOWED_ORIGINS[0]);
  });
});
