// WebQX Local EMR Server
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
    origin: ['http://localhost:3001', 'http://127.0.0.1:3001', 'https://*.github.io'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving
app.use(express.static(path.join(__dirname, '../public')));
app.use('/patient-portal', express.static(path.join(__dirname, '../patient-portal')));
app.use('/provider', express.static(path.join(__dirname, '../provider')));
app.use('/admin-console', express.static(path.join(__dirname, '../admin-console')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'WebQX Local EMR Server',
        timestamp: new Date().toISOString(),
    version: 'v0.1.0',
        uptime: process.uptime(),
        endpoints: {
            emr: 'http://localhost:3000',
            telehealth: 'http://localhost:3003',
            proxy: 'http://localhost:3001'
        }
    });
});

// EMR API endpoints
app.get('/api/emr/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'WebQX EMR',
        timestamp: new Date().toISOString(),
        database: 'connected',
        version: '7.0.3-WebQX'
    });
});

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
    const { username, password, role } = req.body;
    
    // Simple authentication for demo
    if (username && password) {
        const user = {
            id: 'user_' + Date.now(),
            username: username,
            role: role || 'patient',
            name: username.charAt(0).toUpperCase() + username.slice(1),
            email: `${username}@webqx.local`,
            lastLogin: new Date().toISOString(),
            permissions: role === 'admin' ? ['read', 'write', 'admin'] : ['read']
        };
        
        const token = 'webqx_token_' + Buffer.from(JSON.stringify(user)).toString('base64');
        
        res.json({
            success: true,
            user: user,
            token: token,
            expiresIn: '24h',
            redirectUrl: getRedirectUrl(role)
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid credentials'
        });
    }
});

// Get user profile
app.get('/api/auth/profile', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token && token.startsWith('webqx_token_')) {
        try {
            const userData = JSON.parse(Buffer.from(token.replace('webqx_token_', ''), 'base64').toString());
            res.json({
                success: true,
                user: userData
            });
        } catch (error) {
            res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
    } else {
        res.status(401).json({
            success: false,
            message: 'No token provided'
        });
    }
});

// Patient API
app.get('/api/patients', (req, res) => {
    res.json({
        patients: [
            {
                id: 'P001',
                name: 'John Doe',
                dob: '1985-06-15',
                gender: 'male',
                phone: '555-0123',
                email: 'john.doe@email.com'
            },
            {
                id: 'P002',
                name: 'Jane Smith',
                dob: '1990-03-22',
                gender: 'female', 
                phone: '555-0124',
                email: 'jane.smith@email.com'
            }
        ]
    });
});

// Appointment API
app.get('/api/appointments', (req, res) => {
    res.json({
        appointments: [
            {
                id: 'A001',
                patientId: 'P001',
                patientName: 'John Doe',
                date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                time: '10:00 AM',
                type: 'Consultation',
                status: 'scheduled'
            }
        ]
    });
});

// FHIR-like endpoints
app.get('/fhir/Patient', (req, res) => {
    res.json({
        resourceType: 'Bundle',
        type: 'searchset',
        total: 2,
        entry: [
            {
                resource: {
                    resourceType: 'Patient',
                    id: 'P001',
                    identifier: [{ value: 'P001' }],
                    name: [{ given: ['John'], family: 'Doe' }],
                    gender: 'male',
                    birthDate: '1985-06-15'
                }
            }
        ]
    });
});

// Provider portal routes
app.get('/provider/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../provider/index.html'));
});

// Patient portal routes
app.get('/patient-portal/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../patient-portal/index.html'));
});

// Admin console routes
app.get('/admin-console/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin-console/index.html'));
});

// Helper function to determine redirect URL based on role
function getRedirectUrl(role) {
    switch (role) {
        case 'provider':
        case 'doctor':
        case 'nurse':
            return '/provider/';
        case 'admin':
            return '/admin-console/';
        case 'patient':
        default:
            return '/patient-portal/';
    }
}

// Error handling
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🏥 WebQX Local EMR Server started on port ${PORT}`);
    console.log(`   • Health Check: http://localhost:${PORT}/health`);
    console.log(`   • Patient Portal: http://localhost:${PORT}/patient-portal/`);
    console.log(`   • Provider Portal: http://localhost:${PORT}/provider/`);
    console.log(`   • Admin Console: http://localhost:${PORT}/admin-console/`);
    console.log(`   • EMR API: http://localhost:${PORT}/api/emr/*`);
    console.log(`   • Authentication: http://localhost:${PORT}/api/auth/*`);
});

module.exports = app;