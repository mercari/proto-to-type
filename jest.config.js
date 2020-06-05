const pathIgnorePatterns = [
  '<rootDir>/__mocks__',
  '<rootDir>/.circleci',
  '<rootDir>/.github',
  '<rootDir>/.jest',
  '<rootDir>/.cache',
  '<rootDir>/coverage',
  '<rootDir>/node_modules',
];

module.exports = {
  verbose: true,
  rootDir: './',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testRegex: '/__tests__/.*\\.ts$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  automock: false,
  testPathIgnorePatterns: pathIgnorePatterns,
  coveragePathIgnorePatterns: pathIgnorePatterns,
  collectCoverageFrom: ['src/**/*.ts', '!**/*.d.ts', '!**/node_modules/**'],
  collectCoverage: true,
  snapshotSerializers: ['jest-snapshot-serializer-raw'],
};
