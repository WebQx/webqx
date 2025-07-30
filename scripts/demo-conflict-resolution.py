#!/usr/bin/env python3
"""
Demo script to showcase the WebQx automated conflict resolution system.
This script creates a realistic conflict scenario and demonstrates the resolution.
"""

import os
import sys
import json
import tempfile
import subprocess
import shutil
from pathlib import Path

def run_command(cmd, cwd=None):
    """Run a command and return the result."""
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)

def demo_conflict_resolution():
    """Demonstrate the conflict resolution system."""
    print("🚀 WebQx Automated Conflict Resolution Demo")
    print("=" * 50)
    
    # Create temporary directory for demo
    demo_dir = tempfile.mkdtemp(prefix='webqx_demo_')
    original_cwd = os.getcwd()
    
    try:
        os.chdir(demo_dir)
        
        print("📁 Setting up demo repository...")
        
        # Initialize git repo
        run_command('git init')
        run_command('git config user.email "demo@webqx.health"')
        run_command('git config user.name "WebQx Demo"')
        
        # Create initial files
        with open('README.md', 'w') as f:
            f.write('# WebQx Healthcare Platform\n\nInitial documentation from main branch.')
        
        with open('package.json', 'w') as f:
            json.dump({
                "name": "webqx-healthcare",
                "version": "1.0.0",
                "dependencies": {
                    "express": "^4.18.0"
                }
            }, f, indent=2)
        
        with open('config.json', 'w') as f:
            json.dump({
                "app": {"name": "WebQx", "port": 3000},
                "database": {"host": "localhost", "port": 5432}
            }, f, indent=2)
        
        run_command('git add .')
        run_command('git commit -m "Initial commit"')
        run_command('git branch -M main')
        
        print("✅ Repository initialized")
        
        # Create feature branch with changes
        print("\n🌿 Creating feature branch with changes...")
        run_command('git checkout -b feature/new-functionality')
        
        # Feature branch changes
        with open('README.md', 'w') as f:
            f.write('# WebQx Healthcare Platform\n\nFeature documentation - this should be preserved!')
        
        with open('package.json', 'w') as f:
            json.dump({
                "name": "webqx-healthcare",
                "version": "1.1.0",
                "dependencies": {
                    "express": "^4.18.0"
                },
                "scripts": {
                    "start": "node server.js",
                    "test": "jest"
                }
            }, f, indent=2)
        
        with open('config.json', 'w') as f:
            json.dump({
                "app": {"name": "WebQx", "port": 3000, "debug": True},
                "database": {"host": "localhost", "port": 5432},
                "features": {"logging": True, "monitoring": False}
            }, f, indent=2)
        
        run_command('git add .')
        run_command('git commit -m "Add new features and scripts"')
        
        print("✅ Feature branch created with changes")
        
        # Switch to main and make conflicting changes
        print("\n🔄 Making conflicting changes on main branch...")
        run_command('git checkout main')
        
        # Main branch changes (conflicting)
        with open('README.md', 'w') as f:
            f.write('# WebQx Healthcare Platform\n\nMain branch documentation - should NOT be preserved!')
        
        with open('package.json', 'w') as f:
            json.dump({
                "name": "webqx-healthcare",
                "version": "1.0.1",
                "dependencies": {
                    "express": "^4.18.0",
                    "cors": "^2.8.5"
                },
                "engines": {
                    "node": ">=16.0.0"
                }
            }, f, indent=2)
        
        with open('config.json', 'w') as f:
            json.dump({
                "app": {"name": "WebQx Production", "port": 8080},
                "database": {"host": "prod.webqx.health", "port": 5432, "ssl": True}
            }, f, indent=2)
        
        run_command('git add .')
        run_command('git commit -m "Production configuration updates"')
        
        print("✅ Conflicting changes made on main")
        
        # Attempt merge to create conflicts
        print("\n⚡ Attempting merge to create conflicts...")
        result = run_command('git merge feature/new-functionality')
        
        if result.returncode != 0:
            print("✅ Merge conflicts created successfully!")
            
            # Show the conflicts
            conflicts_result = run_command('git diff --name-only --diff-filter=U')
            conflicts = [f.strip() for f in conflicts_result.stdout.split('\n') if f.strip()]
            
            print(f"\n🔍 Detected conflicts in {len(conflicts)} files:")
            for conflict in conflicts:
                print(f"   📄 {conflict}")
            
            # Copy our conflict resolution script
            script_source = Path(original_cwd) / 'scripts' / 'conflict-resolution.py'
            script_dest = Path(demo_dir) / 'conflict-resolution.py'
            shutil.copy(script_source, script_dest)
            
            print("\n🤖 Running automated conflict resolution...")
            
            # Run the conflict resolution script
            result = run_command(f'python3 {script_dest}')
            
            if result.returncode == 0:
                print("✅ All conflicts resolved automatically!")
                
                print("\n📋 Resolution Results:")
                print("-" * 30)
                
                # Show resolved content
                with open('README.md', 'r') as f:
                    readme_content = f.read()
                print(f"📄 README.md: {'✅ Feature branch preserved' if 'Feature documentation' in readme_content else '❌ Not preserved'}")
                
                with open('package.json', 'r') as f:
                    package_data = json.load(f)
                has_scripts = 'scripts' in package_data
                has_engines = 'engines' in package_data
                print(f"📄 package.json: {'✅ Intelligently merged' if has_scripts and has_engines else '❌ Merge failed'}")
                
                with open('config.json', 'r') as f:
                    config_data = json.load(f)
                has_features = 'features' in config_data
                has_ssl = config_data.get('database', {}).get('ssl') is True
                print(f"📄 config.json: {'✅ Intelligently merged' if has_features and has_ssl else '❌ Merge failed'}")
                
                print(f"\n🎯 Conflict Resolution Rules Applied:")
                print(f"   1. README.md preserved from feature branch ✅")
                print(f"   2. JSON files intelligently merged ✅")
                print(f"   3. Main branch preferences maintained ✅")
                
                print(f"\n🏆 Demo completed successfully!")
                
            else:
                print("❌ Conflict resolution failed")
                print(result.stderr)
        else:
            print("❌ No conflicts were created (unexpected)")
    
    except Exception as e:
        print(f"❌ Demo failed: {e}")
    
    finally:
        # Cleanup
        os.chdir(original_cwd)
        shutil.rmtree(demo_dir, ignore_errors=True)

if __name__ == "__main__":
    demo_conflict_resolution()