#!/usr/bin/env python3
"""
Automated Merge Conflict Resolution Script for WebQx Repository
===============================================================

This script handles merge conflicts according to the following rules:
1. Always prefer changes from the 'main' branch by default
2. Always preserve README.md from the source branch during conflicts
3. For JSON/config files, intelligently merge configurations by retaining unique keys from both branches
"""

import os
import sys
import json
import subprocess
import re
from typing import Dict, Any, List, Optional


class ConflictResolver:
    def __init__(self):
        self.repo_root = self._get_repo_root()
        self.conflicts = []
        
    def _get_repo_root(self) -> str:
        """Get the root directory of the git repository."""
        try:
            result = subprocess.run(
                ['git', 'rev-parse', '--show-toplevel'],
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError:
            raise RuntimeError("Not in a git repository")
    
    def _run_git_command(self, cmd: List[str]) -> subprocess.CompletedProcess:
        """Run a git command and return the result."""
        return subprocess.run(cmd, capture_output=True, text=True, cwd=self.repo_root)
    
    def detect_conflicts(self) -> List[str]:
        """Detect files with merge conflicts."""
        result = self._run_git_command(['git', 'diff', '--name-only', '--diff-filter=U'])
        if result.returncode == 0:
            conflicts = [f.strip() for f in result.stdout.split('\n') if f.strip()]
            self.conflicts = conflicts
            return conflicts
        return []
    
    def get_conflict_content(self, filepath: str) -> str:
        """Get the content of a file with merge conflicts."""
        full_path = os.path.join(self.repo_root, filepath)
        with open(full_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def resolve_readme_conflict(self, filepath: str) -> bool:
        """Resolve README.md conflicts by preserving source branch content."""
        if not filepath.lower().endswith('readme.md'):
            return False
            
        print(f"Resolving README.md conflict: {filepath}")
        
        # During a merge, we want to preserve the feature branch version
        # Get the merge head (MERGE_HEAD) which is the incoming branch
        result = self._run_git_command(['git', 'show', 'MERGE_HEAD:' + filepath])
        if result.returncode == 0:
            source_content = result.stdout
            full_path = os.path.join(self.repo_root, filepath)
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(source_content)
            
            # Stage the resolved file
            self._run_git_command(['git', 'add', filepath])
            print(f"✓ Preserved README.md from source branch: {filepath}")
            return True
        
        return False
    
    def resolve_json_conflict(self, filepath: str) -> bool:
        """Intelligently merge JSON/config files by retaining unique keys from both branches."""
        if not (filepath.endswith('.json') or 'config' in filepath.lower()):
            return False
            
        print(f"Resolving JSON/config conflict: {filepath}")
        
        try:
            # Get content from both branches
            # main is the current branch, MERGE_HEAD is the incoming branch
            main_result = self._run_git_command(['git', 'show', f'HEAD:{filepath}'])
            head_result = self._run_git_command(['git', 'show', f'MERGE_HEAD:{filepath}'])
            
            if main_result.returncode != 0 or head_result.returncode != 0:
                return False
            
            # Parse JSON from both branches
            main_data = json.loads(main_result.stdout)
            head_data = json.loads(head_result.stdout)
            
            # Merge intelligently - start with main branch data
            merged_data = main_data.copy() if isinstance(main_data, dict) else main_data
            
            # If both are dictionaries, merge keys
            if isinstance(main_data, dict) and isinstance(head_data, dict):
                # Add unique keys from head that don't exist in main
                for key, value in head_data.items():
                    if key not in main_data:
                        merged_data[key] = value
                    elif isinstance(main_data[key], dict) and isinstance(value, dict):
                        # Recursively merge nested objects
                        merged_data[key] = self._merge_dict_recursive(main_data[key], value)
            
            # Write merged content
            full_path = os.path.join(self.repo_root, filepath)
            with open(full_path, 'w', encoding='utf-8') as f:
                json.dump(merged_data, f, indent=2, ensure_ascii=False)
                f.write('\n')  # Add trailing newline
            
            # Stage the resolved file
            self._run_git_command(['git', 'add', filepath])
            print(f"✓ Intelligently merged JSON/config file: {filepath}")
            return True
            
        except (json.JSONDecodeError, Exception) as e:
            print(f"✗ Failed to merge JSON file {filepath}: {e}")
            return False
    
    def _merge_dict_recursive(self, dict1: Dict[str, Any], dict2: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively merge two dictionaries, preferring dict1 for conflicts."""
        result = dict1.copy()
        for key, value in dict2.items():
            if key not in result:
                result[key] = value
            elif isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._merge_dict_recursive(result[key], value)
        return result
    
    def resolve_default_conflict(self, filepath: str) -> bool:
        """Resolve conflicts by preferring main branch changes."""
        print(f"Resolving conflict using main branch preference: {filepath}")
        
        # Get main branch version (current HEAD during merge)
        result = self._run_git_command(['git', 'show', f'HEAD:{filepath}'])
        if result.returncode == 0:
            main_content = result.stdout
            full_path = os.path.join(self.repo_root, filepath)
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(main_content)
            
            # Stage the resolved file
            self._run_git_command(['git', 'add', filepath])
            print(f"✓ Resolved using main branch content: {filepath}")
            return True
        
        return False
    
    def resolve_all_conflicts(self) -> bool:
        """Resolve all detected conflicts according to the rules."""
        conflicts = self.detect_conflicts()
        
        if not conflicts:
            print("No merge conflicts detected.")
            return True
        
        print(f"Found {len(conflicts)} conflict(s) to resolve:")
        for conflict in conflicts:
            print(f"  - {conflict}")
        
        resolved_count = 0
        
        for filepath in conflicts:
            resolved = False
            
            # Rule 2: Always preserve README.md from source branch
            if filepath.lower().endswith('readme.md'):
                resolved = self.resolve_readme_conflict(filepath)
            
            # Rule 3: Intelligently merge JSON/config files
            elif filepath.endswith('.json') or 'config' in filepath.lower():
                resolved = self.resolve_json_conflict(filepath)
            
            # Rule 1: Default - prefer main branch
            if not resolved:
                resolved = self.resolve_default_conflict(filepath)
            
            if resolved:
                resolved_count += 1
            else:
                print(f"✗ Failed to resolve conflict: {filepath}")
        
        print(f"\nResolved {resolved_count}/{len(conflicts)} conflicts.")
        return resolved_count == len(conflicts)
    
    def commit_resolution(self, message: str = "Auto-resolve merge conflicts") -> bool:
        """Commit the resolved changes."""
        # Check if there are staged changes
        result = self._run_git_command(['git', 'diff', '--cached', '--name-only'])
        if not result.stdout.strip():
            print("No changes to commit.")
            return True
        
        # Commit the changes
        commit_result = self._run_git_command(['git', 'commit', '-m', message])
        if commit_result.returncode == 0:
            print(f"✓ Committed resolved conflicts: {message}")
            return True
        else:
            print(f"✗ Failed to commit: {commit_result.stderr}")
            return False


def main():
    """Main function to run the conflict resolution process."""
    print("WebQx Automated Conflict Resolution")
    print("===================================")
    
    try:
        resolver = ConflictResolver()
        
        # Resolve conflicts
        success = resolver.resolve_all_conflicts()
        
        if success:
            # Commit the resolution
            resolver.commit_resolution("Auto-resolve merge conflicts following WebQx rules")
            print("\n✓ All conflicts resolved successfully!")
            sys.exit(0)
        else:
            print("\n✗ Some conflicts could not be resolved automatically.")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n✗ Error during conflict resolution: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()