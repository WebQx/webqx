/**
 * Mock for @azure/identity package to avoid ES module issues in Jest
 */
module.exports = {
  ClientSecretCredential: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({
      token: 'mock-token',
      expiresOnTimestamp: Date.now() + 3600000
    })
  })),
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({
      token: 'mock-token',
      expiresOnTimestamp: Date.now() + 3600000
    })
  })),
  ChainedTokenCredential: jest.fn(),
  ManagedIdentityCredential: jest.fn()
};