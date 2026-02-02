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

					addCustomPrecompile: (precompile) =>
						Effect.sync(() => evmInstance.addCustomPrecompile(precompile)),

					removeCustomPrecompile: (precompile) =>
						Effect.sync(() => evmInstance.removeCustomPrecompile(precompile)),

					deepCopy: () =>
						Effect.gen(function* () {
							// Deep copy requires copying the stateManager and blockchain
							// Then creating a new EVM with the copied instances
							const stateManagerCopy = yield* Effect.tryPromise({
								try: () => evmInstance.stateManager.deepCopy(),
								catch: (e) => mapEvmError(e),
							})
							const blockchainCopy = yield* Effect.tryPromise({
								try: () => evmInstance.blockchain.deepCopy(),
								catch: (e) => mapEvmError(e),
							})
							const evmCopy = yield* Effect.tryPromise({
								try: () =>
									createEvm({
										common: commonShape.common,
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

					shallowCopy: () => {
						// shallowCopy uses the underlying EVM's shallowCopy method
						// Note: the shallow copy shares the same stateManager and blockchain
						const evmCopy = /** @type {import('@tevm/evm').Evm} */ (evmInstance.shallowCopy())
						// Bind custom precompile methods that Tevm adds
						evmCopy.addCustomPrecompile = evmInstance.addCustomPrecompile.bind(evmCopy)
						evmCopy.removeCustomPrecompile = evmInstance.removeCustomPrecompile.bind(evmCopy)
						return createShape(evmCopy)
					},
				}
				return shape
			}

			return createShape(evm)
		}),
	)
}
