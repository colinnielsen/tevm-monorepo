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

// Individual overloads - TypeScript matches in order, most specific first

/** If already a TevmError, return as-is */
export function toTaggedError(error: TevmError): TevmError
/** Preserve InsufficientBalanceError type */
export function toTaggedError(error: InsufficientBalanceError): InsufficientBalanceError
/** Preserve InsufficientFundsError type */
export function toTaggedError(error: InsufficientFundsError): InsufficientFundsError
/** Preserve InvalidJumpError type */
export function toTaggedError(error: InvalidJumpError): InvalidJumpError
/** Preserve OutOfGasError type */
export function toTaggedError(error: OutOfGasError): OutOfGasError
/** Preserve RevertError type */
export function toTaggedError(error: RevertError): RevertError
/** Preserve InvalidOpcodeError type */
export function toTaggedError(error: InvalidOpcodeError): InvalidOpcodeError
/** Preserve StackOverflowError type */
export function toTaggedError(error: StackOverflowError): StackOverflowError
/** Preserve StackUnderflowError type */
export function toTaggedError(error: StackUnderflowError): StackUnderflowError
/** Preserve ForkError type */
export function toTaggedError(error: ForkError): ForkError
/** Preserve NetworkError type */
export function toTaggedError(error: NetworkError): NetworkError
/** Preserve TimeoutError type */
export function toTaggedError(error: TimeoutError): TimeoutError
/** Preserve BlockNotFoundError type */
export function toTaggedError(error: BlockNotFoundError): BlockNotFoundError
/** Preserve InvalidBlockError type */
export function toTaggedError(error: InvalidBlockError): InvalidBlockError
/** Preserve BlockGasLimitExceededError type */
export function toTaggedError(error: BlockGasLimitExceededError): BlockGasLimitExceededError
/** Preserve InvalidTransactionError type */
export function toTaggedError(error: InvalidTransactionError): InvalidTransactionError
/** Preserve NonceTooLowError type */
export function toTaggedError(error: NonceTooLowError): NonceTooLowError
/** Preserve NonceTooHighError type */
export function toTaggedError(error: NonceTooHighError): NonceTooHighError
/** Preserve GasTooLowError type */
export function toTaggedError(error: GasTooLowError): GasTooLowError
/** Preserve StateRootNotFoundError type */
export function toTaggedError(error: StateRootNotFoundError): StateRootNotFoundError
/** Preserve AccountNotFoundError type */
export function toTaggedError(error: AccountNotFoundError): AccountNotFoundError
/** Preserve StorageError type */
export function toTaggedError(error: StorageError): StorageError
/** Preserve InvalidRequestError type */
export function toTaggedError(error: InvalidRequestError): InvalidRequestError
/** Preserve MethodNotFoundError type */
export function toTaggedError(error: MethodNotFoundError): MethodNotFoundError
/** Preserve InvalidParamsError type */
export function toTaggedError(error: InvalidParamsError): InvalidParamsError
/** Preserve InternalError type */
export function toTaggedError(error: InternalError): InternalError
/** Preserve SnapshotNotFoundError type */
export function toTaggedError(error: SnapshotNotFoundError): SnapshotNotFoundError
/** Preserve FilterNotFoundError type */
export function toTaggedError(error: FilterNotFoundError): FilterNotFoundError
/** Preserve InvalidFilterTypeError type */
export function toTaggedError(error: InvalidFilterTypeError): InvalidFilterTypeError
/** Preserve NodeNotReadyError type */
export function toTaggedError(error: NodeNotReadyError): NodeNotReadyError

/**
 * Fallback: For unknown errors, return the full union type.
 * Use this when the input error type is not known at compile time.
 */
export function toTaggedError(error: BaseError | Error | unknown): TevmTaggedErrorUnion

/**
 * Implementation signature (matches the JS implementation)
 */
export function toTaggedError(error: unknown): TevmTaggedErrorUnion
