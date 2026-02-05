import { Effect, Layer, Ref } from 'effect'
import { InvalidParamsError } from '@tevm/errors-effect'
import { BlockParamsService } from './BlockParamsService.js'

/**
 * @module @tevm/node-effect/BlockParamsLive
 * @description Layer that creates BlockParamsService using Effect Refs
 */

/**
 * @typedef {import('./types.js').BlockParamsShape} BlockParamsShape
 * @typedef {import('./types.js').BlockParamsLiveOptions} BlockParamsLiveOptions
 */

/**
 * Maximum value for uint64 (2^64 - 1).
 * Used for timestamp and gas limit validation.
 * @type {bigint}
 */
const MAX_UINT64 = 18446744073709551615n

/**
 * Maximum value for uint256 (2^256 - 1).
 * Used for wei-denominated values like gas price and base fee.
 * @type {bigint}
 */
const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n

/**
 * Validates a bigint value is within bounds.
 * Fix for #R148-P3-004: Add bounds checking for bigint values.
 *
 * @param {bigint | undefined} value - The value to validate
 * @param {string} paramName - Parameter name for error messages
 * @param {bigint} maxValue - Maximum allowed value
 * @param {string} method - Method name for error messages
 * @returns {import('effect').Effect.Effect<bigint | undefined, import('@tevm/errors-effect').InvalidParamsError, never>}
 */
const validateBigInt = (value, paramName, maxValue, method = 'anvil_setBlockParam') =>
	Effect.gen(function* () {
		// Allow undefined to clear the override
		if (value === undefined) {
			return undefined
		}
		// Validate type
		if (typeof value !== 'bigint') {
			return yield* Effect.fail(
				new InvalidParamsError({
					method,
					params: { [paramName]: value },
					message: `Invalid ${paramName} type: expected bigint, got ${typeof value}`,
				}),
			)
		}
		// Validate non-negative
		if (value < 0n) {
			return yield* Effect.fail(
				new InvalidParamsError({
					method,
					params: { [paramName]: value },
					message: `Invalid ${paramName}: value must be non-negative, got ${value}`,
				}),
			)
		}
		// Validate upper bound
		if (value > maxValue) {
			return yield* Effect.fail(
				new InvalidParamsError({
					method,
					params: { [paramName]: value },
					message: `Invalid ${paramName}: value exceeds maximum (${maxValue}), got ${value}`,
				}),
			)
		}
		return value
	})

/**
 * Creates a BlockParamsService layer using Effect Refs for state management.
 *
 * This layer creates a service that manages block parameter overrides with Refs:
 * - nextBlockTimestamp: Override timestamp for next block
 * - nextBlockGasLimit: Override gas limit for next block
 * - nextBlockBaseFeePerGas: Override base fee (EIP-1559)
 * - minGasPrice: Minimum gas price for transactions
 * - blockTimestampInterval: Interval between blocks for auto-mining
 *
 * The service is fully isolated and can be deep-copied for test scenarios.
 *
 * @example
 * ```javascript
 * import { Effect, Layer } from 'effect'
 * import { BlockParamsService, BlockParamsLive } from '@tevm/node-effect'
 *
 * const program = Effect.gen(function* () {
 *   const blockParams = yield* BlockParamsService
 *   yield* blockParams.setNextBlockTimestamp(1700000000n)
 *   const ts = yield* blockParams.getNextBlockTimestamp
 *   console.log('Next block timestamp:', ts)
 * })
 *
 * const layer = BlockParamsLive()
 * Effect.runPromise(program.pipe(Effect.provide(layer)))
 * ```
 *
 * @example
 * ```javascript
 * // With initial configuration
 * const layer = BlockParamsLive({
 *   minGasPrice: 1000000000n, // 1 gwei
 *   blockTimestampInterval: 12n // 12 seconds
 * })
 * ```
 *
 * @param {BlockParamsLiveOptions} [options] - Configuration options
 */
export const BlockParamsLive = (options = {}) => {
	return Layer.effect(
		BlockParamsService,
		Effect.gen(function* () {
			// Create Refs for mutable state
			/** @type {Ref.Ref<bigint | undefined>} */
			const nextBlockTimestampRef = yield* Ref.make(options.nextBlockTimestamp)
			/** @type {Ref.Ref<bigint | undefined>} */
			const nextBlockGasLimitRef = yield* Ref.make(options.nextBlockGasLimit)
			/** @type {Ref.Ref<bigint | undefined>} */
			const nextBlockBaseFeePerGasRef = yield* Ref.make(options.nextBlockBaseFeePerGas)
			/** @type {Ref.Ref<bigint | undefined>} */
			const minGasPriceRef = yield* Ref.make(options.minGasPrice)
			/** @type {Ref.Ref<bigint | undefined>} */
			const blockTimestampIntervalRef = yield* Ref.make(options.blockTimestampInterval)

			/**
			 * Creates a BlockParamsShape from Refs.
			 * This helper enables the deepCopy pattern.
			 *
			 * @param {Ref.Ref<bigint | undefined>} timestampRef
			 * @param {Ref.Ref<bigint | undefined>} gasLimitRef
			 * @param {Ref.Ref<bigint | undefined>} baseFeeRef
			 * @param {Ref.Ref<bigint | undefined>} gasPriceRef
			 * @param {Ref.Ref<bigint | undefined>} intervalRef
			 * @returns {BlockParamsShape}
			 */
			const createShape = (timestampRef, gasLimitRef, baseFeeRef, gasPriceRef, intervalRef) => {
				/** @type {BlockParamsShape} */
				const shape = {
					getNextBlockTimestamp: Ref.get(timestampRef),
					setNextBlockTimestamp: (ts) =>
						validateBigInt(ts, 'timestamp', MAX_UINT64, 'evm_setNextBlockTimestamp').pipe(
							Effect.flatMap((validated) => Ref.set(timestampRef, validated)),
						),

					getNextBlockGasLimit: Ref.get(gasLimitRef),
					setNextBlockGasLimit: (gl) =>
						validateBigInt(gl, 'gasLimit', MAX_UINT64, 'evm_setBlockGasLimit').pipe(
							Effect.flatMap((validated) => Ref.set(gasLimitRef, validated)),
						),

					getNextBlockBaseFeePerGas: Ref.get(baseFeeRef),
					setNextBlockBaseFeePerGas: (bf) =>
						validateBigInt(bf, 'baseFeePerGas', MAX_UINT256, 'anvil_setNextBlockBaseFeePerGas').pipe(
							Effect.flatMap((validated) => Ref.set(baseFeeRef, validated)),
						),

					getMinGasPrice: Ref.get(gasPriceRef),
					setMinGasPrice: (price) =>
						validateBigInt(price, 'minGasPrice', MAX_UINT256, 'anvil_setMinGasPrice').pipe(
							Effect.flatMap((validated) => Ref.set(gasPriceRef, validated)),
						),

					getBlockTimestampInterval: Ref.get(intervalRef),
					setBlockTimestampInterval: (interval) =>
						validateBigInt(interval, 'blockTimestampInterval', MAX_UINT64, 'anvil_setBlockTimestampInterval').pipe(
							Effect.flatMap((validated) => Ref.set(intervalRef, validated)),
						),

					// Use Effect.all to batch Ref updates atomically (Issue #292 fix)
					// This prevents inconsistent state if fiber is interrupted between individual Ref.set calls
					clearNextBlockOverrides: Effect.all([
						Ref.set(timestampRef, undefined),
						Ref.set(gasLimitRef, undefined),
						Ref.set(baseFeeRef, undefined),
					]).pipe(Effect.asVoid),

					deepCopy: () =>
						Effect.gen(function* () {
							// Read current values atomically using Effect.all to get consistent snapshot (Issue #303 fix)
							// This prevents reading values at different points in time if other fibers modify them
							const { timestamp, gasLimit, baseFee, gasPrice, interval } = yield* Effect.all({
								timestamp: Ref.get(timestampRef),
								gasLimit: Ref.get(gasLimitRef),
								baseFee: Ref.get(baseFeeRef),
								gasPrice: Ref.get(gasPriceRef),
								interval: Ref.get(intervalRef),
							})

							// Create new Refs with copied values
							const newTimestampRef = yield* Ref.make(timestamp)
							const newGasLimitRef = yield* Ref.make(gasLimit)
							const newBaseFeeRef = yield* Ref.make(baseFee)
							const newGasPriceRef = yield* Ref.make(gasPrice)
							const newIntervalRef = yield* Ref.make(interval)

							// Return new shape
							return createShape(newTimestampRef, newGasLimitRef, newBaseFeeRef, newGasPriceRef, newIntervalRef)
						}),
				}
				return shape
			}

			return createShape(
				nextBlockTimestampRef,
				nextBlockGasLimitRef,
				nextBlockBaseFeePerGasRef,
				minGasPriceRef,
				blockTimestampIntervalRef,
			)
		}),
	)
}
