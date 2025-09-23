/**
 * Mock for jwks-rsa package to avoid ES module issues in Jest
 */
module.exports = jest.fn().mockImplementation(() => ({
  getSigningKey: jest.fn().mockResolvedValue({
    getPublicKey: jest.fn().mockReturnValue('mock-public-key'),
    kid: 'mock-kid'
  }),
  getSigningKeys: jest.fn().mockResolvedValue([
    {
      getPublicKey: jest.fn().mockReturnValue('mock-public-key'),
      kid: 'mock-kid'
    }
  ])
}));