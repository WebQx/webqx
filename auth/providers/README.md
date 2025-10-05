# Provider Portal Authentication

## Demo Credentials

For testing the provider login at `https://webqx-production.up.railway.app/auth/providers/login.html`, use these credentials:

### Physician Account
- **Username:** `dr.smith@hospital.com`
- **Password:** `password123`
- **Roles:** Physician, Administrator
- **Specialty:** Internal Medicine
- **NPI:** 1234567890
- **License:** MD123456 (CA)

### Nurse Account
- **Username:** `nurse.johnson@hospital.com`
- **Password:** `password123`
- **Role:** Nurse
- **Specialty:** Critical Care
- **License:** RN987654 (CA)

### Pharmacist Account
- **Username:** `pharm.davis@hospital.com`
- **Password:** `password123`
- **Role:** Pharmacist
- **Specialty:** Clinical Pharmacy
- **License:** PharmD456789 (CA)

## API Endpoint

The provider login endpoint is available at:

```
POST /api/auth/provider/login
```

### Request Body

```json
{
  "username": "dr.smith@hospital.com",
  "password": "password123",
  "rememberMe": false
}
```

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "6dc6a14a-0653-4fb9-952c-a4c5d19ed71e",
    "username": "dr.smith@hospital.com",
    "email": "dr.smith@hospital.com",
    "name": "Dr. Sarah Smith",
    "roles": ["physician", "administrator"],
    "specialty": "Internal Medicine",
    "npi": "1234567890",
    "licenseNumber": "MD123456",
    "licenseState": "CA"
  },
  "session": {
    "id": "f44c3555-57e7-44fa-baa2-47b0b661f0e5",
    "expiresAt": "2025-10-06T05:16:30.210Z"
  }
}
```

### Error Response (401 Unauthorized)

```json
{
  "success": false,
  "error": "Invalid credentials",
  "code": "INVALID_CREDENTIALS"
}
```

## Security Features

- **Rate Limiting:** 5 login attempts per 15 minutes per IP
- **Account Locking:** After 5 failed attempts, account is temporarily locked
- **Password Hashing:** All passwords are hashed with bcrypt
- **Session Management:** JWT tokens with 8-hour expiration
- **HTTP-Only Cookies:** Tokens are also stored in secure HTTP-only cookies

## Notes

- These are demo credentials for testing purposes only
- In production, use proper authentication with your identity provider
- The demo credentials are hardcoded in `routes.js` and should be replaced with a proper user management system
