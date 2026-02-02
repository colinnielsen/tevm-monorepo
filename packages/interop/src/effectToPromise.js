import { Effect, Runtime } from 'effect'

/**
 * Convert an Effect program to a Promise.
 *
 * Use this at the boundary when calling Effect code from Promise-based code.
 * This is useful during migration when you have Effect-based internal code
 * but need to maintain Promise-based public APIs.
 *
 * **Type-Safe Runtime Requirements:**
 *
 * This function uses TypeScript overloads to enforce type safety:
 * - Effects with no requirements (`Effect<A, E, never>`) can use the default runtime
 * - Effects with requirements (`Effect<A, E, R>`) MUST provide a compatible runtime
 *
 * ```typescript
 * // ✅ Effect with no requirements - default runtime works
 * const simple = Effect.succeed(42)
 * await effectToPromise(simple)
 *
 * // ✅ Effect with requirements - must provide runtime
 * const withService: Effect<string, never, FooService> = ...
 * const runtime = await ManagedRuntime.make(FooServiceLive).runtime()
 * await effectToPromise(withService, runtime)
 *
 * // ✅ Provide dependencies before converting
 * const satisfied = withService.pipe(Effect.provide(FooServiceLive))
 * await effectToPromise(satisfied) // R is now never
 * ```
 *
 * @example
 * ```typescript
 * import { effectToPromise } from '@tevm/interop'
 * import { Effect } from 'effect'
 *
 * // Simple case: Effect with no requirements
 * const effect = Effect.succeed(42)
 *
 * // Convert to Promise for use in Promise-based code
 * const result = await effectToPromise(effect)
 * console.log(result) // 42
 * ```
 *
 * @example
 * ```typescript
 * // With custom runtime for Effects with requirements
 * import { effectToPromise } from '@tevm/interop'
 * import { Effect, Layer, ManagedRuntime, Context } from 'effect'
 *
 * // Define a service
 * class MyService extends Context.Tag('MyService')<MyService, { getValue: () => string }>() {}
 * const MyServiceLive = Layer.succeed(MyService, { getValue: () => 'hello' })
 *
 * // Effect that requires MyService
 * const program = Effect.gen(function* () {
 *   const svc = yield* MyService
 *   return svc.getValue()
 * })
 *
 * // Create runtime with the service
 * const managedRuntime = ManagedRuntime.make(MyServiceLive)
 * const result = await effectToPromise(program, await managedRuntime.runtime())
 * console.log(result) // 'hello'
 * ```
 */

/**
 * Overload 1: Effect with no requirements - runtime is optional (uses default)
 * @template A - The success type of the Effect
 * @template E - The error type of the Effect
 * @param {Effect.Effect<A, E, never>} effect - The Effect to convert (must have no requirements)
 * @param {Runtime.Runtime<never>} [runtime] - Optional runtime (defaults to defaultRuntime)
 * @returns {Promise<A>} A Promise that resolves with the Effect's success value
 * @throws {TypeError} If effect parameter is null or undefined
 * @overload
 */

/**
 * Overload 2: Effect with requirements - runtime is required
 * @template A - The success type of the Effect
 * @template E - The error type of the Effect
 * @template R - The requirements type of the Effect
 * @param {Effect.Effect<A, E, R>} effect - The Effect to convert
 * @param {Runtime.Runtime<R>} runtime - Runtime that satisfies the Effect's requirements (REQUIRED)
 * @returns {Promise<A>} A Promise that resolves with the Effect's success value
 * @throws {TypeError} If effect parameter is null or undefined
 * @overload
 */

/**
 * Implementation signature
 * @template A - The success type of the Effect
 * @template E - The error type of the Effect
 * @template R - The requirements type of the Effect
 * @param {Effect.Effect<A, E, R>} effect - The Effect to convert
 * @param {Runtime.Runtime<R>} [runtime] - Runtime to use
 * @returns {Promise<A>} A Promise that resolves with the Effect's success value
 */
export const effectToPromise = (effect, runtime) => {
	if (effect === null || effect === undefined) {
		return Promise.reject(new TypeError('effectToPromise: effect parameter is required and cannot be null or undefined'))
	}
	// Type-safe design: TypeScript overloads ensure runtime is required when Effect has requirements.
	// In JavaScript without type checking, missing runtime for Effects with requirements will cause
	// a runtime error when the Effect accesses missing services.
	//
	// Note: We use defaultRuntime (which has empty context) when runtime is not provided.
	// This works for Effects with R=never but will fail for Effects that require services.
	// The overloads above enforce type safety, but JavaScript users must ensure they
	// provide a runtime for Effects with requirements.
	const actualRuntime = runtime !== undefined ? runtime : Runtime.defaultRuntime
	return Runtime.runPromise(actualRuntime)(effect).catch((error) => {
		// Provide a more helpful error message for service access errors when no runtime was provided
		if (runtime === undefined && error && typeof error.message === 'string') {
			// Check for common Effect service-related error patterns
			const isServiceError = error.message.includes('Service not found') ||
				error.message.includes('is not available') ||
				error._tag === 'ServiceNotFoundError'
			if (isServiceError) {
				const enhancedError = new Error(
					`effectToPromise: Effect failed accessing a service. ` +
					`If your Effect has requirements (R ≠ never), you must provide a runtime that satisfies them. ` +
					`Original error: ${error.message}`
				)
				enhancedError.cause = error
				throw enhancedError
			}
		}
		throw error
	})
}
