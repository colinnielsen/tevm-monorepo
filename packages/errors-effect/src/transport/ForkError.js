import { Data } from 'effect'

/**
 * TaggedError representing a fork transport error.
 *
 * This error occurs when attempting to fetch a resource from a forked transport
 * fails, such as network issues, timeouts, or JSON-RPC errors.
 *
 * @example
 * ```typescript
 * import { ForkError } from '@tevm/errors-effect'
 * import { Effect } from 'effect'
 *
 * const program = Effect.gen(function* () {
 *   yield* Effect.fail(new ForkError({
 *     method: 'eth_getBalance',
 *     cause: new Error('Network timeout')
 *   }))
 * })
 *
 * // Pattern matching
 * Effect.catchTag('ForkError', (error) => {
 *   console.log(`Fork request failed for ${error.method}: ${error.cause}`)
 * })
 * ```
 */
export class ForkError extends Data.TaggedError('ForkError') {
	/**
	 * JSON-RPC error code for fork errors.
	 * Uses -32604 (resource not found) as default.
	 * @type {number}
	 */
	static code = -32604

	/**
	 * Path to documentation for this error
	 * @type {string}
	 */
	static docsPath = '/reference/tevm/errors/classes/forkerror/'

	/**
	 * Safely extract error code from a cause object.
	 * This method provides explicit type guards to handle various cause structures
	 * without silent failures if the cause shape changes (#R127-P1-001 fix).
	 *
	 * @param {unknown} cause - The underlying cause of the error
	 * @returns {number} The extracted code or the default ForkError.code
	 */
	static extractCodeFromCause(cause) {
		// Guard 1: cause must exist
		if (cause === null || cause === undefined) {
			return ForkError.code
		}
		// Guard 2: cause must be an object
		if (typeof cause !== 'object') {
			return ForkError.code
		}
		// Guard 3: cause must have a 'code' property
		if (!('code' in cause)) {
			return ForkError.code
		}
		// Guard 4: code must be a number
		const causeCode = /** @type {{ code: unknown }} */ (cause).code
		if (typeof causeCode !== 'number') {
			return ForkError.code
		}
		return causeCode
	}

	/**
	 * The JSON-RPC method that was being called when the error occurred
	 * @readonly
	 * @type {string | undefined}
	 */
	method

	/**
	 * Human-readable error message
	 * @override
	 * @readonly
	 * @type {string}
	 */
	message

	/**
	 * JSON-RPC error code
	 * @readonly
	 * @type {number}
	 */
	code

	/**
	 * Path to documentation
	 * @readonly
	 * @type {string}
	 */
	docsPath

	/**
	 * The underlying cause of this error.
	 * Typically contains the original JSON-RPC error or network error.
	 * @override
	 * @readonly
	 * @type {unknown}
	 */
	cause

	/**
	 * Constructs a new ForkError
	 * @param {Object} props - Error properties
	 * @param {string} [props.method] - The JSON-RPC method that failed
	 * @param {string} [props.message] - Optional custom message
	 * @param {unknown} [props.cause] - The underlying cause of this error
	 */
	constructor(props = {}) {
		// Compute all properties BEFORE calling super()
		const name = 'ForkError'
		const method = props.method
		const cause = props.cause
		const message =
			props.message ??
			(props.method !== undefined
				? `Fork request failed for method '${props.method}'`
				: 'Fork request failed')
		// Extract code from cause safely with explicit type guards (#R127-P1-001 fix)
		// This pattern handles various cause structures without silent failures
		const code = ForkError.extractCodeFromCause(props.cause)
		const docsPath = ForkError.docsPath

		// Pass all properties to super() for Effect.ts equality and hashing
		super({ name, method, cause, message, code, docsPath })

		/** @override @type {string} */
		this.name = name
		this.method = method
		this.cause = cause
		this.message = message
		this.code = code
		this.docsPath = docsPath
		// NOTE: Object.freeze is NOT used because Effect.ts requires objects to be extensible
		// for its Equal.equals and Hash.hash trait implementations (Symbol-based caching).
		// Properties are marked @readonly in JSDoc for documentation purposes.
	}
}
