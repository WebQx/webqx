#!/bin/bash

# WordPress Plugin Deployment Script for WebQX Healthcare Platform
# This script creates a clean WordPress plugin package for distribution

set -e

PLUGIN_NAME="webqx-healthcare-platform"
VERSION="1.0.0"
BUILD_DIR="wordpress-plugin-build"

echo "🚀 Building WordPress Plugin Package for WebQX Healthcare Platform v${VERSION}"

# Clean previous build
if [ -d "$BUILD_DIR" ]; then
    echo "🧹 Cleaning previous build..."
    rm -rf "$BUILD_DIR"
fi

# Create build directory
mkdir -p "$BUILD_DIR/$PLUGIN_NAME"

echo "📦 Copying WordPress plugin files..."

# Core WordPress plugin files
cp webqx-healthcare-platform.php "$BUILD_DIR/$PLUGIN_NAME/"
cp readme.txt "$BUILD_DIR/$PLUGIN_NAME/"
cp uninstall.php "$BUILD_DIR/$PLUGIN_NAME/"
cp LICENSE.md "$BUILD_DIR/$PLUGIN_NAME/"
cp INSTALLATION.md "$BUILD_DIR/$PLUGIN_NAME/"

# Admin files
mkdir -p "$BUILD_DIR/$PLUGIN_NAME/admin"
cp -r admin/* "$BUILD_DIR/$PLUGIN_NAME/admin/"

# Templates
mkdir -p "$BUILD_DIR/$PLUGIN_NAME/templates"
cp -r templates/* "$BUILD_DIR/$PLUGIN_NAME/templates/"

# Assets
mkdir -p "$BUILD_DIR/$PLUGIN_NAME/assets"
cp -r assets/* "$BUILD_DIR/$PLUGIN_NAME/assets/"

# Create languages directory for i18n
mkdir -p "$BUILD_DIR/$PLUGIN_NAME/languages"

# Create a plugin-specific readme for distribution
cat > "$BUILD_DIR/$PLUGIN_NAME/README.md" << EOF
# WebQX Healthcare Platform WordPress Plugin

This is the WordPress plugin component of the WebQX Healthcare Platform. 

## Quick Start

1. Install this plugin in your WordPress site
2. Set up the WebQX Node.js backend (see INSTALLATION.md)
3. Configure the plugin settings in WordPress Admin
4. Add shortcodes to your pages

## Documentation

- [Complete Installation Guide](INSTALLATION.md)
- [WordPress.org Plugin Page](https://wordpress.org/plugins/webqx-healthcare-platform/)
- [Main WebQX Repository](https://github.com/WebQx/webqx)

## Support

For support, please visit the WordPress.org plugin forum or the GitHub repository.

---

**License:** Apache 2.0 (GPL Compatible)  
**Version:** $VERSION
EOF

# Create composer.json for WordPress plugin directory compatibility
cat > "$BUILD_DIR/$PLUGIN_NAME/composer.json" << EOF
{
  "name": "webqx/healthcare-platform-wordpress",
  "description": "WordPress plugin for WebQX Healthcare Platform integration",
  "type": "wordpress-plugin",
  "license": "Apache-2.0",
  "version": "$VERSION",
  "authors": [
    {
      "name": "WebQX Health",
      "homepage": "https://webqx.health"
    }
  ],
  "require": {
    "php": ">=7.4",
    "wordpress": ">=5.0"
  },
  "keywords": [
    "wordpress",
    "plugin", 
    "healthcare",
    "medical",
    "fhir",
    "telehealth",
    "patient-portal"
  ],
  "homepage": "https://github.com/WebQx/webqx"
}
EOF

# Create WordPress-specific plugin headers file
cat > "$BUILD_DIR/$PLUGIN_NAME/plugin-info.json" << EOF
{
  "name": "WebQX Healthcare Platform",
  "version": "$VERSION",
  "description": "Comprehensive modular healthcare platform with patient portals, provider dashboards, telehealth, and FHIR-compliant EHR integrations.",
  "author": "WebQX Health",
  "author_uri": "https://webqx.health",
  "plugin_uri": "https://github.com/WebQx/webqx",
  "requires_wp": "5.0",
  "tested_wp": "6.4",
  "requires_php": "7.4",
  "license": "Apache-2.0",
  "license_uri": "http://www.apache.org/licenses/LICENSE-2.0",
  "text_domain": "webqx-healthcare",
  "domain_path": "/languages",
  "network": false,
  "tags": [
    "healthcare",
    "medical", 
    "patient-portal",
    "telehealth",
    "fhir",
    "ehr",
    "health-records",
    "appointments",
    "telemedicine"
  ]
}
EOF

# Remove any development files that shouldn't be in distribution
echo "🧹 Cleaning development files from build..."

# Remove any temporary or development files
find "$BUILD_DIR/$PLUGIN_NAME" -name "*.tmp" -delete 2>/dev/null || true
find "$BUILD_DIR/$PLUGIN_NAME" -name ".DS_Store" -delete 2>/dev/null || true
find "$BUILD_DIR/$PLUGIN_NAME" -name "Thumbs.db" -delete 2>/dev/null || true

# Set proper permissions
echo "🔒 Setting file permissions..."
find "$BUILD_DIR/$PLUGIN_NAME" -type f -exec chmod 644 {} \;
find "$BUILD_DIR/$PLUGIN_NAME" -type d -exec chmod 755 {} \;

# Create ZIP package for WordPress.org submission
cd "$BUILD_DIR"
echo "📦 Creating ZIP package..."
zip -r "${PLUGIN_NAME}-${VERSION}.zip" "$PLUGIN_NAME" -q

cd ..
mv "$BUILD_DIR/${PLUGIN_NAME}-${VERSION}.zip" "./"

echo "✅ WordPress plugin package created successfully!"
echo ""
echo "📋 Package Contents:"
echo "   - Plugin files: ./${PLUGIN_NAME}-${VERSION}.zip"
echo "   - Build directory: ./$BUILD_DIR/$PLUGIN_NAME/"
echo ""
echo "🚀 Next Steps:"
echo "   1. Test the plugin in a WordPress environment"
echo "   2. Upload to WordPress.org plugin directory"
echo "   3. Distribute to users"
echo ""
echo "📚 Documentation:"
echo "   - Installation: INSTALLATION.md"
echo "   - WordPress readme: readme.txt"
echo "   - Main repository: https://github.com/WebQx/webqx"

# Show package size
if command -v du >/dev/null 2>&1; then
    PACKAGE_SIZE=$(du -h "${PLUGIN_NAME}-${VERSION}.zip" | cut -f1)
    echo "   - Package size: ${PACKAGE_SIZE}"
fi

echo ""
echo "🎉 WebQX Healthcare Platform WordPress Plugin v${VERSION} is ready for deployment!"