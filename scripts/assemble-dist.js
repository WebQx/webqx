#!/usr/bin/env node
/*
 * assemble-dist.js
 * Unified artifact builder for GitHub Pages deployment.
 * Mirrors logic previously embedded in deploy.yml.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dist = path.join(root, 'dist');

function log(msg) { console.log(`[assemble-dist] ${msg}`); }

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

function start() {
  log('Building unified dist artifact');
  if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true, force: true });
  ensureDir(dist);

  // Root & shared files
  ['index.html', 'index-github-pages.html', 'sw.js', 'webqx-remote-config.js'].forEach(f => {
    if (fs.existsSync(f)) {
      copyRecursive(path.join(root, f), path.join(dist, f));
    }
  });

  // Directories
  ['assets', 'integrations'].forEach(dir => {
    if (fs.existsSync(dir)) copyRecursive(dir, path.join(dist, dir));
  });

  // Feature modules / static sections
  const sections = ['provider', 'patient-portal', 'admin-console', 'auth', 'modules', 'telehealth'];
  sections.forEach(sec => {
    if (fs.existsSync(sec)) copyRecursive(sec, path.join(dist, sec));
  });

  // Patient portal (Parcel)
  if (fs.existsSync('patient-portal/dist')) {
    copyRecursive('patient-portal/dist', path.join(dist, 'patient-portal'));
  }

  // Vite portal output
  if (fs.existsSync('portal/dist')) {
    // Copy both under /portal for GH Pages compatibility and into root for Railway serving
    copyRecursive('portal/dist', path.join(dist, 'portal'));
    // Root SPA: copy index.html and assets to root so / loads the app on Railway
    copyRecursive('portal/dist/index.html', path.join(dist, 'index.html'));
    ['assets','css','js'].forEach(folder => {
      const src = path.join('portal/dist', folder);
      if (fs.existsSync(src)) {
        copyRecursive(src, path.join(dist, folder));
      }
    });
  } else if (fs.existsSync('public/portal')) { // fallback
    copyRecursive('public/portal', path.join(dist, 'portal'));
  }
  // Extra portal static pages (404 etc.)
  if (fs.existsSync('portal/src/404.html')) {
    copyRecursive('portal/src/404.html', path.join(dist, 'portal', '404.html'));
  }

  // .nojekyll (avoid Jekyll processing edge cases)
  fs.writeFileSync(path.join(dist, '.nojekyll'), '');

  // Ensure favicons exist at root for hosting (align with build-pages.js behavior)
  try {
    const portalPublic = path.join(root, 'portal', 'public');
    const candidates = ['favicon.svg', 'favicon.ico'];
    for (const name of candidates) {
      const src = path.join(portalPublic, name);
      const dest = path.join(dist, name);
      if (fs.existsSync(src)) copyRecursive(src, dest);
    }
  } catch (e) {
    log('Favicons copy step skipped: ' + e.message);
  }

  // Cache-busting stamp
  const indexPath = path.join(dist, 'index.html');
  if (fs.existsSync(indexPath)) {
    fs.appendFileSync(indexPath, `\n<!-- build-sha: ${process.env.GITHUB_SHA || 'local'} -->\n`);
  }

  log('Dist assembly complete');
  // Basic listing
  const files = [];
  function collect(p){
    if (files.length > 300) return;
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(p)) collect(path.join(p, entry));
    } else {
      files.push(path.relative(dist, p));
    }
  }
  collect(dist);
  log('Sample files:');
  files.slice(0, 40).forEach(f => log('  ' + f));
}

start();
