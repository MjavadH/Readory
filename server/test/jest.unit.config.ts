import type { Config } from 'jest';
import { discoverEsmModuleNameMappings, discoverEsmOnlyPackages } from './esm-only-packages';

/**
 * The ESM interop surface is discovered from the installed dependency tree at
 * config-load time rather than hard-coded. See `test/esm-only-packages.ts` for
 * why: a literal list silently rots, and when it does, the failure surfaces as
 * a SyntaxError inside node_modules that points nowhere near the change that
 * caused it.
 */
const ESM_ONLY_PACKAGES = discoverEsmOnlyPackages();
const ESM_MODULE_NAME_MAPPINGS = discoverEsmModuleNameMappings(ESM_ONLY_PACKAGES);

const config: Config = {
  displayName: 'unit',
  rootDir: '..',
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],

  // Unit + integration specs live next to their subject; e2e specs are matched
  // by test/jest.e2e.config.ts instead.
  testMatch: ['<rootDir>/src/**/*.spec.ts'],

  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        // Type errors are enforced by the dedicated `npm run typecheck:spec`
        // gate. Doing full type-checking inside the transform makes ts-jest
        // re-check the ~2MB generated Prisma client for every file, which took
        // the suite from seconds to >10 minutes and exhausted the heap.
        isolatedModules: true,
      },
    ],
  },

  transformIgnorePatterns: [`/node_modules/(?!(${ESM_ONLY_PACKAGES.join('|')})/)`],

  moduleNameMapper: {
    // The workspace symlinks @readory/shared into node_modules, so map it to
    // the real source. It's package.json is `"type": "module"`, which is why
    // tsconfig.spec.json must force CommonJS emit.
    '^@readory/shared$': '<rootDir>/../shared/index.ts',

    // ESM-only packages whose exports map exposes no branch reachable under
    // Jest's CommonJS condition set, pointed at their real entry files. These
    // resolve to genuine implementations, never stubs, so tests exercise real
    // magic-byte sniffing and real UUID generation.
    ...ESM_MODULE_NAME_MAPPINGS,

    // Source uses NodeNext-style `./foo.js` specifiers that refer to `./foo.ts`.
    // Strip the extension so the CommonJS resolver can find the TypeScript file.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  setupFilesAfterEnv: ['<rootDir>/test/setup-unit.ts'],

  clearMocks: true,
  restoreMocks: true,
  resetModules: true,

  // The sandbox/CI container has ~2GB of RAM and 2 cores. A single recycled
  // worker keeps peak RSS bounded; `--runInBand` would accumulate every
  // NestJS module graph in one heap and reliably OOMs.
  maxWorkers: 1,
  workerIdleMemoryLimit: '512MB',

  coverageDirectory: '<rootDir>/coverage/unit',
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.spec.ts',
    '!<rootDir>/src/**/*.module.ts',
    '!<rootDir>/src/**/dto/**',
    '!<rootDir>/src/main.ts',
  ],
};

export default config;
