/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.ts'],
  testTimeout: 300000,
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
