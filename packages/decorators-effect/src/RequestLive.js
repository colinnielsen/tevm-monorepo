/**
 * @module @tevm/decorators-effect/RequestLive
 * Live implementation of the Request service for EIP-1193
 */

import { Effect, Layer } from 'effect'
import { RequestService } from './RequestService.js'
import { EthActionsService } from './EthActionsService.js'
import { TevmActionsService } from './TevmActionsService.js'
import { InvalidParamsError, MethodNotFoundError } from '@tevm/errors-effect'

/**
 * Live implementation of RequestService.
 *
 * Provides EIP-1193 compatible request handling by routing
 * JSON-RPC methods to the appropriate action services.
 *
 * Supports:
 * - Standard Ethereum methods (eth_*)
 * - TEVM-specific methods (tevm_*)
 *
 * @example
 * ```javascript
 * import { Effect, Layer } from 'effect'
 * import { RequestService, RequestLive } from '@tevm/decorators-effect'
 * import { EthActionsLive } from './EthActionsLive.js'
 * import { TevmActionsLive } from './TevmActionsLive.js'
 *
 * const layer = RequestLive.pipe(
 *   Layer.provide(EthActionsLive),
 *   Layer.provide(TevmActionsLive)
 * )
 *
 * const program = Effect.gen(function* () {
 *   const requestService = yield* RequestService
 *   return yield* requestService.request({
 *     method: 'eth_blockNumber',
 *     params: []
 *   })
 * })
 *
 * await Effect.runPromise(program.pipe(Effect.provide(layer)))
 * ```
 *
 */
export const RequestLive = /** @type {Layer.Layer<import('./RequestService.js').RequestServiceId, never, import('./EthActionsService.js').EthActionsService | import('./TevmActionsService.js').TevmActionsService>} */ (Layer.effect(
	RequestService,
	Effect.gen(function* () {
		const ethActions = yield* EthActionsService
		const tevmActions = yield* TevmActionsService

		return /** @type {import('./types.js').RequestServiceShape} */ ({
			/**
			 * @template T
			 * @param {import('./types.js').Eip1193RequestParams} params
			 * @returns {import('effect').Effect.Effect<T, import('@tevm/errors-effect').InvalidParamsError | import('@tevm/errors-effect').InternalError | import('@tevm/errors-effect').MethodNotFoundError, never>}
			 */
			request: (params) =>
				Effect.gen(function* () {
					const { method, params: rpcParams = [] } = params

					switch (method) {
						// Ethereum methods
						case 'eth_blockNumber': {
							const result = yield* ethActions.blockNumber()
							return /** @type {T} */ (`0x${result.toString(16)}`)
						}

						case 'eth_chainId': {
							const result = yield* ethActions.chainId()
							return /** @type {T} */ (`0x${result.toString(16)}`)
						}

						case 'eth_gasPrice': {
							const result = yield* ethActions.gasPrice()
							return /** @type {T} */ (`0x${result.toString(16)}`)
						}

						case 'eth_call': {
							const [callParams] = /** @type {[any]} */ (rpcParams)
							if (!callParams) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'eth_call',
										params: rpcParams,
										message: 'Missing call parameters',
									})
								)
							}
							const result = yield* ethActions.call(callParams)
							return /** @type {T} */ (result)
						}

						case 'eth_getBalance': {
							const [address, blockTag] = /** @type {[string, string | undefined]} */ (rpcParams)
							if (!address) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'eth_getBalance',
										params: rpcParams,
										message: 'Missing address parameter',
									})
								)
							}
							const result = yield* ethActions.getBalance({
								address: /** @type {import('./types.js').Address} */ (address),
								...(blockTag !== undefined && { blockTag: /** @type {import('./types.js').BlockParam} */ (blockTag) }),
							})
							return /** @type {T} */ (`0x${result.toString(16)}`)
						}

						case 'eth_getCode': {
							const [address, blockTag] = /** @type {[string, string | undefined]} */ (rpcParams)
							if (!address) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'eth_getCode',
										params: rpcParams,
										message: 'Missing address parameter',
									})
								)
							}
							const result = yield* ethActions.getCode({
								address: /** @type {import('./types.js').Address} */ (address),
								...(blockTag !== undefined && { blockTag: /** @type {import('./types.js').BlockParam} */ (blockTag) }),
							})
							return /** @type {T} */ (result)
						}

						case 'eth_getStorageAt': {
							const [address, position, blockTag] = /** @type {[string, string, string | undefined]} */ (rpcParams)
							if (!address || position === undefined) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'eth_getStorageAt',
										params: rpcParams,
										message: 'Missing address or position parameter',
									})
								)
							}
							const result = yield* ethActions.getStorageAt({
								address: /** @type {import('./types.js').Address} */ (address),
								position: /** @type {import('./types.js').Hex} */ (position),
								...(blockTag !== undefined && { blockTag: /** @type {import('./types.js').BlockParam} */ (blockTag) }),
							})
							return /** @type {T} */ (result)
						}

						case 'eth_estimateGas': {
							const [estimateParams] = /** @type {[any]} */ (rpcParams)
							if (!estimateParams) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'eth_estimateGas',
										params: rpcParams,
										message: 'Missing estimate gas parameters',
									})
								)
							}
							const result = yield* ethActions.estimateGas(estimateParams)
							return /** @type {T} */ (`0x${result.toString(16)}`)
						}

						case 'eth_getTransactionCount': {
							const [address, blockTag] = /** @type {[string, string | undefined]} */ (rpcParams)
							if (!address) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'eth_getTransactionCount',
										params: rpcParams,
										message: 'Missing address parameter',
									})
								)
							}
							const result = yield* ethActions.getTransactionCount({
								address: /** @type {import('./types.js').Address} */ (address),
								...(blockTag !== undefined && { blockTag: /** @type {import('./types.js').BlockParam} */ (blockTag) }),
							})
							return /** @type {T} */ (`0x${result.toString(16)}`)
						}

						case 'eth_getLogs': {
							const [filterParams] = /** @type {[any]} */ (rpcParams)
							if (!filterParams) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'eth_getLogs',
										params: rpcParams,
										message: 'Missing filter parameters',
									})
								)
							}
							const result = yield* ethActions.getLogs({
								...(filterParams.fromBlock !== undefined && { fromBlock: filterParams.fromBlock }),
								...(filterParams.toBlock !== undefined && { toBlock: filterParams.toBlock }),
								...(filterParams.address !== undefined && { address: filterParams.address }),
								...(filterParams.topics !== undefined && { topics: filterParams.topics }),
								...(filterParams.blockHash !== undefined && { blockHash: filterParams.blockHash }),
							})
							return /** @type {T} */ (result)
						}

						case 'eth_getBlockByNumber': {
							const [blockTag, includeTransactions] = /** @type {[string, boolean | undefined]} */ (rpcParams)
							if (blockTag === undefined) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'eth_getBlockByNumber',
										params: rpcParams,
										message: 'Missing block tag parameter',
									})
								)
							}
							const result = yield* ethActions.getBlockByNumber({
								blockTag: /** @type {import('./types.js').BlockParam} */ (blockTag),
								includeTransactions: includeTransactions ?? false,
							})
							return /** @type {T} */ (result)
						}

						case 'eth_getBlockByHash': {
							const [blockHash, includeTransactions] = /** @type {[string, boolean | undefined]} */ (rpcParams)
							if (!blockHash) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'eth_getBlockByHash',
										params: rpcParams,
										message: 'Missing block hash parameter',
									})
								)
							}
							const result = yield* ethActions.getBlockByHash({
								blockHash: /** @type {import('./types.js').Hex} */ (blockHash),
								includeTransactions: includeTransactions ?? false,
							})
							return /** @type {T} */ (result)
						}

						// #R148-P4-006 fix: Add eth_getTransactionByHash handler
						case 'eth_getTransactionByHash': {
							const [txHash] = /** @type {[string]} */ (rpcParams)
							if (!txHash) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'eth_getTransactionByHash',
										params: rpcParams,
										message: 'Missing transaction hash parameter',
									})
								)
							}
							const result = yield* ethActions.getTransactionByHash({
								hash: /** @type {import('./types.js').Hex} */ (txHash),
							})
							return /** @type {T} */ (result)
						}

						// #R148-P4-006 fix: Add eth_getTransactionReceipt handler
						case 'eth_getTransactionReceipt': {
							const [txHash] = /** @type {[string]} */ (rpcParams)
							if (!txHash) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'eth_getTransactionReceipt',
										params: rpcParams,
										message: 'Missing transaction hash parameter',
									})
								)
							}
							const result = yield* ethActions.getTransactionReceipt({
								hash: /** @type {import('./types.js').Hex} */ (txHash),
							})
							return /** @type {T} */ (result)
						}

						case 'eth_accounts': {
							const result = yield* ethActions.accounts()
							return /** @type {T} */ (result)
						}

						case 'net_version': {
							const result = yield* ethActions.netVersion()
							return /** @type {T} */ (result)
						}

						case 'web3_clientVersion': {
							const result = yield* ethActions.web3ClientVersion()
							return /** @type {T} */ (result)
						}

						// TEVM methods
						case 'tevm_getAccount': {
							const [accountParams] = /** @type {[any]} */ (rpcParams)
							if (!accountParams?.address) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'tevm_getAccount',
										params: rpcParams,
										message: 'Missing address parameter',
									})
								)
							}
							const result = yield* tevmActions.getAccount(accountParams)
							return /** @type {T} */ (result)
						}

						case 'tevm_setAccount': {
							const [accountParams] = /** @type {[any]} */ (rpcParams)
							if (!accountParams?.address) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'tevm_setAccount',
										params: rpcParams,
										message: 'Missing address parameter',
									})
								)
							}
							const result = yield* tevmActions.setAccount(accountParams)
							return /** @type {T} */ (result)
						}

						case 'tevm_call': {
							const [callParams] = /** @type {[any]} */ (rpcParams)
							const result = yield* tevmActions.call(callParams ?? {})
							return /** @type {T} */ (result)
						}

						case 'tevm_dumpState': {
							const result = yield* tevmActions.dumpState()
							return /** @type {T} */ (result)
						}

						case 'tevm_loadState': {
							const [state] = /** @type {[string]} */ (rpcParams)
							if (!state) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'tevm_loadState',
										params: rpcParams,
										message: 'Missing state parameter',
									})
								)
							}
							yield* tevmActions.loadState(state)
							return /** @type {T} */ (null)
						}

						case 'anvil_mine':
						case 'evm_mine': {
							const [blocksHex] = /** @type {[string]} */ (rpcParams)
							// Use Number() to handle both decimal ("5") and hex ("0x5") formats
							const blocks = blocksHex ? Number(blocksHex) : 1
							yield* tevmActions.mine({ blocks })
							return /** @type {T} */ (null)
						}

						// Snapshot methods (#R126-P4-004 fix)
						case 'anvil_snapshot':
						case 'evm_snapshot': {
							const result = yield* tevmActions.snapshot()
							return /** @type {T} */ (result)
						}

						case 'anvil_revert':
						case 'evm_revert': {
							const [snapshotId] = /** @type {[string]} */ (rpcParams)
							if (!snapshotId) {
								return yield* Effect.fail(
									new InvalidParamsError({
										method: 'anvil_revert',
										params: rpcParams,
										message: 'Missing snapshot ID parameter',
									})
								)
							}
							yield* tevmActions.revert(/** @type {import('./types.js').Hex} */ (snapshotId))
							return /** @type {T} */ (true)
						}

						default:
							return yield* Effect.fail(
								new MethodNotFoundError({
									method,
									message: `Unsupported method: ${method}`,
								})
							)
					}
				}),
		})
	})
))
