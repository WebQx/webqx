#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Create dist directory
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

console.log('Building static site for GitHub Pages (production-only)...');

// Detect Railway-backed API/EMR endpoints provided via CI environment or local config/pages-runtime.json
let RUNTIME_API_BASE = process.env.RAILWAY_PUBLIC_API_BASE || '';
let RUNTIME_EMR_BASE = process.env.RAILWAY_PUBLIC_EMR_BASE || '';
if (!RUNTIME_API_BASE) {
    try {
        const json = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'pages-runtime.json'), 'utf8'));
        RUNTIME_API_BASE = json.apiBase || '';
        RUNTIME_EMR_BASE = json.emrBase || '';
        if (RUNTIME_API_BASE) console.log('Using runtime config from config/pages-runtime.json');
    } catch (_) {}
}
const USING_RUNTIME_CONFIG = Boolean(RUNTIME_API_BASE);

// Normalize runtime bases: ensure https:// scheme for GitHub Pages
function normalizeBase(u) {
    if (!u) return '';
    // already has scheme
    if (/^https?:\/\//i.test(u)) return u;
    // add https by default for public backends
    return 'https://' + u.replace(/^\/*/, '');
}
if (USING_RUNTIME_CONFIG) {
    RUNTIME_API_BASE = normalizeBase(RUNTIME_API_BASE);
    if (RUNTIME_EMR_BASE) RUNTIME_EMR_BASE = normalizeBase(RUNTIME_EMR_BASE);
}

// Build the React portal (Vite) if its package.json exists
try {
    const portalPkg = path.join(__dirname, '..', 'portal', 'package.json');
    if (fs.existsSync(portalPkg)) {
        console.log('Detected portal app. Building with Vite...');
        const { execSync } = require('child_process');
        execSync('npm run portal:build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    } else {
        console.log('Portal app not found, skipping portal build.');
    }
} catch (err) {
    console.warn('Portal build failed (continuing without portal):', err.message);
}

// HTML files to copy (demos removed)
const htmlFiles = [
    'index.html'
];

// Copy HTML files
htmlFiles.forEach(file => {
    const srcPath = path.join(__dirname, '..', file);
    const destPath = path.join(distDir, file);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied: ${file}`);
    } else {
        // Fallback: certain demos live under archive/demos
        const altPath = path.join(__dirname, '..', 'archive', 'demos', file);
        if (fs.existsSync(altPath)) {
            fs.copyFileSync(altPath, destPath);
            console.log(`Copied (from archive/demos): ${file}`);
        } else {
            console.warn(`File not found: ${file}`);
        }
    }
});

// Copy directories with HTML files
const directoriesToCopy = [
    'provider',
    'patient-portal',
    'auth',
    'modules',
    'admin-console'
];

directoriesToCopy.forEach(dirName => {
    const srcDir = path.join(__dirname, '..', dirName);
    const destDir = path.join(distDir, dirName);
    
    if (fs.existsSync(srcDir)) {
        copyDirectoryRecursive(srcDir, destDir);
        console.log(`Copied directory: ${dirName}`);
        // Generate an index.html stub if none exists to support portal placement cards
        const indexPath = path.join(destDir, 'index.html');
        if (!fs.existsSync(indexPath)) {
            const title = dirName.replace(/[-_]/g, ' ');
            const stub = `<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/><title>${title} • WebQX</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:40px;background:#f5f7fb;color:#1a202c}h1{font-size:1.6rem;margin:0 0 1rem;background:linear-gradient(135deg,#2563eb,#4f46e5);-webkit-background-clip:text;color:transparent}a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}footer{margin-top:3rem;font-size:.65rem;color:#64748b}</style></head><body><h1>${title} Section</h1><p>No dedicated landing page was found for <code>${dirName}/</code>. This stub was auto-generated during the GitHub Pages build so navigation cards remain functional.</p><p><a href=\"../index.html\">← Back to Root</a> • <a href=\"../portal/\">Portal Dashboard</a></p><footer>Auto-generated stub • ${new Date().toISOString()}</footer></body></html>`;
            fs.writeFileSync(indexPath, stub);
            console.log(`Created stub index.html for ${dirName}`);
        }
    } else {
        console.log(`Directory not found: ${dirName}`);
    }
});

// Function to copy directory recursively
function copyDirectoryRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(src);
    
    items.forEach(item => {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        const stat = fs.statSync(srcPath);
        
        if (stat.isDirectory()) {
            // Skip node_modules, .git, and other build directories
            if (!['node_modules', '.git', '__tests__', 'test', 'tests', '.vscode'].includes(item)) {
                copyDirectoryRecursive(srcPath, destPath);
            }
        } else if (stat.isFile()) {
            // Copy HTML, CSS, JS, and other web assets
            const ext = path.extname(item).toLowerCase();
            if (['.html', '.css', '.js', '.json', '.md', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico'].includes(ext)) {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    });
}

// Demo directory intentionally excluded from production build

// Skip copying arbitrary root JS files for production build

// Skip copying root CSS; handled by app pipelines

// No demo mocks or Pages integration patch in production build

// If Railway endpoints are provided, generate a tiny runtime config consumed by webqx-remote-config.js
if (USING_RUNTIME_CONFIG) {
    const runtimeCfg = `// Generated by build-pages.js (production)
window.WEBQX_PROD_API = ${JSON.stringify(RUNTIME_API_BASE)};
window.WEBQX_PROD_EMR = ${JSON.stringify(RUNTIME_EMR_BASE || RUNTIME_API_BASE.replace('api.', 'emr.'))};
window.WEBQX_FORCE_ENV = 'remote';
console.log('🔧 Runtime config injected:', window.WEBQX_PROD_API, '→ EMR:', window.WEBQX_PROD_EMR);
`;
    fs.writeFileSync(path.join(distDir, 'runtime-config.js'), runtimeCfg);
    console.log('Created: runtime-config.js');
}

// Copy service worker
const swSrc = path.join(__dirname, '..', 'webqx-sw.js');
if (fs.existsSync(swSrc)) {
    const swDest = path.join(distDir, 'webqx-sw.js');
    fs.copyFileSync(swSrc, swDest);
    console.log('Copied: webqx-sw.js');
}

// No mock or patch injection

// Skip demo-oriented README in production build

// Copy portal dist output if built, but place at root (unified SPA)
const portalDist = path.join(__dirname, '..', 'portal', 'dist');
if (fs.existsSync(portalDist)) {
    // Copy all portal build artifacts into root dist (overwriting any existing index.html with SPA version)
    copyDirectoryRecursive(portalDist, distDir);
    console.log('Unified: portal dist merged into dist/ root');

    // Backwards compatibility: create /portal/ redirect that points to root index with hash
    const legacyPortalDir = path.join(distDir, 'portal');
    if (!fs.existsSync(legacyPortalDir)) fs.mkdirSync(legacyPortalDir, { recursive: true });
    const redirectHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta http-equiv="refresh" content="0; url=../index.html#portal"/><title>Redirecting…</title><script>window.location.replace('../index.html#'+(window.location.hash?window.location.hash.substring(1):'portal'));</script><style>body{font-family:system-ui,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f7fb;color:#334155}</style></head><body><p>Redirecting to unified portal…</p></body></html>`;
    fs.writeFileSync(path.join(legacyPortalDir, 'index.html'), redirectHtml);
    fs.writeFileSync(path.join(legacyPortalDir, '404.html'), redirectHtml);
    console.log('Created legacy /portal redirect (index.html & 404.html)');

    // Inject runtime scripts into SPA index.html
    const spaIndex = path.join(distDir, 'index.html');
    if (fs.existsSync(spaIndex)) {
        let html = fs.readFileSync(spaIndex, 'utf8');
        if (html.includes('</head>')) {
            const ver = (process.env.GITHUB_SHA ? process.env.GITHUB_SHA.substring(0, 8) : Date.now().toString());
            const ensure = (snippet) => { if (!html.includes(snippet)) { html = html.replace('</head>', snippet + '\n</head>'); } };
            // Copy proxy helper into dist if available
            const proxySrc = path.join(__dirname, '..', 'integrations', 'pages-spa-api-proxy.js');
            if (fs.existsSync(proxySrc)) {
                fs.copyFileSync(proxySrc, path.join(distDir, 'pages-spa-api-proxy.js'));
            }
            // Ensure tags (idempotent)
            if (USING_RUNTIME_CONFIG) ensure(`  <script src="./runtime-config.js?v=${ver}"></script>`);
            ensure(`  <script src="./webqx-remote-config.js?v=${ver}"></script>`);
            ensure(`  <script src="./pages-spa-api-proxy.js?v=${ver}"></script>`);
            const marker = '<!-- webqx-runtime-injected -->';
            if (!html.includes(marker)) {
                html = html.replace('</head>', '  ' + marker + '\n</head>');
            }
            fs.writeFileSync(spaIndex, html);
            console.log('Ensured runtime config scripts are present in SPA index.html');
        }
    }
}

// Ensure top-level favicons exist at dist/ for GitHub Pages (/EMR/favicon.*)
try {
    const portalPublic = path.join(__dirname, '..', 'portal', 'public');
    const candidates = [
        { name: 'favicon.svg', type: 'image/svg+xml' },
        { name: 'favicon.ico', type: 'image/x-icon' }
    ];
    candidates.forEach(({ name }) => {
        const src = path.join(portalPublic, name);
        const dest = path.join(distDir, name);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`Copied favicon: ${name}`);
        }
    });
} catch (e) {
    console.warn('Favicons copy step failed:', e.message);
}

// Create .nojekyll file to ensure GitHub Pages serves all files
fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
console.log('Created: .nojekyll');

// Create SPA 404 fallback to support deep links under GitHub Pages (/EMR/whatever -> index.html)
try {
    const indexPath = path.join(distDir, 'index.html');
    const fallbackPath = path.join(distDir, '404.html');
    if (fs.existsSync(indexPath) && !fs.existsSync(fallbackPath)) {
        const indexHtml = fs.readFileSync(indexPath);
        fs.writeFileSync(fallbackPath, indexHtml);
        console.log('Created: 404.html SPA fallback');
    }
} catch (e) {
    console.warn('Could not create 404.html fallback:', e.message);
}

console.log('\\nBuild complete! The static site is ready in the dist/ directory.');
console.log('You can now commit and push to trigger GitHub Pages deployment (production-only).');
