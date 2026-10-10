import { createRequire } from 'node:module';
import common from 'eslint-config-neon/flat/common.js';
import node from 'eslint-config-neon/flat/node.js';
import prettier from 'eslint-config-neon/flat/prettier.js';
import typescript from 'eslint-config-neon/flat/typescript.js';
import merge from 'lodash.merge';

const commonFiles = '{js,mjs,cjs,ts,mts,cts,jsx,tsx}';

// The resolver is only installed nested under eslint-config-neon, where eslint-plugin-import cannot find it by
// name. Installing it at the root drags in a peer conflict on eslint-plugin-import-x, so point at it by path.
const typescriptResolver = createRequire(
	createRequire(import.meta.url).resolve('eslint-config-neon/package.json'),
).resolve('eslint-import-resolver-typescript');

const commonRuleset = merge(...common, { files: [`**/*${commonFiles}`] });

const nodeRuleset = merge(...node, { files: [`**/*${commonFiles}`] });

const typeScriptRuleset = merge(...typescript, {
	files: [`**/*${commonFiles}`],
	languageOptions: {
		parserOptions: {
			warnOnUnsupportedTypeScriptVersion: false,
			allowAutomaticSingleRunInference: true,
			project: ['tsconfig.eslint.json'],
		},
	},
	rules: {
		'@typescript-eslint/consistent-type-definitions': [2, 'interface'],
		'@typescript-eslint/dot-notation': 0,
		'import/order': [
			1,
			{
				alphabetize: {
					caseInsensitive: false,
					order: 'asc',
				},
				groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
				'newlines-between': 'never',
			},
		],
		'n/no-sync': 1,
	},
});

typeScriptRuleset.settings['import/resolver'] = {
	[typescriptResolver]: {
		project: ['tsconfig.eslint.json'],
	},
};

const prettierRuleset = merge(...prettier, { files: [`**/*${commonFiles}`] });

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
	{
		ignores: ['**/node_modules/', '.git/', '**/dist/', '**/coverage/'],
	},
	commonRuleset,
	nodeRuleset,
	typeScriptRuleset,
	{
		files: ['**/*{ts,mts,cts,tsx}'],
		rules: {
			'jsdoc/no-undefined-types': 0,
			'n/no-sync': 0,
		},
	},
	prettierRuleset,
];
