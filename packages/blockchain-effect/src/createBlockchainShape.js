/**
 * @module @tevm/blockchain-effect/createBlockchainShape
 * @description Factory function to create BlockchainShape from a raw Chain instance.
 *
 * This is useful when you need to create a BlockchainShape from an existing Chain,
 * such as when extracting the blockchain from a VM after deepCopy to ensure both VM and
 * blockchain services use the same Chain instance.
 */

import { Effect } from 'effect'
import { BlockNotFoundError, InvalidBlockError } from '@tevm/errors-effect'

/**
 * @typedef {import('./types.js').BlockchainShape} BlockchainShape
 * @typedef {import('./types.js').BlockId} BlockId
 */

/**
 * Creates a BlockchainShape from a raw Chain instance.
 *
 * This factory function wraps all Chain methods with Effect-based error handling
 * and provides a consistent interface for blockchain operations.
 *
 * This is particularly useful for:
 * - Creating a BlockchainShape from a VM's internal blockchain after deepCopy
 * - Ensuring both VM and blockchain services use the same Chain instance
 * - Converting between Promise-based and Effect-based APIs
 *
 * @example
 * ```javascript
 * import { createBlockchainShape } from '@tevm/blockchain-effect'
 *
 * // After VM deepCopy, extract the blockchain and wrap it
 * const vmCopy = yield* vm.deepCopy()
 * const blockchainShape = createBlockchainShape(vmCopy.vm.blockchain)
 *
 * // Now both VM and blockchain services use the same blockchain
 * const block = yield* blockchainShape.getBlock('latest')
 * ```
 *
 * @param {import('@tevm/blockchain').Chain} chainInstance - The raw Chain instance to wrap
 * @returns {BlockchainShape} Effect-wrapped Blockchain shape
 */
export const createBlockchainShape = (chainInstance) => {
	/** @type {BlockchainShape} */
	const shape = {
		chain: chainInstance,

		getBlock: (blockId) =>
			Effect.tryPromise({
				try: () =>
					chainInstance.getBlockByTag(
						/** @type {`0x${string}` | Uint8Array | number | bigint | 'latest' | 'earliest' | 'pending' | 'safe' | 'finalized'} */ (
							blockId
						),
					),
				catch: (error) =>
					new BlockNotFoundError({
						message: `Block not found: ${String(blockId)}`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		getBlockByHash: (hash) =>
			Effect.tryPromise({
				try: () => chainInstance.getBlockByTag(hash),
				catch: (error) =>
					new BlockNotFoundError({
						message: `Block not found for hash: ${hash}`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		putBlock: (block) =>
			Effect.tryPromise({
				try: () => chainInstance.putBlock(block),
				catch: (error) =>
					new InvalidBlockError({
						message: `Failed to add block to chain`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		getCanonicalHeadBlock: () =>
			Effect.tryPromise({
				try: () => chainInstance.getCanonicalHeadBlock(),
				catch: (error) =>
					new BlockNotFoundError({
						message: `Failed to get canonical head block`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		getIteratorHead: (name) =>
			Effect.tryPromise({
				try: () => chainInstance.getIteratorHead(name),
				catch: (error) =>
					new BlockNotFoundError({
						message: `Failed to get iterator head: ${name}`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		setIteratorHead: (tag, headHash) =>
			Effect.tryPromise({
				try: () => chainInstance.setIteratorHead(tag, headHash),
				catch: (error) =>
					new InvalidBlockError({
						message: `Failed to set iterator head for ${tag}`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		delBlock: (blockHash) =>
			Effect.tryPromise({
				try: () => chainInstance.delBlock(blockHash),
				catch: (error) =>
					new BlockNotFoundError({
						message: `Failed to delete block`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		validateHeader: (header, height) =>
			Effect.tryPromise({
				try: () => chainInstance.validateHeader(header, height),
				catch: (error) =>
					new InvalidBlockError({
						message: `Invalid block header`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		deepCopy: () =>
			Effect.gen(function* () {
				const copiedChain = yield* Effect.tryPromise({
					try: () => chainInstance.deepCopy(),
					catch: (error) =>
						new InvalidBlockError({
							message: `Failed to create deep copy of blockchain`,
							cause: /** @type {Error} */ (error),
						}),
				})
				return createBlockchainShape(copiedChain)
			}),

		// Wrap shallowCopy in Effect.try to prevent errors from escaping Effect channel (#R139-P2-003 fix)
	shallowCopy: () =>
		Effect.try({
			try: () => createBlockchainShape(chainInstance.shallowCopy()),
			catch: (error) =>
				new InvalidBlockError({
					message: `Failed to create shallow copy of blockchain`,
					cause: /** @type {Error} */ (error),
				}),
		}),

		ready: Effect.tryPromise({
			try: () => chainInstance.ready(),
			catch: (error) =>
				new InvalidBlockError({
					message: `Chain failed to become ready`,
					cause: /** @type {Error} */ (error),
				}),
		}),

		/**
		 * Iterate through blocks in a range from start to end (inclusive).
		 * Yields blocks that exist in the specified range.
		 * NOTE: This returns a raw AsyncIterable for compatibility with existing APIs.
		 * Errors are thrown as InvalidBlockError to maintain type consistency (#R139-P2-004 fix).
		 * @param {bigint} start - Starting block number (inclusive)
		 * @param {bigint} end - Ending block number (inclusive)
		 * @returns {AsyncIterable<import('@tevm/block').Block>}
		 */
		iterator: (start, end) => {
			return {
				async *[Symbol.asyncIterator]() {
					const step = start <= end ? 1n : -1n
					for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
						try {
							const block = await chainInstance.getBlock(i)
							if (block) {
								yield block
							}
						} catch (error) {
							// Only silently continue for block-not-found errors
							// Re-throw all other errors (network errors, validation errors, etc.)
							// wrapped as InvalidBlockError for type consistency (#R139-P2-004 fix)
							const isBlockNotFound =
								error instanceof Error &&
								(error.name === 'UnknownBlock' ||
									error.name === 'UnknownBlockError' ||
									error.message?.toLowerCase().includes('block not found') ||
									error.message?.toLowerCase().includes('unknown block'))
							if (!isBlockNotFound) {
								// Wrap non-block-not-found errors in typed error (#R139-P2-004 fix)
								throw new InvalidBlockError({
									message: `Failed to iterate blocks: ${error instanceof Error ? error.message : String(error)}`,
									cause: /** @type {Error} */ (error),
								})
							}
							// Block not found at this height, continue to next
						}
					}
				},
			}
		},
	}
	return shape
}
