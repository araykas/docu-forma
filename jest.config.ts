import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  moduleNameMapper: {
    // Resolve @/* path alias dari tsconfig
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Override beberapa opsi tsconfig untuk compatibility Jest
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
        },
      },
    ],
  },
  // Patterns file test
  testMatch: ['**/__tests__/**/*.test.ts'],
  // Coverage config
  collectCoverageFrom: [
    'lib/**/*.ts',
    '!lib/.gitkeep',
    'app/api/**/*.ts',
  ],
  coverageReporters: ['text', 'text-summary'],
  // Timeout per test
  testTimeout: 15000,
  // Suppress verbose ts-jest logs
  globals: {},
}

export default config
