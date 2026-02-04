/**
 * TypeScript overload signatures for toTaggedError.
 *
 * This file provides type-safe function overloads that narrow the return type
 * based on the input error type. When you pass a specific error type,
 * TypeScript will correctly infer the return type without needing type guards.
 *
 * @example
 * ```typescript
 * import { toTaggedError, InsufficientBalanceError } from '@tevm/errors-effect'
 *
 * // Type is correctly inferred as InsufficientBalanceError
 * const error = toTaggedError(new InsufficientBalanceError({ required: 100n, available: 50n }))
 * console.log(error.required) // No type error - TypeScript knows this is InsufficientBalanceError
 * ```
 *
 * @module
 */

import type { BaseError } from '@tevm/errors'
// Import all error types
import type { TevmError } from '../TevmError.js'
import type { InsufficientBalanceError } from '../evm/InsufficientBalanceError.js'
import type { InsufficientFundsError } from '../evm/InsufficientFundsError.js'
import type { InvalidJumpError } from '../evm/InvalidJumpError.js'
import type { InvalidOpcodeError } from '../evm/InvalidOpcodeError.js'
import type { OutOfGasError } from '../evm/OutOfGasError.js'
import type { RevertError } from '../evm/RevertError.js'
import type { StackOverflowError } from '../evm/StackOverflowError.js'
import type { StackUnderflowError } from '../evm/StackUnderflowError.js'
import type { ForkError } from '../transport/ForkError.js'
import type { NetworkError } from '../transport/NetworkError.js'
import type { TimeoutError } from '../transport/TimeoutError.js'
import type { BlockNotFoundError } from '../block/BlockNotFoundError.js'
import type { InvalidBlockError } from '../block/InvalidBlockError.js'
import type { BlockGasLimitExceededError } from '../block/BlockGasLimitExceededError.js'
import type { InvalidTransactionError } from '../transaction/InvalidTransactionError.js'
import type { NonceTooLowError } from '../transaction/NonceTooLowError.js'
import type { NonceTooHighError } from '../transaction/NonceTooHighError.js'
import type { GasTooLowError } from '../transaction/GasTooLowError.js'
import type { StateRootNotFoundError } from '../state/StateRootNotFoundError.js'
import type { AccountNotFoundError } from '../state/AccountNotFoundError.js'
import type { StorageError } from '../state/StorageError.js'
import type { InvalidRequestError } from '../jsonrpc/InvalidRequestError.js'
import type { MethodNotFoundError } from '../jsonrpc/MethodNotFoundError.js'
import type { InvalidParamsError } from '../jsonrpc/InvalidParamsError.js'
import type { InternalError } from '../jsonrpc/InternalError.js'
import type { SnapshotNotFoundError } from '../node/SnapshotNotFoundError.js'
import type { FilterNotFoundError } from '../node/FilterNotFoundError.js'
import type { InvalidFilterTypeError } from '../node/InvalidFilterTypeError.js'
import type { NodeNotReadyError } from '../node/NodeNotReadyError.js'

/**
 * Union type of all TEVM TaggedError types
 */
export type TevmTaggedErrorUnion =
	| TevmError
	| InsufficientBalanceError
	| InsufficientFundsError
	| InvalidJumpError
	| OutOfGasError
	| RevertError
	| InvalidOpcodeError
	| StackOverflowError
	| StackUnderflowError
	| ForkError
	| NetworkError
	| TimeoutError
	| BlockNotFoundError
	| InvalidBlockError
	| BlockGasLimitExceededError
	| InvalidTransactionError
	| NonceTooLowError
	| NonceTooHighError
	| GasTooLowError
	| StateRootNotFoundError
	| AccountNotFoundError
	| StorageError
	| InvalidRequestError
	| MethodNotFoundError
	| InvalidParamsError
	| InternalError
	| SnapshotNotFoundError
	| FilterNotFoundError
	| InvalidFilterTypeError
	| NodeNotReadyError

/**
 * Type-safe function overloads for toTaggedError.
 *
 * This interface describes the overloaded function signatures that narrow
 * the return type based on the input error type. TypeScript matches overloads
 * in order, most specific first.
 *
 * Implementation is provided in toTaggedError.js
 */
export interface toTaggedError {
	/** If already a TevmError, return as-is */
	(error: TevmError): TevmError
	/** Preserve InsufficientBalanceError type */
	(error: InsufficientBalanceError): InsufficientBalanceError
	/** Preserve InsufficientFundsError type */
	(error: InsufficientFundsError): InsufficientFundsError
	/** Preserve InvalidJumpError type */
	(error: InvalidJumpError): InvalidJumpError
	/** Preserve OutOfGasError type */
	(error: OutOfGasError): OutOfGasError
	/** Preserve RevertError type */
	(error: RevertError): RevertError
	/** Preserve InvalidOpcodeError type */
	(error: InvalidOpcodeError): InvalidOpcodeError
	/** Preserve StackOverflowError type */
	(error: StackOverflowError): StackOverflowError
	/** Preserve StackUnderflowError type */
	(error: StackUnderflowError): StackUnderflowError
	/** Preserve ForkError type */
	(error: ForkError): ForkError
	/** Preserve NetworkError type */
	(error: NetworkError): NetworkError
	/** Preserve TimeoutError type */
	(error: TimeoutError): TimeoutError
	/** Preserve BlockNotFoundError type */
	(error: BlockNotFoundError): BlockNotFoundError
	/** Preserve InvalidBlockError type */
	(error: InvalidBlockError): InvalidBlockError
	/** Preserve BlockGasLimitExceededError type */
	(error: BlockGasLimitExceededError): BlockGasLimitExceededError
	/** Preserve InvalidTransactionError type */
	(error: InvalidTransactionError): InvalidTransactionError
	/** Preserve NonceTooLowError type */
	(error: NonceTooLowError): NonceTooLowError
	/** Preserve NonceTooHighError type */
	(error: NonceTooHighError): NonceTooHighError
	/** Preserve GasTooLowError type */
	(error: GasTooLowError): GasTooLowError
	/** Preserve StateRootNotFoundError type */
	(error: StateRootNotFoundError): StateRootNotFoundError
	/** Preserve AccountNotFoundError type */
	(error: AccountNotFoundError): AccountNotFoundError
	/** Preserve StorageError type */
	(error: StorageError): StorageError
	/** Preserve InvalidRequestError type */
	(error: InvalidRequestError): InvalidRequestError
	/** Preserve MethodNotFoundError type */
	(error: MethodNotFoundError): MethodNotFoundError
	/** Preserve InvalidParamsError type */
	(error: InvalidParamsError): InvalidParamsError
	/** Preserve InternalError type */
	(error: InternalError): InternalError
	/** Preserve SnapshotNotFoundError type */
	(error: SnapshotNotFoundError): SnapshotNotFoundError
	/** Preserve FilterNotFoundError type */
	(error: FilterNotFoundError): FilterNotFoundError
	/** Preserve InvalidFilterTypeError type */
	(error: InvalidFilterTypeError): InvalidFilterTypeError
	/** Preserve NodeNotReadyError type */
	(error: NodeNotReadyError): NodeNotReadyError
	/**
	 * Fallback: For unknown errors, return the full union type.
	 * Use this when the input error type is not known at compile time.
	 */
	(error: BaseError | Error | unknown): TevmTaggedErrorUnion
}
