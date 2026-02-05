import { Effect, Layer } from 'effect'
import { createEvm } from '@tevm/evm'
import { CommonService } from '@tevm/common-effect'
import { StateManagerService } from '@tevm/state-effect'
import { BlockchainService } from '@tevm/blockchain-effect'
import { EvmService } from './EvmService.js'
import { mapEvmError } from './mapEvmError.js'

/**
 * @module @tevm/evm-effect/EvmLive
 * @description Layer that creates EvmService
 */

/**
 * @typedef {import('./types.js').EvmShape} EvmShape
 * @typedef {import('./types.js').EvmLiveOptions} EvmLiveOptions
 */

/**
 * Creates an EvmService layer.
 *
 * This layer creates an EVM instance using the provided CommonService,
 * StateManagerService, and BlockchainService dependencies.
 *
 * @example
 * ```javascript
 * import { Effect, Layer } from 'effect'
 * import { EvmService, EvmLive } from '@tevm/evm-effect'
 * import { StateManagerLocal } from '@tevm/state-effect'
 * import { BlockchainLocal } from '@tevm/blockchain-effect'
 * import { CommonLocal } from '@tevm/common-effect'
 *
 * const program = Effect.gen(function* () {
 *   const evmService = yield* EvmService
 *
 *   const result = yield* evmService.runCall({
 *     to: address,
 *     data: calldata,
 *     gasLimit: 1000000n
 *   })
 *   console.log('Result:', result)
 * })
 *
 * // Build the layer stack
 * const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
 * const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
 * const evmLayer = Layer.provide(
 *   EvmLive(),
 *   Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal)
 * )
 *
 * Effect.runPromise(program.pipe(Effect.provide(evmLayer)))
 * ```
 *
 * @example
 * ```javascript
 * // With custom precompiles
 * const layer = EvmLive({
 *   customPrecompiles: [myPrecompile],
 *   allowUnlimitedContractSize: true,
 *   profiler: true,
 *   loggingEnabled: true
 * })
 * ```
 *
 * @param {EvmLiveOptions} [options] - Configuration options
 * @returns {Layer.Layer<import('./EvmService.js').EvmServiceId, import('./types.js').EvmError, CommonService | StateManagerService | BlockchainService>} Layer providing EvmService
 */
export const EvmLive = (options = {}) => {
	return Layer.effect(
		EvmService,
		Effect.gen(function* () {
			const commonShape = yield* CommonService
			const stateManagerShape = yield* StateManagerService
			const blockchainShape = yield* BlockchainService

			const evm = yield* Effect.tryPromise({
				try: () =>
					createEvm({
						common: commonShape.common,
						stateManager: stateManagerShape.stateManager,
						blockchain: blockchainShape.chain,
						allowUnlimitedContractSize: options.allowUnlimitedContractSize ?? false,
						customPrecompiles: options.customPrecompiles ?? [],
						profiler: options.profiler ?? false,
						loggingLevel: options.loggingEnabled ? 'debug' : 'fatal',
					}),
				catch: (e) => mapEvmError(e),
			})

			/**
			 * Helper to create EvmShape from an evm instance.
			 * Uses closure over commonShape and options for deep copy operations.
			 * @param {import('@tevm/evm').Evm} evmInstance
			 * @returns {EvmShape}
			 */
			const createShape = (evmInstance) => {
				/** @type {EvmShape} */
				const shape = {
					evm: evmInstance,

					runCall: (opts) =>
						Effect.tryPromise({
							try: () => evmInstance.runCall(opts),
							catch: (e) => mapEvmError(e),
						}),

					runCode: (opts) =>
						Effect.tryPromise({
							try: () => evmInstance.runCode(opts),
							catch: (e) => mapEvmError(e),
						}),

					getActivePrecompiles: () => Effect.sync(() => evmInstance.precompiles),

					// #R140-P2-003 fix: Use Effect.try instead of Effect.sync since precompile operations can throw
					addCustomPrecompile: (precompile) =>
						Effect.try({
							try: () => evmInstance.addCustomPrecompile(precompile),
							catch: (e) => mapEvmError(e),
						}),

					// #R140-P2-003 fix: Use Effect.try instead of Effect.sync since precompile operations can throw
					removeCustomPrecompile: (precompile) =>
						Effect.try({
							try: () => evmInstance.removeCustomPrecompile(precompile),
							catch: (e) => mapEvmError(e),
						}),

					deepCopy: () =>
						Effect.gen(function* () {
							// Deep copy requires copying the stateManager and blockchain
							// Then creating a new EVM with the copied instances
							// Note: Using type casts because deepCopy is not on the TS interfaces but exists at runtime
							const stateManagerCopy = yield* Effect.tryPromise({
								try: () => /** @type {any} */ (evmInstance.stateManager).deepCopy(),
								catch: (e) => mapEvmError(e),
							})
							const blockchainCopy = yield* Effect.tryPromise({
								try: () => /** @type {any} */ (evmInstance.blockchain).deepCopy(),
								catch: (e) => mapEvmError(e),
							})
							const evmCopy = yield* Effect.tryPromise({
								try: () =>
									createEvm({
										common: commonShape.common.copy(), // Deep copy Common to avoid shared mutable state (#R130-P2-004)
										stateManager: stateManagerCopy,
										blockchain: blockchainCopy,
										allowUnlimitedContractSize: evmInstance.allowUnlimitedContractSize ?? false,
										customPrecompiles: /** @type {any} */ (evmInstance)._customPrecompiles ?? [],
										profiler:
											Boolean(/** @type {any} */ (evmInstance).optsCached?.profiler?.enabled),
										loggingLevel: options.loggingEnabled ? 'debug' : 'fatal',
									}),
								catch: (e) => mapEvmError(e),
							})
							// Copy DEBUG state for logging
							const evmAny = /** @type {any} */ (evmCopy)
							evmAny.DEBUG = evmInstance.DEBUG
							evmAny._debug = /** @type {any} */ (evmInstance)._debug
							return createShape(evmCopy)
						}),

					// #R140-P2-007 fix: Wrap shallowCopy in Effect.try for consistent error handling
					shallowCopy: () =>
						Effect.try({
							try: () => {
								// shallowCopy uses the underlying EVM's shallowCopy method
								// Note: the shallow copy shares the same stateManager and blockchain
								const evmCopy = /** @type {import('@tevm/evm').Evm} */ (evmInstance.shallowCopy())
								// #R149-P2-001 fix: Don't rebind methods from source instance to avoid state corruption
								// The shallowCopy already creates its own properly bound methods
								// Previously we were binding evmInstance methods to evmCopy which could
								// cause state corruption if methods had closure references to evmInstance state
								// #R150-P2-003 fix: Removed fallback wrapper functions that were still calling
								// evmInstance.addCustomPrecompile/removeCustomPrecompile - these wrappers
								// called the original instance's methods, causing state mutations to affect
								// evmInstance instead of evmCopy. The shallowCopy() from @tevm/evm should
								// produce a properly configured copy with all necessary methods.
								return createShape(evmCopy)
							},
							catch: (e) => mapEvmError(e),
						}),
				}
				return shape
			}

			return createShape(evm)
		}),
	)
}
