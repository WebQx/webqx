#!/usr/bin/env python3
"""
Test script for the automated merge conflict resolution system.
This script creates mock conflict scenarios and tests the resolution logic.
"""

import os
import sys
import json
import tempfile
import subprocess
import shutil
import importlib.util
from pathlib import Path

# Add the scripts directory to the path
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))

# Import the ConflictResolver class
import importlib.util
spec = importlib.util.spec_from_file_location("conflict_resolution", script_dir / "conflict-resolution.py")
conflict_resolution_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(conflict_resolution_module)
ConflictResolver = conflict_resolution_module.ConflictResolver

class ConflictResolverTester:
    def __init__(self):
        self.test_repo = None
        self.original_cwd = os.getcwd()
    
    def setup_test_repo(self):
        """Create a temporary git repository for testing."""
        self.test_repo = tempfile.mkdtemp(prefix='webqx_conflict_test_')
        os.chdir(self.test_repo)
        
        # Initialize git repo
        subprocess.run(['git', 'init'], check=True, capture_output=True)
        subprocess.run(['git', 'config', 'user.email', 'test@webqx.health'], check=True)
        subprocess.run(['git', 'config', 'user.name', 'Test User'], check=True)
        
        # Create initial commit on main
        self.create_file('README.md', '# WebQx Test Repository\n\nInitial content from main branch.')
        self.create_file('package.json', json.dumps({
            "name": "webqx-test",
            "version": "1.0.0",
            "main": "index.js",
            "dependencies": {
                "express": "^4.18.0"
            }
        }, indent=2))
        self.create_file('config.json', json.dumps({
            "app": {
                "name": "WebQx",
                "port": 3000
            },
            "database": {
                "host": "localhost",
                "port": 5432
            }
        }, indent=2))
        
        subprocess.run(['git', 'add', '.'], check=True)
        subprocess.run(['git', 'commit', '-m', 'Initial commit'], check=True)
        
        # Create main branch explicitly
        subprocess.run(['git', 'branch', '-M', 'main'], check=True)
    
    def create_file(self, filename, content):
        """Create a file with the given content."""
        with open(filename, 'w') as f:
            f.write(content)
    
    def create_conflict_scenario(self):
        """Create a conflict scenario with different changes on main and feature branch."""
        # Create and switch to feature branch
        subprocess.run(['git', 'checkout', '-b', 'feature-branch'], check=True)
        
        # Make changes on feature branch
        self.create_file('README.md', '# WebQx Test Repository\n\nFeature branch content - should be preserved!')
        self.create_file('package.json', json.dumps({
            "name": "webqx-test",
            "version": "1.1.0",  # Version bump
            "main": "index.js",
            "dependencies": {
                "express": "^4.18.0"
            },
            "scripts": {  # New scripts section
                "start": "node index.js",
                "test": "jest"
            }
        }, indent=2))
        self.create_file('config.json', json.dumps({
            "app": {
                "name": "WebQx",
                "port": 3000,
                "debug": True  # New debug setting
            },
            "database": {
                "host": "localhost",
                "port": 5432
            },
            "features": {  # New features section
                "logging": True,
                "monitoring": False
            }
        }, indent=2))
        
        subprocess.run(['git', 'add', '.'], check=True)
        subprocess.run(['git', 'commit', '-m', 'Feature branch changes'], check=True)
        
        # Switch back to main and make conflicting changes
        subprocess.run(['git', 'checkout', 'main'], check=True)
        
        self.create_file('README.md', '# WebQx Test Repository\n\nMain branch content - should NOT be preserved!')
        self.create_file('package.json', json.dumps({
            "name": "webqx-test",
            "version": "1.0.1",  # Different version bump
            "main": "index.js",
            "dependencies": {
                "express": "^4.18.0",
                "cors": "^2.8.5"  # New dependency
            },
            "engines": {  # New engines section
                "node": ">=16.0.0"
            }
        }, indent=2))
        self.create_file('config.json', json.dumps({
            "app": {
                "name": "WebQx Production",  # Different name
                "port": 8080  # Different port
            },
            "database": {
                "host": "prod-db.webqx.health",  # Different host
                "port": 5432,
                "ssl": True  # New ssl setting
            }
        }, indent=2))
        
        subprocess.run(['git', 'add', '.'], check=True)
        subprocess.run(['git', 'commit', '-m', 'Main branch changes'], check=True)
        
        # Try to merge feature branch - this should create conflicts
        result = subprocess.run(['git', 'merge', 'feature-branch'], capture_output=True, text=True)
        return result.returncode != 0  # Returns True if conflicts occurred
    
    def test_conflict_resolution(self):
        """Test the conflict resolution functionality."""
        print("Testing WebQx Conflict Resolution System")
        print("=" * 50)
        
        # Setup test environment
        print("Setting up test repository...")
        self.setup_test_repo()
        
        # Create conflict scenario
        print("Creating conflict scenario...")
        conflicts_created = self.create_conflict_scenario()
        
        if not conflicts_created:
            print("❌ Failed to create conflicts for testing")
            return False
        
        print("✓ Conflicts created successfully")
        
        # Test conflict detection
        resolver = ConflictResolver()
        conflicts = resolver.detect_conflicts()
        
        print(f"Detected {len(conflicts)} conflicts:")
        for conflict in conflicts:
            print(f"  - {conflict}")
        
        expected_conflicts = ['README.md', 'package.json', 'config.json']
        if not all(conflict in conflicts for conflict in expected_conflicts):
            print("❌ Not all expected conflicts were detected")
            return False
        
        print("✓ All expected conflicts detected")
        
        # Test conflict resolution
        print("\nResolving conflicts...")
        success = resolver.resolve_all_conflicts()
        
        if not success:
            print("❌ Conflict resolution failed")
            return False
        
        print("✓ All conflicts resolved")
        
        # Verify resolution results
        print("\nVerifying resolution results...")
        
        # Check README.md was preserved from feature branch
        with open('README.md', 'r') as f:
            readme_content = f.read()
        
        if 'Feature branch content - should be preserved!' not in readme_content:
            print("❌ README.md was not preserved from feature branch")
            return False
        
        print("✓ README.md correctly preserved from source branch")
        
        # Check package.json was intelligently merged
        with open('package.json', 'r') as f:
            package_data = json.load(f)
        
        # Should have main branch base but also feature branch additions
        expected_keys = ['scripts', 'engines', 'cors']  # Some from each branch
        
        if 'scripts' not in package_data:  # From feature branch
            print("❌ package.json missing scripts from feature branch")
            return False
        
        if 'engines' not in package_data:  # From main branch
            print("❌ package.json missing engines from main branch")
            return False
        
        print("✓ package.json intelligently merged")
        
        # Check config.json was intelligently merged
        with open('config.json', 'r') as f:
            config_data = json.load(f)
        
        # Should have main branch base but also feature branch additions
        if 'features' not in config_data:  # From feature branch
            print("❌ config.json missing features from feature branch")
            return False
        
        if config_data['database'].get('ssl') is not True:  # From main branch
            print("❌ config.json missing ssl setting from main branch")
            return False
        
        print("✓ config.json intelligently merged")
        
        # Complete the merge
        resolver.commit_resolution("Test: Auto-resolved conflicts")
        
        print("\n✅ All tests passed successfully!")
        return True
    
    def cleanup(self):
        """Clean up test environment."""
        os.chdir(self.original_cwd)
        if self.test_repo and os.path.exists(self.test_repo):
            shutil.rmtree(self.test_repo)

def main():
    """Run the conflict resolution tests."""
    tester = ConflictResolverTester()
    
    try:
        success = tester.test_conflict_resolution()
        exit_code = 0 if success else 1
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        exit_code = 1
    finally:
        tester.cleanup()
    
    sys.exit(exit_code)

if __name__ == "__main__":
    main()