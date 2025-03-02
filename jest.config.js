/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleNameMapper: {
    '^three/examples/jsm/libs/stats.module$': '<rootDir>/src/__tests__/__mocks__/stats.module.ts',
    '\\.(glsl|vert|frag)$': '<rootDir>/src/__tests__/shaderMock.ts'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(three|three/examples/jsm)/)'
  ],
  testMatch: ['**/__tests__/**/*.test.ts']
};