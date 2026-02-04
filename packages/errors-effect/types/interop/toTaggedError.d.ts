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
export const toTaggedError: import("./toTaggedError.types.js").toTaggedError;
//# sourceMappingURL=toTaggedError.d.ts.map