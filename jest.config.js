/** @type {import('ts-jest').JestConfigWithTsJest} */

// Everything both projects must share. Lifted verbatim from the single-project
// config this file replaced (plan 02-08, batch 5), so neither project can drift
// from the module resolution the 18 already-executing suites ran under.
const common = {
  preset: 'ts-jest',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // sanitize-html 2.17.7 (batch 4, plan 02-07) depends on htmlparser2 ^12, which is
  // pure ESM ("type": "module", no CommonJS build). Node 24 loads it from CommonJS
  // via require(esm); Jest's CommonJS runtime does not, so the htmlparser2 chain has
  // to be transformed rather than ignored. Without this, src/lib/sanitize.test.ts and
  // src/__tests__/api/events/date-validation.test.ts fail to parse at import time.
  // The allow-list is the ESM chain only — every other node_modules path stays ignored.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {}],
    '^.+\\.m?jsx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: {
          allowJs: true,
          module: 'CommonJS',
          target: 'ES2020',
          esModuleInterop: true,
        },
      },
    ],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(htmlparser2|domhandler|domutils|dom-serializer|domelementtype|entities)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.claude/', '/supabase/functions/tests/'],
};

// Two projects, one routing rule, one place to read it. The rule is NOT "by file
// extension": src/hooks/useEvents.test.ts is a .ts file that renders React hooks
// and needs a DOM, so the hooks directory is routed to jsdom explicitly and
// excluded from node so no suite runs twice.
//
// No permissive no-tests-found flag, no coverage threshold, no watch flag. Jest
// exiting non-zero when it matches nothing is the behaviour worth keeping: a
// config error that made it match nothing would otherwise report green.
module.exports = {
  projects: [
    {
      ...common,
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      testPathIgnorePatterns: [...common.testPathIgnorePatterns, '<rootDir>/src/hooks/'],
    },
    {
      ...common,
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/**/*.test.tsx', '<rootDir>/src/hooks/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    },
  ],
};
