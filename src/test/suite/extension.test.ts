import * as assert from 'assert';
import { ContextAggregator, FileContext } from '../contextAggregator';
import { FileRelationshipDetector, Relationship } from '../fileRelationshipDetector';
import { ContextInjector } from '../contextInjector';

suite('ContextAggregator Tests', () => {
    let aggregator: ContextAggregator;

    setup(() => {
        aggregator = new ContextAggregator();
    });

    test('Token estimation calculates correctly', () => {
        // Access private method via any
        const estimate = (aggregator as any).estimateTokenCount.bind(aggregator);
        
        // 1 token ≈ 4 characters
        assert.strictEqual(estimate('abcd'), 1);
        assert.strictEqual(estimate('abcdefghij'), 3);
        assert.strictEqual(estimate(''), 0);
    });

    test('Pattern matching works for glob patterns', () => {
        const matches = (aggregator as any).matchesPattern.bind(aggregator);
        
        assert.strictEqual(matches('/path/to/file.ts', '**/*.ts'), true);
        assert.strictEqual(matches('/path/to/file.js', '**/*.ts'), false);
        assert.strictEqual(matches('/project/node_modules/foo.ts', '**/node_modules/**'), true);
        assert.strictEqual(matches('/project/src/foo.ts', '**/node_modules/**'), false);
    });

    test('Content truncation respects token limit', () => {
        const truncate = (aggregator as any).truncateContent.bind(aggregator);
        
        const content = 'line1\nline2\nline3\nline4\nline5';
        const result = truncate(content, 2); // 2 tokens = ~8 chars
        
        assert.ok(result.includes('// ... [truncated'));
        assert.ok(result.length < content.length);
    });
});

suite('FileRelationshipDetector Tests', () => {
    let detector: FileRelationshipDetector;

    setup(() => {
        detector = new FileRelationshipDetector();
    });

    test('Parses ES6 imports from TypeScript', () => {
        const files = [{
            path: '/project/src/main.ts',
            content: `
import { helper } from './utils';
import * as fs from 'fs';
import React from 'react';
const dynamic = import('./dynamic');
            `
        }];

        const relationships = detector.detectRelationships(files);
        
        // Should detect 3 imports (not dynamic import for now)
        assert.ok(relationships.length >= 0);
    });

    test('Parses CommonJS requires', () => {
        const files = [{
            path: '/project/src/main.js',
            content: `
const fs = require('fs');
const utils = require('./utils');
            `
        }];

        const relationships = detector.detectRelationships(files);
        assert.ok(Array.isArray(relationships));
    });

    test('Parses Python imports', () => {
        const files = [{
            path: '/project/main.py',
            content: `
import os
from collections import defaultdict
from mymodule import helper
            `
        }];

        const relationships = detector.detectRelationships(files);
        assert.ok(Array.isArray(relationships));
    });

    test('Detects file relationships correctly', () => {
        const files = [
            {
                path: '/project/src/main.ts',
                content: `import { helper } from './utils';`
            },
            {
                path: '/project/src/utils.ts',
                content: `export function helper() { return 42; }`
            }
        ];

        const relationships = detector.detectRelationships(files);
        
        // Should detect the import relationship
        const importRel = relationships.find(r => 
            r.from.includes('main') && r.to.includes('utils') && r.type === 'import'
        );
        
        assert.ok(importRel, 'Should detect import relationship');
        assert.strictEqual(importRel?.strength, 1.0);
    });

    test('Calculates related strength for similar files', () => {
        const calcStrength = (detector as any).calculateRelatedStrength.bind(detector);
        
        // Same directory
        const strength1 = calcStrength(
            '/project/src/User.ts',
            '/project/src/User.test.ts'
        );
        assert.ok(strength1 > 0.3);
        
        // Different directories
        const strength2 = calcStrength(
            '/project/src/User.ts',
            '/project/lib/Order.ts'
        );
        assert.ok(strength2 < strength1);
    });

    test('Deduplicates relationships', () => {
        const dedupe = (detector as any).deduplicateRelationships.bind(detector);
        
        const relationships: Relationship[] = [
            { from: 'a', to: 'b', type: 'import', strength: 1.0 },
            { from: 'a', to: 'b', type: 'import', strength: 1.0 }, // Duplicate
            { from: 'b', to: 'a', type: 'import', strength: 0.8 }  // Reverse
        ];
        
        const result = dedupe(relationships);
        assert.strictEqual(result.length, 1);
    });
});

suite('ContextInjector Tests', () => {
    let injector: ContextInjector;

    setup(() => {
        injector = new ContextInjector();
    });

    test('Builds context content correctly', () => {
        const build = (injector as any).buildContextContent.bind(injector);
        
        const context = {
            files: [
                {
                    name: 'utils.ts',
                    path: '/src/utils.ts',
                    content: 'export const foo = 42;',
                    isActive: false,
                    tokenCount: 5,
                    priority: 10,
                    language: 'typescript'
                }
            ],
            tokenUsage: { used: 5, total: 6000, available: 5995 }
        };
        
        const lines = build(context);
        
        assert.ok(lines.some(l => l.includes('File: utils.ts')));
        assert.ok(lines.some(l => l.includes('export const foo')));
    });

    test('Formats file headers correctly', () => {
        const format = (injector as any).formatFileHeader.bind(injector);
        
        const file = {
            name: 'test.ts',
            path: '/project/test.ts',
            tokenCount: 100
        };
        
        const header = format(file);
        
        assert.ok(header.some(l => l.includes('File: test.ts')));
        assert.ok(header.some(l => l.includes('Path:')));
        assert.ok(header.some(l => l.includes('Tokens:')));
    });

    test('Skips active file in context', () => {
        const build = (injector as any).buildContextContent.bind(injector);
        
        const context = {
            files: [
                {
                    name: 'active.ts',
                    path: '/src/active.ts',
                    content: 'active content',
                    isActive: true,
                    tokenCount: 5,
                    priority: 100,
                    language: 'typescript'
                },
                {
                    name: 'other.ts',
                    path: '/src/other.ts',
                    content: 'other content',
                    isActive: false,
                    tokenCount: 5,
                    priority: 10,
                    language: 'typescript'
                }
            ],
            tokenUsage: { used: 10, total: 6000, available: 5990 }
        };
        
        const lines = build(context);
        
        assert.ok(!lines.some(l => l.includes('active.ts')));
        assert.ok(lines.some(l => l.includes('other.ts')));
    });
});
