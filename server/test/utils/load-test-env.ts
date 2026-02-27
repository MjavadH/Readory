import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseEnv(raw: string): Record<string, string> {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce<Record<string, string>>((acc, line) => {
      const eqIndex = line.indexOf('=');
      if (eqIndex < 0) return acc;

      const key = line.slice(0, eqIndex).trim();
      const value = line.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      acc[key] = value;
      return acc;
    }, {});
}

export function loadTestEnv() {
  const envPath = resolve(process.cwd(), '.env.test');
  if (!existsSync(envPath)) {
    return;
  }

  const parsed = parseEnv(readFileSync(envPath, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadTestEnv();
