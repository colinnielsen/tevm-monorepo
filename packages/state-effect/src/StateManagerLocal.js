import { Effect, Layer } from 'effect'
import { createStateManager } from '@tevm/state'
import { CommonService } from '@tevm/common-effect'
import { NodeNotReadyError } from '@tevm/errors-effect'
import { StateManagerService } from './StateManagerService.js'
import { createStateManagerShape } from './wrapStateManager.js'

/**
 * @module @tevm/state-effect/StateManagerLocal
 * @description Layer that creates StateManagerService for local (non-fork) mode
 */

/**
 * @typedef {import('./types.js').StateManagerShape} StateManagerShape
 * @typedef {import('./types.js').StateManagerLocalOptions} StateManagerLocalOptions
 */

/**
 * Creates a StateManagerService layer for local (non-fork) mode.
 *
 * This layer creates a state manager that starts from empty state without forking
 * from any remote network. It's suitable for:
 * - Local development and testing
 * - Deterministic test environments
 * - Scenarios that don't require existing mainnet state
 *
 * The layer requires CommonService to be provided for chain configuration.
 *
 * @example
 * ```javascript
 * import { Effect, Layer } from 'effect'
 * import { StateManagerService, StateManagerLocal } from '@tevm/state-effect'
 * import { CommonLocal } from '@tevm/common-effect'
 *
 * const program = Effect.gen(function* () {
 *   const stateManager = yield* StateManagerService
 *   yield* stateManager.ready
 *
 *   const stateRoot = yield* stateManager.getStateRoot()
 *   console.log('State root:', stateRoot)
 * })
 *
 * // Run with local state manager
 * const layer = Layer.provide(StateManagerLocal(), CommonLocal)
 * Effect.runPromise(program.pipe(Effect.provide(layer)))
 * ```
 *
 * @example
 * ```javascript
 * // With checkpoint/commit pattern - now accepts hex string addresses directly!
 * const program = Effect.gen(function* () {
 *   const stateManager = yield* StateManagerService
 *   yield* stateManager.ready
 *
 *   // Create checkpoint for atomic operations
 *   yield* stateManager.checkpoint()
 *
 *   // Pass address as hex string - conversion is handled internally
 *   const address = '0x1234567890123456789012345678901234567890'
 *   const slot = new Uint8Array(32)
 *   const value = new Uint8Array([1, 2, 3, 4])
 *
 *   yield* stateManager.putStorage(address, slot, value)
 *   yield* stateManager.commit()
 * })
 * ```
 *
 * @param {StateManagerLocalOptions} [options] - Configuration options
 * @returns {Layer.Layer<StateManagerService, never, CommonService>} Layer providing StateManagerService
 */
export const StateManagerLocal = (options = {}) => {
	return Layer.effect(
		StateManagerService,
		Effect.gen(function* () {
			// CommonService is available but we don't strictly need it for local mode
			// We yield it anyway to ensure consistent API with fork mode
			yield* CommonService

			const stateManager = createStateManager({
				loggingLevel: options.loggingEnabled ? 'debug' : 'warn',
			})

			// Wait for the state manager to be ready
			yield* Effect.tryPromise({
				try: () => stateManager.ready(),
				catch: (error) =>
					new NodeNotReadyError({
						message: `Failed to initialize state manager`,
						cause: /** @type {Error} */ (error),
					}),
			})

			// Use the shared createStateManagerShape factory to avoid code duplication
			// and ensure consistent behavior between StateManagerLocal and other implementations
			return createStateManagerShape(stateManager)
		}),
	)
}
