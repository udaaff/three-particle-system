/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true
    }]
  },
  moduleNameMapper: {
    '^three/examples/jsm/libs/stats.module$': '<rootDir>/src/__tests__/__mocks__/stats.module.ts'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(three|three/examples/jsm)/)'
  ],
  testMatch: ['**/__tests__/**/*.test.ts']
};