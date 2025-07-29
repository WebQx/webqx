const fs = require('fs');
const path = require('path');

describe('WordPress readme.txt files', () => {
  const themeReadmePath = path.join(__dirname, '../../wordpress-theme/readme.txt');
  const pluginReadmePath = path.join(__dirname, '../../wordpress-plugin/readme.txt');

  test('WordPress theme readme.txt should exist and contain required metadata', () => {
    expect(fs.existsSync(themeReadmePath)).toBe(true);
    
    const content = fs.readFileSync(themeReadmePath, 'utf8');
    
    // Check for required WordPress theme metadata
    expect(content).toMatch(/=== WebQx Theme ===/);
    expect(content).toMatch(/Version: 1\.0\.0/);
    expect(content).toMatch(/Requires at least: 5\.8/);
    expect(content).toMatch(/Tested up to: 6\.2/);
    expect(content).toMatch(/Requires PHP: 7\.4/);
    expect(content).toMatch(/Author: WebQx/);
    expect(content).toMatch(/Author URI: https:\/\/github\.com\/WebQx/);
    expect(content).toMatch(/Theme URI: https:\/\/github\.com\/WebQx\/webqx/);
    expect(content).toMatch(/GitHub Theme URI: https:\/\/github\.com\/WebQx\/webqx/);
    
    // Check for standard WordPress readme sections
    expect(content).toMatch(/== Description ==/);
    expect(content).toMatch(/== Installation ==/);
    expect(content).toMatch(/== Changelog ==/);
  });

  test('WordPress plugin readme.txt should exist and contain required metadata', () => {
    expect(fs.existsSync(pluginReadmePath)).toBe(true);
    
    const content = fs.readFileSync(pluginReadmePath, 'utf8');
    
    // Check for required WordPress plugin metadata
    expect(content).toMatch(/=== WebQx Plugin ===/);
    expect(content).toMatch(/Version: 1\.0\.0/);
    expect(content).toMatch(/Requires at least: 5\.8/);
    expect(content).toMatch(/Tested up to: 6\.2/);
    expect(content).toMatch(/Requires PHP: 7\.4/);
    expect(content).toMatch(/Author: WebQx/);
    expect(content).toMatch(/Author URI: https:\/\/github\.com\/WebQx/);
    expect(content).toMatch(/Plugin URI: https:\/\/github\.com\/WebQx\/webqx/);
    expect(content).toMatch(/GitHub Plugin URI: https:\/\/github\.com\/WebQx\/webqx/);
    
    // Check for standard WordPress readme sections
    expect(content).toMatch(/== Description ==/);
    expect(content).toMatch(/== Installation ==/);
    expect(content).toMatch(/== Changelog ==/);
    expect(content).toMatch(/== Frequently Asked Questions ==/);
  });

  test('readme files should contain healthcare-specific content', () => {
    const themeContent = fs.readFileSync(themeReadmePath, 'utf8');
    const pluginContent = fs.readFileSync(pluginReadmePath, 'utf8');
    
    // Check for healthcare-related keywords in theme
    expect(themeContent).toMatch(/healthcare/i);
    expect(themeContent).toMatch(/WebQx/);
    expect(themeContent).toMatch(/HIPAA/);
    
    // Check for healthcare-related keywords in plugin
    expect(pluginContent).toMatch(/healthcare/i);
    expect(pluginContent).toMatch(/WebQx/);
    expect(pluginContent).toMatch(/FHIR/);
    expect(pluginContent).toMatch(/patient portal/i);
    expect(pluginContent).toMatch(/HIPAA/);
  });
});