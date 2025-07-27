# Security Guidelines for WebQX Healthcare Platform

## Environment Variable Usage

This project uses environment variables to securely manage sensitive configurations:

### Available Scripts with Environment Variables:

- `npm run dev` - Development mode with NODE_ENV=development
- `npm run start:prod` - Production mode with NODE_ENV=production  
- `npm test` - Testing with NODE_ENV=test
- `npm run build:prod` - Production build with NODE_ENV=production

### Environment Configuration:

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Update the .env file with your actual values:**
   - Firebase API keys
   - Database credentials
   - JWT secrets
   - External API keys

3. **Never commit .env files to version control**

### Sensitive Data Management:

The following environment variables should be securely managed:
- `FIREBASE_PRIVATE_KEY`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `WHISPER_API_KEY`

### Production Deployment:

Use environment-specific configuration:
```bash
NODE_ENV=production npm run build:prod
NODE_ENV=production npm run start:prod
```