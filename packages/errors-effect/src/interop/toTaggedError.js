import { TevmError } from '../TevmError.js'

/**
 * Validates that a value is a valid hex string (starts with '0x').
 * Used to safely cast strings to `0x${string}` type.
 * @param {unknown} value - The value to check
 * @returns {value is `0x${string}`} True if value is a valid hex string
 */
const isValidHex = (value) => {
	return typeof value === 'string' && value.startsWith('0x')
}

// EVM errors
import { InsufficientBalanceError } from '../evm/InsufficientBalanceError.js'
import { InsufficientFundsError } from '../evm/InsufficientFundsError.js'
import { InvalidJumpError } from '../evm/InvalidJumpError.js'
import { InvalidOpcodeError } from '../evm/InvalidOpcodeError.js'
import { OutOfGasError } from '../evm/OutOfGasError.js'
import { RevertError } from '../evm/RevertError.js'
import { StackOverflowError } from '../evm/StackOverflowError.js'
import { StackUnderflowError } from '../evm/StackUnderflowError.js'
// Transport errors
import { ForkError } from '../transport/ForkError.js'
import { NetworkError } from '../transport/NetworkError.js'
import { TimeoutError } from '../transport/TimeoutError.js'
// Block errors
import { BlockNotFoundError } from '../block/BlockNotFoundError.js'
import { InvalidBlockError } from '../block/InvalidBlockError.js'
import { BlockGasLimitExceededError } from '../block/BlockGasLimitExceededError.js'
// Transaction errors
import { InvalidTransactionError } from '../transaction/InvalidTransactionError.js'
import { NonceTooLowError } from '../transaction/NonceTooLowError.js'
import { NonceTooHighError } from '../transaction/NonceTooHighError.js'
import { GasTooLowError } from '../transaction/GasTooLowError.js'
// State errors
import { StateRootNotFoundError } from '../state/StateRootNotFoundError.js'
import { AccountNotFoundError } from '../state/AccountNotFoundError.js'
import { StorageError } from '../state/StorageError.js'
// JSON-RPC errors
import { InvalidRequestError } from '../jsonrpc/InvalidRequestError.js'
import { MethodNotFoundError } from '../jsonrpc/MethodNotFoundError.js'
import { InvalidParamsError } from '../jsonrpc/InvalidParamsError.js'
import { InternalError } from '../jsonrpc/InternalError.js'
// Node errors
import { SnapshotNotFoundError } from '../node/SnapshotNotFoundError.js'
import { FilterNotFoundError } from '../node/FilterNotFoundError.js'
import { InvalidFilterTypeError } from '../node/InvalidFilterTypeError.js'
import { NodeNotReadyError } from '../node/NodeNotReadyError.js'

/**
 * Map of error tags to their TaggedError constructors.
 * Note: Some aliases are included to handle errors from @tevm/errors
 * which may use different _tag values than the Effect versions.
 * @type {Record<string, new (props: any) => any>}
 */
const errorMap = {
	// EVM execution errors
	InsufficientBalanceError,
	InsufficientFundsError,
	InvalidJumpError,
	InvalidOpcodeError,
	OutOfGasError,
	Revert: RevertError,
	RevertError,
	StackOverflowError,
	StackUnderflowError,
	// Transport errors
	ForkError,
	NetworkError,
	TimeoutError,
	// Block errors
	BlockNotFoundError,
	UnknownBlock: BlockNotFoundError,
	InvalidBlockError,
	BlockGasLimitExceededError,
	// Transaction errors
	InvalidTransactionError,
	InvalidTransaction: InvalidTransactionError,
	NonceTooLowError,
	NonceTooHighError,
	GasTooLowError,
	// State errors
	StateRootNotFoundError,
	AccountNotFoundError,
	AccountNotFound: AccountNotFoundError,
	StorageError,
	// JSON-RPC errors
	InvalidRequestError,
	InvalidRequest: InvalidRequestError,
	MethodNotFoundError,
	MethodNotFound: MethodNotFoundError,
	InvalidParamsError,
	InvalidParams: InvalidParamsError,
	InternalError,
	// Node errors
	SnapshotNotFoundError,
	FilterNotFoundError,
	InvalidFilterTypeError,
	NodeNotReadyError,
}

/**
 * Converts a BaseError from @tevm/errors to a TaggedError from @tevm/errors-effect.
 *
 * This is useful for bridging between the Promise-based API and the Effect-based API.
 *
 * Note: Error-specific properties (address, gasUsed, opcode, etc.) will be extracted
 * from the source error if they exist. If the source error doesn't have structured
 * data, only the message will be preserved.
 *
 * **Type Narrowing**: When you pass a specific error type, TypeScript will correctly
 * narrow the return type. See {@link ./toTaggedError.types.ts} for TypeScript overload
 * signatures that provide proper type inference.
 *
 * @example
 * ```typescript
 * import { toTaggedError, InsufficientBalanceError } from '@tevm/errors-effect'
 * import { Effect } from 'effect'
 *
 * // Type is correctly inferred as InsufficientBalanceError
 * const error = toTaggedError(new InsufficientBalanceError({ required: 100n, available: 50n }))
 * console.log(error.required) // No type error - TypeScript knows this is InsufficientBalanceError
 *
 * // For unknown errors, use type guards or the full union type
 * try {
 *   // Some operation that throws
 * } catch (e) {
 *   const taggedError = toTaggedError(e) // Returns TevmTaggedErrorUnion
 *   if (taggedError._tag === 'InsufficientBalanceError') {
 *     console.log(taggedError.required) // Narrowed by tag discriminant
 *   }
 * }
 * ```
 *
 * @see {@link ./toTaggedError.types.ts} for TypeScript overload signatures
 * @param {import('@tevm/errors').BaseError | Error | unknown} error - The error to convert
 * @returns {import('./toTaggedError.types.js').TevmTaggedErrorUnion} A TaggedError instance with type narrowing based on input
 */
export const toTaggedError = /** @type {import('./toTaggedError.types.js').toTaggedError} */ ((error) => {
	// #R149-P1-002 fix: Use _tag property check combined with Error instance check
	// to work across module boundaries while still ensuring proper Error instances are returned
	//
	// instanceof checks for specific error classes fail when error classes are imported from
	// different module instances because each instance has its own distinct prototype.
	// However, we CAN check if it's an Error instance (base class) which works reliably.
	//
	// Strategy:
	// 1. If it's an Error with a known _tag, it's already a proper tagged error - return as-is
	// 2. If it's just a plain object with _tag, convert it to a proper Error instance
	if (error && typeof error === 'object' && '_tag' in error && error instanceof Error) {
		const tag = /** @type {string} */ (error._tag)

		// If it's already a TevmError TaggedError, return as-is
		if (tag === 'TevmError') {
			return error
		}

		// Check if already a known TaggedError type from this package
		// The instanceof Error check above ensures it's an actual Error instance
		if (tag in errorMap) {
			return error
		}
	}

	// Handle BaseError from @tevm/errors (has _tag property but is not an Effect TaggedError)
	// This also handles plain objects with _tag that need to be converted to proper Error instances
	if (error && typeof error === 'object' && '_tag' in error) {
		const baseError = /** @type {import('@tevm/errors').BaseError & Record<string, unknown>} */ (error)
		const tag = baseError._tag

		// Check if we have a matching TaggedError class
		const ErrorClass = errorMap[tag]
		if (ErrorClass) {
			// Create a TaggedError with properties from the BaseError
			// Extract error-specific properties if they exist on the source
			// Note: We always preserve the cause property for proper error chaining

			// EVM errors
			if (tag === 'InsufficientBalanceError') {
				return new InsufficientBalanceError({
					address: isValidHex(baseError['address']) ? baseError['address'] : undefined,
					required: typeof baseError['required'] === 'bigint' ? baseError['required'] : undefined,
					available: typeof baseError['available'] === 'bigint' ? baseError['available'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'InsufficientFundsError') {
				return new InsufficientFundsError({
					address: isValidHex(baseError['address']) ? baseError['address'] : undefined,
					required: typeof baseError['required'] === 'bigint' ? baseError['required'] : undefined,
					available: typeof baseError['available'] === 'bigint' ? baseError['available'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'InvalidJumpError') {
				return new InvalidJumpError({
					destination: typeof baseError['destination'] === 'number' ? baseError['destination'] : undefined,
					pc: typeof baseError['pc'] === 'number' ? baseError['pc'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'OutOfGasError') {
				return new OutOfGasError({
					gasUsed: typeof baseError['gasUsed'] === 'bigint' ? baseError['gasUsed'] : undefined,
					gasLimit: typeof baseError['gasLimit'] === 'bigint' ? baseError['gasLimit'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'RevertError' || tag === 'Revert') {
				return new RevertError({
					// Original @tevm/errors uses 'raw' property, Effect version also uses 'raw'
					raw: isValidHex(baseError['raw']) ? baseError['raw'] : undefined,
					reason: typeof baseError['reason'] === 'string' ? baseError['reason'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'InvalidOpcodeError') {
				return new InvalidOpcodeError({
					opcode: typeof baseError['opcode'] === 'number' ? baseError['opcode'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'StackOverflowError') {
				return new StackOverflowError({
					stackSize: typeof baseError['stackSize'] === 'number' ? baseError['stackSize'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'StackUnderflowError') {
				return new StackUnderflowError({
					requiredItems: typeof baseError['requiredItems'] === 'number' ? baseError['requiredItems'] : undefined,
					availableItems: typeof baseError['availableItems'] === 'number' ? baseError['availableItems'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}

			// Transport errors
			if (tag === 'ForkError') {
				return new ForkError({
					method: typeof baseError['method'] === 'string' ? baseError['method'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'NetworkError') {
				return new NetworkError({
					url: typeof baseError['url'] === 'string' ? baseError['url'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'TimeoutError') {
				return new TimeoutError({
					timeout: typeof baseError['timeout'] === 'number' ? baseError['timeout'] : undefined,
					operation: typeof baseError['operation'] === 'string' ? baseError['operation'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}

			// Block errors
			if (tag === 'BlockNotFoundError' || tag === 'UnknownBlock') {
				return new BlockNotFoundError({
					blockTag: /** @type {import('../block/BlockNotFoundError.js').BlockTag | undefined} */ (baseError['blockTag']),
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'InvalidBlockError') {
				return new InvalidBlockError({
					blockNumber: typeof baseError['blockNumber'] === 'bigint' ? baseError['blockNumber'] : undefined,
					blockHash: isValidHex(baseError['blockHash']) ? baseError['blockHash'] : undefined,
					reason: typeof baseError['reason'] === 'string' ? baseError['reason'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'BlockGasLimitExceededError') {
				return new BlockGasLimitExceededError({
					blockGasLimit: typeof baseError['blockGasLimit'] === 'bigint' ? baseError['blockGasLimit'] : undefined,
					gasUsed: typeof baseError['gasUsed'] === 'bigint' ? baseError['gasUsed'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}

			// Transaction errors
			if (tag === 'InvalidTransactionError' || tag === 'InvalidTransaction') {
				return new InvalidTransactionError({
					reason: typeof baseError['reason'] === 'string' ? baseError['reason'] : undefined,
					tx: baseError['tx'],
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'NonceTooLowError') {
				return new NonceTooLowError({
					address: isValidHex(baseError['address']) ? baseError['address'] : undefined,
					expected: typeof baseError['expected'] === 'bigint' ? baseError['expected'] : undefined,
					actual: typeof baseError['actual'] === 'bigint' ? baseError['actual'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'NonceTooHighError') {
				return new NonceTooHighError({
					address: isValidHex(baseError['address']) ? baseError['address'] : undefined,
					expected: typeof baseError['expected'] === 'bigint' ? baseError['expected'] : undefined,
					actual: typeof baseError['actual'] === 'bigint' ? baseError['actual'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'GasTooLowError') {
				return new GasTooLowError({
					gasLimit: typeof baseError['gasLimit'] === 'bigint' ? baseError['gasLimit'] : undefined,
					intrinsicGas: typeof baseError['intrinsicGas'] === 'bigint' ? baseError['intrinsicGas'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}

			// State errors
			if (tag === 'StateRootNotFoundError') {
				return new StateRootNotFoundError({
					stateRoot: isValidHex(baseError['stateRoot']) ? baseError['stateRoot'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'AccountNotFoundError' || tag === 'AccountNotFound') {
				return new AccountNotFoundError({
					address: isValidHex(baseError['address']) ? baseError['address'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'StorageError') {
				return new StorageError({
					address: isValidHex(baseError['address']) ? baseError['address'] : undefined,
					key: isValidHex(baseError['key']) ? baseError['key'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}

			// JSON-RPC errors
			if (tag === 'InvalidRequestError' || tag === 'InvalidRequest') {
				return new InvalidRequestError({
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'MethodNotFoundError' || tag === 'MethodNotFound') {
				return new MethodNotFoundError({
					method: typeof baseError['method'] === 'string' ? baseError['method'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'InvalidParamsError' || tag === 'InvalidParams') {
				return new InvalidParamsError({
					method: typeof baseError['method'] === 'string' ? baseError['method'] : undefined,
					params: baseError['params'],
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'InternalError') {
				return new InternalError({
					meta: baseError['meta'],
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}

			// Node errors
			if (tag === 'SnapshotNotFoundError') {
				return new SnapshotNotFoundError({
					snapshotId: typeof baseError['snapshotId'] === 'string' ? baseError['snapshotId'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'FilterNotFoundError') {
				return new FilterNotFoundError({
					filterId: typeof baseError['filterId'] === 'string' ? baseError['filterId'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'InvalidFilterTypeError') {
				return new InvalidFilterTypeError({
					filterId: typeof baseError['filterId'] === 'string' ? baseError['filterId'] : undefined,
					expectedType: typeof baseError['expectedType'] === 'string' ? baseError['expectedType'] : undefined,
					actualType: typeof baseError['actualType'] === 'string' ? baseError['actualType'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			if (tag === 'NodeNotReadyError') {
				return new NodeNotReadyError({
					reason: typeof baseError['reason'] === 'string' ? baseError['reason'] : undefined,
					message: baseError['message'],
					cause: baseError['cause'],
				})
			}
			// Note: All error tags in errorMap have specific handlers above.
			// If a new error is added to errorMap without a handler, it will fall through
			// to the generic TevmError below.
		}

		// Fall back to generic TevmError
		return new TevmError({
			message: baseError['message'],
			code: baseError['code'] ?? 0,
			docsPath: baseError['docsPath'],
			cause: baseError['cause'],
		})
	}

	// Handle regular Error
	if (error instanceof Error) {
		return new TevmError({
			message: error.message,
			code: 0,
			cause: error,
		})
	}

	// Handle unknown errors
	return new TevmError({
		message: String(error),
		code: 0,
		cause: error,
	})
})
