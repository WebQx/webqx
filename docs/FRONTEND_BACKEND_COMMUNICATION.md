# WebQx Global - Frontend-Backend Communication Architecture 🌐

> NOTE: This repository is now container-first (Docker/Railway). Any references or examples involving AWS Serverless/Lambda/API Gateway or CloudFormation are historical and deprecated. Prefer Nginx reverse proxy, container deployments, and Railway/GitHub Pages workflows described below.

## Current Architecture Overview

### **Frontend (GitHub Pages) ↔ Backend (Local Server) Communication**

```
┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
│   GitHub Pages      │       │   API Gateway       │       │   Local Backend     │
│   (Frontend)        │◄─────►│   (Optional)        │◄─────►│   (Your PC)         │
│                     │       │                     │       │                     │
│ - Static HTML/JS    │       │ - Load Balancing    │       │ - Node.js Server    │
│ - React/Vue/Angular │       │ - Rate Limiting     │       │ - Authentication    │
│ - Global CDN        │       │ - SSL Termination   │       │ - Database          │
│ - 99.9% Uptime      │       │ - Health Checks     │       │ - Business Logic    │
└─────────────────────┘       └─────────────────────┘       └─────────────────────┘
```

## 🔄 **Current Communication Flow**

### **1. Direct Communication (Current Setup)**
```javascript
// Frontend (GitHub Pages) → Backend (localhost:3001)
const API_BASE_URL = 'http://localhost:3001';

// API calls from frontend
fetch(`${API_BASE_URL}/api/auth/login/`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(credentials)
});
```

### **2. CORS Configuration (Current)**
```javascript
// Backend CORS settings
const corsOptions = {
    origin: [
        'https://yourusername.github.io',  // GitHub Pages
        'http://localhost:3000',           // Local dev
        'http://localhost:3001'            // Backend
    ],
    credentials: true,
    optionsSuccessStatus: 200
};
```

## 🛡️ **24/7 Communication Solutions**

### **Option 1: Cloud API Gateway (Recommended for Production)**

#### [DEPRECATED] AWS API Gateway + Lambda
```yaml
# serverless.yml
service: webqx-api-gateway

provider:
  name: aws
  runtime: nodejs18.x
  stage: prod
  
functions:
  authProxy:
    handler: lambda/auth-proxy.handler
    events:
      - http:
          path: /api/{proxy+}
          method: ANY
          cors: true
```

#### **Google Cloud API Gateway**
```yaml
# api-gateway.yaml
swagger: '2.0'
info:
  title: WebQx Global API
  version: 1.0.0
host: webqx-gateway.googleapis.com
schemes:
  - https
paths:
  /api/auth/**:
    x-google-backend:
      address: https://your-backend-url.com
      protocol: h2
```

#### **Azure API Management**
```xml
<!-- API Management Policy -->
<policies>
    <inbound>
        <cors>
            <allowed-origins>
                <origin>https://yourusername.github.io</origin>
            </allowed-origins>
        </cors>
        <rate-limit calls="1000" renewal-period="3600" />
    </inbound>
</policies>
```

### **Option 2: Reverse Proxy (Cost-Effective)**

#### **Nginx Reverse Proxy**
```nginx
# nginx.conf
upstream webqx_backend {
    server localhost:3001;
    server localhost:3002 backup;  # Failover
}

server {
    listen 80;
    server_name api.webqx.com;
    
    # CORS headers
    add_header Access-Control-Allow-Origin "https://yourusername.github.io";
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
    add_header Access-Control-Allow-Headers "Authorization, Content-Type";
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    location /api/ {
        limit_req zone=api burst=20;
        proxy_pass http://webqx_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Health checks
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
    }
}
```

#### **Cloudflare as API Gateway**
```javascript
// Cloudflare Worker (Edge Computing)
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    const url = new URL(request.url)
    
    // Route to your backend
    if (url.pathname.startsWith('/api/')) {
        const backends = [
            'http://your-pc-ip:3001',
            'http://backup-server:3001'
        ]
        
        return fetch(backends[0], {
            method: request.method,
            headers: request.headers,
            body: request.body
        })
    }
    
    return new Response('Not found', { status: 404 })
}
```

## 💡 **24/7 High Availability Solutions**

### **1. Multiple Backend Instances**
```bash
# Terminal 1: Primary server
cd django-auth-backend
PORT=3001 node auth-server-social.js

# Terminal 2: Backup server
cd django-auth-backend
PORT=3002 node auth-server-social.js

# Terminal 3: API Gateway
cd django-auth-backend
PORT=3000 node api-gateway-proxy.js
```

### **2. Docker Containerization**
```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["node", "auth-server-social.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  webqx-api-gateway:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - GATEWAY_PORT=3000
    depends_on:
      - webqx-auth-1
      - webqx-auth-2
      
  webqx-auth-1:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      
  webqx-auth-2:
    build: .
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - PORT=3002
```

### **3. Process Management with PM2**
```javascript
// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: 'webqx-gateway',
            script: 'api-gateway-proxy.js',
            instances: 'max',
            exec_mode: 'cluster',
            env: {
                PORT: 3000,
                NODE_ENV: 'production'
            }
        },
        {
            name: 'webqx-auth-1',
            script: 'auth-server-social.js',
            instances: 2,
            exec_mode: 'cluster',
            env: {
                PORT: 3001,
                NODE_ENV: 'production'
            }
        },
        {
            name: 'webqx-auth-2',
            script: 'auth-server-social.js',
            instances: 2,
            exec_mode: 'cluster',
            env: {
                PORT: 3002,
                NODE_ENV: 'production'
            }
        }
    ]
};
```

## 🔧 **Current Implementation Status**

### **✅ What's Working Now**
- **Backend Server**: Running on localhost:3001
- **CORS Configuration**: Supports GitHub Pages cross-origin requests
- **OAuth Integration**: Google & Microsoft social login ready
- **Health Checks**: `/health/` endpoint monitoring server status
- **Security**: JWT tokens, rate limiting, CORS protection

### **🚀 Frontend Communication Methods**

#### **1. Direct API Calls (Current)**
```javascript
// From GitHub Pages to your local server
const response = await fetch('http://localhost:3001/api/auth/login/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ email, password })
});
```

#### **2. WebSocket Real-time Communication**
```javascript
// Real-time updates (optional enhancement)
const socket = new WebSocket('ws://localhost:3001');
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Real-time update:', data);
};
```

#### **3. Server-Sent Events (SSE)**
```javascript
// Live notifications
const eventSource = new EventSource('http://localhost:3001/events');
eventSource.onmessage = (event) => {
    const notification = JSON.parse(event.data);
    showNotification(notification);
};
```

## 📊 **Performance & Reliability Features**

### **1. Health Monitoring**
- **Endpoint**: `GET /health/`
- **Response Time Tracking**: Monitor API performance
- **Uptime Monitoring**: 99.9% availability target
- **Error Rate Tracking**: < 0.1% error rate

### **2. Load Balancing**
- **Round Robin**: Distribute requests across multiple servers
- **Health Checks**: Route traffic only to healthy instances
- **Circuit Breaker**: Fail fast when services are down
- **Retry Logic**: Automatic retry for failed requests

### **3. Caching Strategy**
- **JWT Token Caching**: Reduce authentication overhead
- **Response Caching**: Cache frequently accessed data
- **CDN Integration**: GitHub Pages provides global caching
- **Browser Caching**: Optimize frontend performance

## 🛡️ **Security & Compliance**

### **1. API Security**
- **Rate Limiting**: Prevent abuse (1000 requests/15 minutes)
- **CORS Protection**: Restrict cross-origin access
- **JWT Authentication**: Secure token-based auth
- **HTTPS Enforcement**: Encrypt all communications

### **2. Healthcare Compliance**
- **HIPAA Compliance**: Patient data protection
- **GDPR Compliance**: European data privacy
- **Audit Logging**: Track all user actions
- **Data Encryption**: Encrypt sensitive data at rest

## 🌍 **Global Scaling Recommendations**

### **1. For Millions of Users (MUP)**
- **Cloud API Gateway**: AWS/Azure/GCP for global reach
- **CDN Integration**: CloudFlare for worldwide performance
- **Database Scaling**: MongoDB/PostgreSQL clustering
- **Auto-scaling**: Kubernetes for dynamic scaling

### **2. Cost-Effective Solutions**
- **Nginx Reverse Proxy**: Free load balancing
- **GitHub Pages**: Free global frontend hosting
- **Local PC Backend**: Zero hosting costs
- **Open Source Tools**: Minimize licensing costs

## 📈 **Implementation Roadmap**

### **Phase 1: Current State (✅ Complete)**
- [x] Authentication server running
- [x] GitHub Pages frontend ready
- [x] OAuth social login working
- [x] CORS configured for cross-origin

### **Phase 2: API Gateway (🔄 In Progress)**
- [ ] Deploy API gateway proxy
- [ ] Configure load balancing
- [ ] Set up health monitoring
- [ ] Implement circuit breaker

### **Phase 3: Production Scaling**
- [ ] Cloud API gateway deployment
- [ ] Database clustering
- [ ] Monitoring & alerting
- [ ] Automated deployment pipeline

## 🎯 **Next Steps for 24/7 Operation**

1. **Start API Gateway**: Deploy the gateway proxy for load balancing
2. **Multiple Instances**: Run multiple backend servers for redundancy
3. **Health Monitoring**: Set up automated health checks
4. **Domain & SSL**: Configure custom domain with HTTPS
5. **Cloud Migration**: Move to cloud API gateway for global reach

Your WebQx Global platform is well-positioned for 24/7 operation with the current architecture serving as a solid foundation for scaling to millions of users! 🏥🌐
