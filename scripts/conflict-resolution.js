#!/usr/bin/env node
/**
 * Automated Merge Conflict Resolution Script for WebQx Repository (Node.js)
 * ==========================================================================
 * 
 * This script handles merge conflicts according to the following rules:
 * 1. Always prefer changes from the 'main' branch by default
 * 2. Always preserve README.md from the source branch during conflicts
 * 3. For JSON/config files, intelligently merge configurations by retaining unique keys from both branches
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ConflictResolver {
    constructor() {
        this.repoRoot = this.getRepoRoot();
        this.conflicts = [];
    }

    getRepoRoot() {
        try {
            const result = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' });
            return result.trim();
        } catch (error) {
            throw new Error('Not in a git repository');
        }
    }

    runGitCommand(cmd) {
        try {
            const result = execSync(cmd, { 
                encoding: 'utf8', 
                cwd: this.repoRoot,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            return { stdout: result, stderr: '', returnCode: 0 };
        } catch (error) {
            return { 
                stdout: error.stdout || '', 
                stderr: error.stderr || '', 
                returnCode: error.status || 1 
            };
        }
    }

    detectConflicts() {
        const result = this.runGitCommand('git diff --name-only --diff-filter=U');
        if (result.returnCode === 0) {
            const conflicts = result.stdout
                .split('\n')
                .map(f => f.trim())
                .filter(f => f.length > 0);
            this.conflicts = conflicts;
            return conflicts;
        }
        return [];
    }

    getConflictContent(filepath) {
        const fullPath = path.join(this.repoRoot, filepath);
        return fs.readFileSync(fullPath, 'utf8');
    }

    resolveReadmeConflict(filepath) {
        if (!filepath.toLowerCase().endsWith('readme.md')) {
            return false;
        }

        console.log(`Resolving README.md conflict: ${filepath}`);

        // During a merge, we want to preserve the feature branch version
        // Get the merge head (MERGE_HEAD) which is the incoming branch
        const result = this.runGitCommand(`git show MERGE_HEAD:${filepath}`);
        if (result.returnCode === 0) {
            const sourceContent = result.stdout;
            const fullPath = path.join(this.repoRoot, filepath);
            fs.writeFileSync(fullPath, sourceContent, 'utf8');

            // Stage the resolved file
            this.runGitCommand(`git add ${filepath}`);
            console.log(`✓ Preserved README.md from source branch: ${filepath}`);
            return true;
        }

        return false;
    }

    resolveJsonConflict(filepath) {
        if (!(filepath.endsWith('.json') || filepath.toLowerCase().includes('config'))) {
            return false;
        }

        console.log(`Resolving JSON/config conflict: ${filepath}`);

        try {
            // Get content from both branches
            // HEAD is the current branch, MERGE_HEAD is the incoming branch
            const mainResult = this.runGitCommand(`git show HEAD:${filepath}`);
            const headResult = this.runGitCommand(`git show MERGE_HEAD:${filepath}`);

            if (mainResult.returnCode !== 0 || headResult.returnCode !== 0) {
                return false;
            }

            // Parse JSON from both branches
            const mainData = JSON.parse(mainResult.stdout);
            const headData = JSON.parse(headResult.stdout);

            // Merge intelligently - start with main branch data
            let mergedData = Array.isArray(mainData) ? [...mainData] : { ...mainData };

            // If both are objects, merge keys
            if (typeof mainData === 'object' && !Array.isArray(mainData) && 
                typeof headData === 'object' && !Array.isArray(headData)) {
                
                // Add unique keys from head that don't exist in main
                for (const [key, value] of Object.entries(headData)) {
                    if (!(key in mainData)) {
                        mergedData[key] = value;
                    } else if (typeof mainData[key] === 'object' && !Array.isArray(mainData[key]) &&
                               typeof value === 'object' && !Array.isArray(value)) {
                        // Recursively merge nested objects
                        mergedData[key] = this.mergeDictRecursive(mainData[key], value);
                    }
                }
            }

            // Write merged content
            const fullPath = path.join(this.repoRoot, filepath);
            fs.writeFileSync(fullPath, JSON.stringify(mergedData, null, 2) + '\n', 'utf8');

            // Stage the resolved file
            this.runGitCommand(`git add ${filepath}`);
            console.log(`✓ Intelligently merged JSON/config file: ${filepath}`);
            return true;

        } catch (error) {
            console.log(`✗ Failed to merge JSON file ${filepath}: ${error.message}`);
            return false;
        }
    }

    mergeDictRecursive(dict1, dict2) {
        const result = { ...dict1 };
        for (const [key, value] of Object.entries(dict2)) {
            if (!(key in result)) {
                result[key] = value;
            } else if (typeof result[key] === 'object' && !Array.isArray(result[key]) &&
                       typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.mergeDictRecursive(result[key], value);
            }
        }
        return result;
    }

    resolveDefaultConflict(filepath) {
        console.log(`Resolving conflict using main branch preference: ${filepath}`);

        // Get main branch version (current HEAD during merge)
        const result = this.runGitCommand(`git show HEAD:${filepath}`);
        if (result.returnCode === 0) {
            const mainContent = result.stdout;
            const fullPath = path.join(this.repoRoot, filepath);
            fs.writeFileSync(fullPath, mainContent, 'utf8');

            // Stage the resolved file
            this.runGitCommand(`git add ${filepath}`);
            console.log(`✓ Resolved using main branch content: ${filepath}`);
            return true;
        }

        return false;
    }

    resolveAllConflicts() {
        const conflicts = this.detectConflicts();

        if (conflicts.length === 0) {
            console.log('No merge conflicts detected.');
            return true;
        }

        console.log(`Found ${conflicts.length} conflict(s) to resolve:`);
        conflicts.forEach(conflict => console.log(`  - ${conflict}`));

        let resolvedCount = 0;

        for (const filepath of conflicts) {
            let resolved = false;

            // Rule 2: Always preserve README.md from source branch
            if (filepath.toLowerCase().endsWith('readme.md')) {
                resolved = this.resolveReadmeConflict(filepath);
            }

            // Rule 3: Intelligently merge JSON/config files
            if (!resolved && (filepath.endsWith('.json') || filepath.toLowerCase().includes('config'))) {
                resolved = this.resolveJsonConflict(filepath);
            }

            // Rule 1: Default - prefer main branch
            if (!resolved) {
                resolved = this.resolveDefaultConflict(filepath);
            }

            if (resolved) {
                resolvedCount++;
            } else {
                console.log(`✗ Failed to resolve conflict: ${filepath}`);
            }
        }

        console.log(`\nResolved ${resolvedCount}/${conflicts.length} conflicts.`);
        return resolvedCount === conflicts.length;
    }

    commitResolution(message = 'Auto-resolve merge conflicts') {
        // Check if there are staged changes
        const result = this.runGitCommand('git diff --cached --name-only');
        if (!result.stdout.trim()) {
            console.log('No changes to commit.');
            return true;
        }

        // Commit the changes
        const commitResult = this.runGitCommand(`git commit -m "${message}"`);
        if (commitResult.returnCode === 0) {
            console.log(`✓ Committed resolved conflicts: ${message}`);
            return true;
        } else {
            console.log(`✗ Failed to commit: ${commitResult.stderr}`);
            return false;
        }
    }
}

function main() {
    console.log('WebQx Automated Conflict Resolution (Node.js)');
    console.log('=============================================');

    try {
        const resolver = new ConflictResolver();

        // Resolve conflicts
        const success = resolver.resolveAllConflicts();

        if (success) {
            // Commit the resolution
            resolver.commitResolution('Auto-resolve merge conflicts following WebQx rules');
            console.log('\n✓ All conflicts resolved successfully!');
            process.exit(0);
        } else {
            console.log('\n✗ Some conflicts could not be resolved automatically.');
            process.exit(1);
        }

    } catch (error) {
        console.log(`\n✗ Error during conflict resolution: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = ConflictResolver;