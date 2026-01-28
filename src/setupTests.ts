import '@testing-library/jest-native/extend-expect';

global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
