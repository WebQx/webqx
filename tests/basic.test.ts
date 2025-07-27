describe('WebQX Healthcare Platform', () => {
  test('environment configuration should be available', () => {
    // Test that dotenv is working
    expect(process.env.NODE_ENV).toBeDefined();
  });

  test('basic math operations work', () => {
    expect(2 + 2).toBe(4);
  });

  test('package configuration is valid', () => {
    const packageJson = require('../package.json');
    expect(packageJson.name).toBe('webqx-healthcare-platform');
    expect(packageJson.version).toBe('1.0.0');
    expect(packageJson.scripts.test).toContain('jest');
    expect(packageJson.scripts.build).toContain('tsc');
  });
});