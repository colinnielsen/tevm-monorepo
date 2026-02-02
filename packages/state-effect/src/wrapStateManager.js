/**
 * @module @tevm/state-effect/createStateManagerShape
 * @description Factory function to create StateManagerShape from a raw StateManager instance.
 *
 * This is useful when you need to create a StateManagerShape from an existing StateManager,
 * such as when extracting the stateManager from a VM after deepCopy to ensure both VM and
 * action services use the same stateManager instance.
 */

import { Effect } from 'effect'
import {
	StateRootNotFoundError,
	StorageError,
	AccountNotFoundError,
	InternalError,
	NodeNotReadyError,
} from '@tevm/errors-effect'
import { createAddressFromString } from '@tevm/utils'

/**
 * @typedef {import('./types.js').StateManagerShape} StateManagerShape
 * @typedef {import('./types.js').Address} Address
 */

/**
 * Helper to convert an address (hex string or EthjsAddress) to EthjsAddress.
 * This handles the type mismatch between the public API (which accepts hex strings)
 * and the underlying StateManager (which expects EthjsAddress objects).
 *
 * @param {Address} address - Address as hex string or EthjsAddress
 * @returns {import('@tevm/utils').EthjsAddress} EthjsAddress instance
 */
const toEthjsAddress = (address) => {
	if (typeof address === 'string') {
		return createAddressFromString(address)
	}
	return address
}

/**
 * Creates a StateManagerShape from a raw StateManager instance.
 *
 * This factory function wraps all StateManager methods with Effect-based error handling
 * and provides a consistent interface for state operations.
 *
 * This is particularly useful for:
 * - Creating a StateManagerShape from a VM's internal stateManager after deepCopy
 * - Ensuring both VM and action services use the same stateManager instance
 * - Converting between Promise-based and Effect-based APIs
 *
 * @example
 * ```javascript
 * import { createStateManagerShape } from '@tevm/state-effect'
 *
 * // After VM deepCopy, extract the stateManager and wrap it
 * const vmCopy = await vm.deepCopy()
 * const stateManagerShape = createStateManagerShape(vmCopy.stateManager)
 *
 * // Now both VM and action services use the same stateManager
 * const result = yield* stateManagerShape.getAccount(address)
 * ```
 *
 * @param {import('@tevm/state').StateManager} sm - The raw StateManager instance to wrap
 * @returns {StateManagerShape} Effect-wrapped StateManager shape
 */
export const createStateManagerShape = (sm) => {
	/** @type {StateManagerShape} */
	const shape = {
		stateManager: sm,

		getAccount: (address) =>
			Effect.tryPromise({
				try: () => sm.getAccount(toEthjsAddress(address)),
				catch: (error) =>
					new AccountNotFoundError({
						message: `Failed to get account for address ${String(address)}`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		putAccount: (address, account) =>
			Effect.tryPromise({
				try: () => sm.putAccount(toEthjsAddress(address), account),
				catch: (error) =>
					new InternalError({
						message: `Failed to put account for address ${String(address)}`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		deleteAccount: (address) =>
			Effect.tryPromise({
				try: () => sm.deleteAccount(toEthjsAddress(address)),
				catch: (error) =>
					new InternalError({
						message: `Failed to delete account for address ${String(address)}`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		getStorage: (address, slot) =>
			Effect.tryPromise({
				try: () => sm.getStorage(toEthjsAddress(address), slot),
				catch: (error) =>
					new StorageError({
						message: `Failed to get storage for address ${String(address)}`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		putStorage: (address, slot, value) =>
			Effect.tryPromise({
				try: () => sm.putStorage(toEthjsAddress(address), slot, value),
				catch: (error) =>
					new StorageError({
						message: `Failed to put storage for address ${String(address)}`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		clearStorage: (address) =>
			Effect.tryPromise({
				try: () => sm.clearStorage(toEthjsAddress(address)),
				catch: (error) =>
					new StorageError({
						message: `Failed to clear storage for address ${String(address)}`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		getCode: (address) =>
			Effect.tryPromise({
				try: () => sm.getCode(toEthjsAddress(address)),
				catch: (error) =>
					new InternalError({
						message: `Failed to get code for address ${String(address)}`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		putCode: (address, code) =>
			Effect.tryPromise({
				try: () => sm.putCode(toEthjsAddress(address), code),
				catch: (error) =>
					new InternalError({
						message: `Failed to put code for address ${String(address)}`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		getStateRoot: () =>
			Effect.tryPromise({
				try: () => sm.getStateRoot(),
				catch: (error) =>
					new StateRootNotFoundError({
						message: `Failed to get state root`,
						stateRoot: /** @type {`0x${string}`} */ ('0x'),
						cause: /** @type {Error} */ (error),
					}),
			}),

		setStateRoot: (root) =>
			Effect.tryPromise({
				try: () => sm.setStateRoot(root),
				catch: (error) => {
					// Convert Uint8Array to hex string for error context
					const stateRootHex = `0x${Array.from(root)
						.map((b) => b.toString(16).padStart(2, '0'))
						.join('')}`
					return new StateRootNotFoundError({
						message: `State root not found: ${stateRootHex}`,
						stateRoot: /** @type {`0x${string}`} */ (stateRootHex),
						cause: /** @type {Error} */ (error),
					})
				},
			}),

		checkpoint: () =>
			Effect.tryPromise({
				try: () => sm.checkpoint(),
				catch: (error) =>
					new InternalError({
						message: `Failed to create state checkpoint`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		commit: () =>
			Effect.tryPromise({
				try: () => sm.commit(),
				catch: (error) =>
					new InternalError({
						message: `Failed to commit state changes`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		revert: () =>
			Effect.tryPromise({
				try: () => sm.revert(),
				catch: (error) =>
					new InternalError({
						message: `Failed to revert state to checkpoint`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		dumpState: () =>
			Effect.tryPromise({
				try: () => sm.dumpCanonicalGenesis(),
				catch: (error) =>
					new InternalError({
						message: `Failed to dump state`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		loadState: (state) =>
			Effect.tryPromise({
				try: () => sm.generateCanonicalGenesis(state),
				catch: (error) =>
					new InternalError({
						message: `Failed to load state`,
						cause: /** @type {Error} */ (error),
					}),
			}),

		ready: Effect.tryPromise({
			try: () => sm.ready(),
			catch: (error) =>
				new NodeNotReadyError({
					message: `State manager failed to become ready`,
					cause: /** @type {Error} */ (error),
				}),
		}),

		deepCopy: () =>
			Effect.gen(function* () {
				const copiedSm = yield* Effect.tryPromise({
					try: () => sm.deepCopy(),
					catch: (error) =>
						new InternalError({
							message: `Failed to deep copy state manager`,
							cause: /** @type {Error} */ (error),
						}),
				})
				return createStateManagerShape(copiedSm)
			}),

		shallowCopy: () => createStateManagerShape(/** @type {import('@tevm/state').StateManager} */ (sm.shallowCopy())),
	}
	return shape
}
