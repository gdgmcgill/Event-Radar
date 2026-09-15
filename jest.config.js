/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
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
