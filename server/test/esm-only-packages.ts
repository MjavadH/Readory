import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Self-repairing discovery of the ESM interop workarounds the CommonJS Jest
 * runtime needs.
 *
 * Two *distinct* problems must be solved, and conflating them is the classic
 * source of confusing `Unexpected token 'export'` failures:
 *
 *  1. TRANSFORM. Any package published as `"type": "module"` contains ESM
 *     source. Jest's default `transformIgnorePatterns` skips `node_modules`
 *     entirely, so the file reaches the CJS loader verbatim and throws a
 *     SyntaxError. Such packages must be added to the transform allow-list.
 *     The criterion is exactly `type === 'module'`.
 *
 *  2. RESOLUTION. A subset of those packages expose an `exports` map with no
 *     branch reachable under Jest's CommonJS condition set, so the specifier
 *     cannot be resolved at all. Those additionally need an explicit
 *     `moduleNameMapper` entry. Packages whose exports use a plain string
 *     target (e.g. meilisearch's `".": "./dist/index.js"`) resolve fine and
 *     need only (1).
 *
 * Both are derived from the installed tree rather than hard-coded, because a
 * hard-coded list rots: adding a feature that imports a new ESM-only client,
 * or a patch release that flips a transitive dependency to ESM, would break
 * unrelated suites with an error pointing into `node_modules` instead of at
 * the change that caused it.
 */

type PackageJson = {
  name?: string;
  type?: string;
  main?: string;
  module?: string;
  exports?: unknown;
  dependencies?: Record<string, string>;
};

/**
 * Locates the monorepo root by walking up from the current working directory
 * until a `package.json` declaring npm `workspaces` is found.
 *
 * `__dirname` is deliberately not used: Jest evaluates a TypeScript config
 * file as an ES module, where CommonJS globals do not exist. Anchoring on the
 * workspace manifest also makes the result independent of whether Jest was
 * invoked from `server/` or from the repository root.
 */
function findWorkspaceRoot(): string {
  let current = process.cwd();
  for (;;) {
    const manifest = readPackageJson(join(current, 'package.json'));
    if (manifest && Array.isArray((manifest as { workspaces?: unknown }).workspaces)) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(
        `Unable to locate the monorepo root (no package.json with "workspaces") above ${process.cwd()}. ` +
          'Run Jest from inside the repository.',
      );
    }
    current = parent;
  }
}

const WORKSPACE_ROOT = findWorkspaceRoot();

/**
 * Workspace packages that own the code under test. `shared` is included
 * because it is itself `"type": "module"` and is imported by server source.
 */
const WORKSPACE_PACKAGES = ['server', 'shared'] as const;

/**
 * The conditions Jest's CommonJS resolver applies to an `exports` map.
 * Deliberately excludes `import` and `module-sync`: Node 22's own
 * `require.resolve` honours `module-sync`, so probing with it would wrongly
 * report ESM-only packages such as `file-type` as resolvable under Jest.
 */
const JEST_CJS_CONDITIONS = new Set(['require', 'node', 'default']);

/** Conditions an ESM consumer would match, used to locate the real entry file. */
const ESM_CONDITIONS = ['node', 'import', 'module-sync', 'default'] as const;

function readPackageJson(path: string): PackageJson | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
  } catch {
    return null;
  }
}

/**
 * Resolves a package directory the way Node would, walking up through nested
 * `node_modules` so both hoisting and version conflicts are handled.
 */
function resolvePackageDir(name: string, fromDir: string): string | null {
  let current = fromDir;
  for (;;) {
    const candidate = join(current, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * The transitive closure of `"type": "module"` packages reachable from the
 * workspace packages' runtime dependencies.
 *
 * The closure matters, not just the direct imports: `file-type` pulls in
 * `strtok3`, which pulls in `@tokenizer/inflate` and `token-types`. Every hop
 * must be transformed, because the first untransformed file in the chain is
 * the one that throws.
 *
 * Only `dependencies` are followed — never `devDependencies`. Dev
 * dependencies are not loaded when requiring a package, and following them
 * drags in the entire tooling tree (`@nestjs/cli` alone contributes inquirer,
 * glob, yargs and ~40 more), which needlessly widens the transform surface
 * and slows every suite.
 */
export function discoverEsmOnlyPackages(): string[] {
  const visited = new Set<string>();
  const esmOnly = new Set<string>();

  const visit = (name: string, fromDir: string): void => {
    const dir = resolvePackageDir(name, fromDir);
    if (!dir) return;

    const key = `${name}\u0000${dir}`;
    if (visited.has(key)) return;
    visited.add(key);

    const pkg = readPackageJson(join(dir, 'package.json'));
    if (!pkg) return;

    if (pkg.type === 'module') {
      esmOnly.add(name);
    }

    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      visit(dep, dir);
    }
  };

  for (const workspacePackage of WORKSPACE_PACKAGES) {
    const root = join(WORKSPACE_ROOT, workspacePackage);
    const pkg = readPackageJson(join(root, 'package.json'));
    if (!pkg) continue;
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      visit(dep, root);
    }
  }

  return [...esmOnly].sort();
}

/**
 * Of the ESM-only packages, the subset Jest's CommonJS resolver cannot locate,
 * mapped to their real entry files.
 *
 * The mappings point at genuine implementations, never stubs. That is a
 * correctness requirement rather than a convenience: the avatar upload
 * pipeline's security depends on `file-type` performing real magic-byte
 * sniffing, and a stub that always reported `image/jpeg` would make every
 * spoofed-upload rejection test vacuously green.
 */
export function discoverEsmModuleNameMappings(
  packages: readonly string[],
): Record<string, string> {
  const mappings: Record<string, string> = {};

  for (const name of packages) {
    // The workspace package is mapped to its TypeScript source separately.
    if (name.startsWith('@readory/')) continue;

    const dir = resolvePackageDir(name, join(WORKSPACE_ROOT, 'server'));
    if (!dir) continue;

    const pkg = readPackageJson(join(dir, 'package.json'));
    if (!pkg) continue;

    // Resolvable under Jest's CJS conditions (or has a legacy `main`)? Then it
    // needs transforming only, not remapping.
    if (resolveExports(pkg.exports, JEST_CJS_CONDITIONS) !== null) continue;
    if (pkg.exports === undefined && pkg.main) continue;

    const entry = resolveEsmEntry(pkg.exports) ?? pkg.module ?? pkg.main;
    if (!entry) continue;

    const absolute = join(dir, entry);
    if (existsSync(absolute)) {
      mappings[`^${escapeRegExp(name)}$`] = absolute;
    }
  }

  return mappings;
}

/**
 * Evaluates the root (`"."`) subpath of an `exports` map under a given
 * condition set, returning the target file or `null` when no branch matches.
 * Mirrors Node's algorithm: object keys are ordered conditions, the first
 * match wins, and arrays are fallback lists.
 */
function resolveExports(exportsField: unknown, conditions: Set<string>): string | null {
  if (exportsField === undefined || exportsField === null) return null;
  if (typeof exportsField === 'string') return exportsField;

  if (Array.isArray(exportsField)) {
    for (const entry of exportsField) {
      const resolved = resolveExports(entry, conditions);
      if (resolved !== null) return resolved;
    }
    return null;
  }

  if (typeof exportsField !== 'object') return null;
  const record = exportsField as Record<string, unknown>;

  // A map keyed by subpaths: descend into the root subpath only.
  if (Object.keys(record).some((key) => key.startsWith('.'))) {
    return '.' in record ? resolveExports(record['.'], conditions) : null;
  }

  // A conditions map: first matching key wins, in declaration order.
  for (const [condition, target] of Object.entries(record)) {
    if (condition === 'types') continue;
    if (!conditions.has(condition)) continue;
    const resolved = resolveExports(target, conditions);
    if (resolved !== null) return resolved;
  }
  return null;
}

/**
 * Locates the entry file an ESM consumer would receive. Prefers the `node`
 * condition over the browser-oriented `default`, so Node built-ins stay
 * available — `file-type`'s `default` branch is its dependency-free browser
 * core, which lacks the stream-based detection the server relies on.
 */
function resolveEsmEntry(exportsField: unknown): string | null {
  return resolveExports(exportsField, new Set(ESM_CONDITIONS));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
