import { flattenJsonPayload, compressStreamPayload } from '../jsonStreamOptimizer';

describe('JSON Stream Optimizer', () => {
  test('should flatten nested JSON objects', () => {
    const complex = {
      user: { name: 'John', profile: { age: 30 } }
    };
    const flattened = flattenJsonPayload(complex);
    expect(flattened['user.name']).toBe('John');
    expect(flattened['user.profile.age']).toBe(30);
  });

  test('should compress stream payloads', () => {
    const data = [
      { nested: { value: 1 } },
      { nested: { value: 2 } }
    ];
    const compressed = compressStreamPayload(data);
    expect(compressed.length).toBe(2);
    expect(compressed[0]['nested.value']).toBe(1);
  });
});
