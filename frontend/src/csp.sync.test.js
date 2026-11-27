// infra/serverless.ymlのCSP（本番）が、frontend/csp.js（正本）と一致することを検査する（issue #2386）。
// serverless.ymlはESMのcsp.jsを読み込めないため、文字列を複製している。ずれると、E2Eが通るのに本番だけ
// 違う制約になるため、一致をテストで固定する
import { describe, expect, it } from 'vitest';
import csp from '../csp.js';
import yml from '../../infra/serverless.yml?raw';

describe('CSPの同期', () => {
  it('infra/serverless.ymlのContentSecurityPolicyが、csp.jsの値と一致する', () => {
    const match = yml.match(/ContentSecurityPolicy: "([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match[1]).toBe(csp);
  });
});
