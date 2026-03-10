/**
 * In-memory mock for @react-native-async-storage/async-storage.
 * Used by Jest when the package's built-in jest mock path is missing (e.g. in v2).
 */
const store = new Map();

const asyncStorageMock = {
  getItem: jest.fn((key) => Promise.resolve(store.get(key) ?? null)),
  setItem: jest.fn((key, value) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key) => {
    store.delete(key);
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    store.clear();
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve([...store.keys()])),
  multiGet: jest.fn((keys) =>
    Promise.resolve(keys.map((key) => [key, store.get(key) ?? null]))
  ),
  multiSet: jest.fn((pairs) => {
    pairs.forEach(([key, value]) => store.set(key, value));
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys) => {
    keys.forEach((key) => store.delete(key));
    return Promise.resolve();
  }),
};

module.exports = asyncStorageMock;
