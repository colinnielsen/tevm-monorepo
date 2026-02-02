import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		coverage: {
			include: ['src/**/*.js'],
			exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/index.js', 'src/**/types.js', 'src/**/*Shape.js'],
			reporter: ['text', 'json-summary', 'json'],
			thresholds: {
				lines: 100,
				functions: 90, // The createEvm catch callback in deepCopy is defensive code that's difficult to trigger
				branches: 100,
				statements: 100,
			},
		},
	},
})
