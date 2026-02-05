import { Effect, Layer } from 'effect'
import { createCommon, tevmDefault } from '@tevm/common'
import { ForkConfigService } from '@tevm/transport-effect'
import { InternalError } from '@tevm/errors-effect'
import { CommonService } from './CommonService.js'

/**
 * @module @tevm/common-effect/CommonFromFork
 * @description Layer that creates CommonService from ForkConfigService
 */

/**
 * @typedef {import('./types.js').CommonShape} CommonShape
 * @typedef {import('./types.js').Hardfork} Hardfork
 * @typedef {import('./types.js').LogLevel} LogLevel
 */

/**
 * Configuration options for CommonFromFork layer
 * @typedef {Object} CommonFromForkOptions
 * @property {Hardfork} [hardfork] - Hardfork to use (default: 'prague')
 * @property {readonly number[]} [eips] - Additional EIPs to enable
 * @property {LogLevel} [loggingLevel] - Logging level (default: 'warn')
 */

/**
 * Creates a CommonService layer that auto-detects chain configuration from ForkConfigService.
 *
 * This layer is used when forking from a remote RPC endpoint. It reads the chain ID
 * from the ForkConfigService (which typically fetches it via `eth_chainId`) and
 * creates a Common object configured for that chain.
 *
 * The layer requires ForkConfigService to be provided, which in turn typically
 * requires TransportService (via ForkConfigFromRpc).
 *
 * @example
 * ```javascript
 * import { Effect, Layer } from 'effect'
 * import { HttpTransport, ForkConfigFromRpc } from '@tevm/transport-effect'
 * import { CommonService, CommonFromFork } from '@tevm/common-effect'
 *
 * const program = Effect.gen(function* () {
 *   const common = yield* CommonService
 *   console.log('Forking chain:', common.chainId)
 *   console.log('Hardfork:', common.hardfork)
 * })
 *
 * // Build the layer stack
 * const transportLayer = HttpTransport({ url: 'https://mainnet.optimism.io' })
 * const forkConfigLayer = Layer.provide(ForkConfigFromRpc, transportLayer)
 * const commonLayer = Layer.provide(CommonFromFork(), forkConfigLayer)
 *
 * // Merge all layers and run
 * const fullLayer = Layer.mergeAll(transportLayer, forkConfigLayer, commonLayer)
 * Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
 * ```
 *
 * @example
 * ```javascript
 * // With custom hardfork and EIPs
 * const commonLayer = Layer.provide(
 *   CommonFromFork({ hardfork: 'cancun', eips: [7702] }),
 *   forkConfigLayer
 * )
 * ```
 *
 * @param {CommonFromForkOptions} [options] - Configuration options
 * @returns {Layer.Layer<CommonService, InternalError, ForkConfigService>} Layer providing CommonService
 */
export const CommonFromFork = (options = {}) => {
	const hardfork = options.hardfork ?? 'prague'
	const eips = options.eips ?? []
	const loggingLevel = options.loggingLevel ?? 'warn'

	return Layer.effect(
		CommonService,
		Effect.gen(function* () {
			const forkConfig = yield* ForkConfigService

			// Fix for #R155-P5-002: Validate chain ID doesn't exceed safe integer range
			// Chain IDs above Number.MAX_SAFE_INTEGER (9007199254740991) will lose precision
			// when converted to Number, causing wrong chain identification
			if (forkConfig.chainId > BigInt(Number.MAX_SAFE_INTEGER)) {
				return yield* Effect.fail(
					new InternalError({
						message: `Chain ID ${forkConfig.chainId} exceeds maximum safe integer (${Number.MAX_SAFE_INTEGER}). ` +
							`Chain IDs this large cannot be safely represented as JavaScript Numbers and may cause incorrect chain identification.`,
						cause: undefined,
					}),
				)
			}

			// Safe to convert to Number after validation
			const chainIdNumber = Number(forkConfig.chainId)

			// Wrap createCommon in Effect.try to capture synchronous exceptions
			// (e.g., invalid hardfork name) in the Effect error channel
			const common = yield* Effect.try({
				try: () =>
					createCommon({
						...tevmDefault,
						id: chainIdNumber,
						hardfork,
						eips: /** @type {number[]} */ ([...eips]),
						...(loggingLevel !== 'silent' && { loggingLevel }),
					}).copy(), // Always copy to avoid mutation issues
				catch: (error) =>
					new InternalError({
						// v8 ignore next - defensive branch for non-Error exceptions
						message: `Failed to create Common configuration: ${error instanceof Error ? error.message : /* v8 ignore next */ String(error)}`,
						cause: error,
					}),
			})

			return /** @type {CommonShape} */ ({
				common,
				chainId: chainIdNumber,
				hardfork,
				eips: common.ethjsCommon.eips(),
				copy: () => common.copy(),
			})
		}),
	)
}
