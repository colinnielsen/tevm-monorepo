import { Effect, Layer } from 'effect'
import { createCommon, tevmDefault } from '@tevm/common'
import { CommonService } from './CommonService.js'
import { InternalError } from '@tevm/errors-effect'

/**
 * @module @tevm/common-effect/CommonLocal
 * @description Pre-built layer for local/non-fork mode using tevm-devnet defaults
 */

/**
 * @typedef {import('./types.js').CommonShape} CommonShape
 */

/**
 * Pre-built CommonService layer for local/non-fork mode.
 *
 * This layer provides a CommonService configured with TEVM's default devnet
 * settings (chain ID 900, hardfork 'prague'). It's a convenience export for
 * use cases where you don't need to fork from a remote network.
 *
 * The layer has no dependencies, making it easy to use in isolation.
 *
 * IMPORTANT: Each layer build creates a fresh Common instance to ensure
 * proper isolation between different TEVM instances. This prevents state
 * leakage when multiple TEVM nodes are created in the same process.
 *
 * @example
 * ```javascript
 * import { Effect } from 'effect'
 * import { CommonService, CommonLocal } from '@tevm/common-effect'
 *
 * const program = Effect.gen(function* () {
 *   const common = yield* CommonService
 *   console.log('Chain ID:', common.chainId) // 900
 *   console.log('Hardfork:', common.hardfork) // 'prague'
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(CommonLocal)))
 * ```
 *
 * @example
 * ```javascript
 * // CommonLocal is equivalent to:
 * const CommonLocal = CommonFromConfig({
 *   chainId: 900,
 *   hardfork: 'prague'
 * })
 * ```
 *
 * @type {Layer.Layer<CommonService, InternalError, never>}
 */
export const CommonLocal = Layer.effect(
	CommonService,
	Effect.try({
		try: () => {
			// Create a fresh Common instance for each layer build to ensure
			// proper isolation between different TEVM instances
			/* v8 ignore next - defensive: createCommon rarely throws in local mode */
			const common = createCommon({
				...tevmDefault,
				id: 900,
				hardfork: 'prague',
				eips: [],
				loggingLevel: 'warn',
			}).copy()

			return /** @type {CommonShape} */ ({
				common,
				chainId: 900,
				hardfork: 'prague',
				eips: common.ethjsCommon.eips(),
				copy: () => common.copy(),
			})
		},
		catch: (error) =>
			new InternalError({
				message: `Failed to create Common instance for local mode: ${error instanceof Error ? error.message : String(error)}`,
				cause: error,
			}),
	}),
)
