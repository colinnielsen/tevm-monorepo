/**
 * @module @tevm/decorators-effect/EthActionsLive
 * Live implementation of the EthActions service
 */

import { Effect, Layer } from 'effect'
import { EthActionsService } from './EthActionsService.js'
import { VmService } from '@tevm/vm-effect'
import { EvmService } from '@tevm/evm-effect'
import { CommonService } from '@tevm/common-effect'
import { BlockchainService } from '@tevm/blockchain-effect'
import {
	GetBalanceService,
	GetCodeService,
	GetStorageAtService,
} from '@tevm/actions-effect'
import { InternalError, RevertError, OutOfGasError, InvalidOpcodeError, InvalidParamsError } from '@tevm/errors-effect'

/**
 * Live implementation of EthActionsService.
 *
 * Provides Effect-based wrappers around standard Ethereum JSON-RPC methods.
 * This layer depends on:
 * - BlockchainService for blockchain state access
 * - VmService for execution
 * - CommonService for chain configuration
 * - Action services for specific operations
 *
 * @example
 * ```javascript
 * import { Effect, Layer } from 'effect'
 * import { EthActionsService, EthActionsLive } from '@tevm/decorators-effect'
 * import { StateManagerLocal } from '@tevm/state-effect'
 * import { VmLive } from '@tevm/vm-effect'
 * import { CommonFromConfig } from '@tevm/common-effect'
 * import { BlockchainLocal } from '@tevm/blockchain-effect'
 * import { EvmLive } from '@tevm/evm-effect'
 *
 * // Build layer composition (VmLive requires CommonService, StateManagerService, BlockchainService, EvmService)
 * const commonLayer = CommonFromConfig({ chainId: 1, hardfork: 'prague' })
 * const stateLayer = Layer.provide(StateManagerLocal(), commonLayer)
 * const blockchainLayer = Layer.provide(BlockchainLocal(), commonLayer)
 * const evmLayer = Layer.provide(EvmLive(), Layer.mergeAll(stateLayer, blockchainLayer, commonLayer))
 * const vmLayer = Layer.provide(VmLive(), Layer.mergeAll(evmLayer, stateLayer, blockchainLayer, commonLayer))
 *
 * // Then provide EthActionsLive with its dependencies
 * const fullLayer = Layer.provide(EthActionsLive, Layer.mergeAll(vmLayer, stateLayer, commonLayer))
 *
 * const program = Effect.gen(function* () {
 *   const ethActions = yield* EthActionsService
 *   return yield* ethActions.blockNumber()
 * })
 *
 * await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
 * ```
 *
 */
export const EthActionsLive = /** @type {Layer.Layer<import('./EthActionsService.js').EthActionsServiceId, never, import('@tevm/vm-effect').VmService | import('@tevm/evm-effect').EvmService | import('@tevm/common-effect').CommonService | import('@tevm/blockchain-effect').BlockchainService | import('@tevm/actions-effect').GetBalanceService | import('@tevm/actions-effect').GetCodeService | import('@tevm/actions-effect').GetStorageAtService>} */ (Layer.effect(
	EthActionsService,
	Effect.gen(function* () {
		const vm = yield* VmService
		const evm = yield* EvmService
		const common = yield* CommonService
		const blockchain = yield* BlockchainService
		const getBalanceService = yield* GetBalanceService
		const getCodeService = yield* GetCodeService
		const getStorageAtService = yield* GetStorageAtService

		return /** @type {import('./types.js').EthActionsShape} */ ({
			blockNumber: () =>
				Effect.gen(function* () {
					// Use BlockchainService for proper service abstraction (RFC §4.2)
					const block = yield* blockchain.getCanonicalHeadBlock().pipe(
						Effect.mapError(
							(e) =>
								new InternalError({
									message: `Failed to get block: ${e instanceof Error ? e.message : String(e)}`,
									cause: e instanceof Error ? e : undefined,
								})
						)
					)
					return block.header.number
				}),

			call: (params) =>
				Effect.gen(function* () {
					// Execute call using EVM's runCall directly for simulation
					// This doesn't require a signed transaction - it's a stateless call
					/**
					 * Converts hex string to bytes with validation
					 * @throws {Error} If hex string contains invalid characters
					 */
					const hexToBytes = (/** @type {string | undefined} */ hex) => {
						if (!hex || hex === '0x') return new Uint8Array()
						const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
						// Validate hex characters before processing (Issue #75 fix)
						if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
							throw new Error(`Invalid hex string: contains non-hex characters in "${hex}"`)
						}
						const normalizedHex = cleanHex.length % 2 === 1 ? '0' + cleanHex : cleanHex
						const bytes = new Uint8Array(normalizedHex.length / 2)
						for (let i = 0; i < bytes.length; i++) {
							bytes[i] = parseInt(normalizedHex.substring(i * 2, i * 2 + 2), 16)
						}
						return bytes
					}

					const { createAddress } = yield* Effect.tryPromise({
						try: () => import('@tevm/address'),
						catch: (e) =>
							new InternalError({
								message: `Failed to import @tevm/address: ${e instanceof Error ? e.message : String(e)}`,
								cause: e instanceof Error ? e : undefined,
							}),
					})

					// Convert data parameter using Effect.try to capture validation errors (Issue #298)
					const dataBytes = yield* Effect.try({
						try: () => hexToBytes(params.data),
						catch: (e) =>
							new InvalidParamsError({
								message: `Invalid 'data' parameter: ${e instanceof Error ? e.message : String(e)}`,
								method: 'eth_call',
								cause: e instanceof Error ? e : undefined,
							}),
					})

					// Prepare call options for EVM runCall
					/** @type {Record<string, unknown>} */
					const callOpts = {
						data: dataBytes,
						gasLimit: params.gas ?? 30000000n,
						gasPrice: params.gasPrice ?? 0n,
						value: params.value ?? 0n,
					}
					// Wrap createAddress calls in Effect.try to capture validation errors (Issue #163)
					if (params.to) {
						callOpts['to'] = yield* Effect.try({
							try: () => createAddress(params.to),
							catch: (e) =>
								new InvalidParamsError({
									message: `Invalid 'to' address: ${e instanceof Error ? e.message : String(e)}`,
									method: 'eth_call',
									cause: e instanceof Error ? e : undefined,
								}),
						})
					}
					if (params.from) {
						const fromAddress = yield* Effect.try({
							try: () => createAddress(params.from),
							catch: (e) =>
								new InvalidParamsError({
									message: `Invalid 'from' address: ${e instanceof Error ? e.message : String(e)}`,
									method: 'eth_call',
									cause: e instanceof Error ? e : undefined,
								}),
						})
						callOpts['caller'] = fromAddress
						callOpts['origin'] = fromAddress
					}

					const result = yield* evm.runCall(/** @type {any} */ (callOpts)).pipe(
						Effect.mapError((e) =>
							new InternalError({
								message: `eth_call failed: ${e instanceof Error ? e.message : String(e)}`,
								cause: e instanceof Error ? e : undefined,
							})
						)
					)

					// Convert result to hex string (browser-compatible implementation)
					const bytesToHex = (/** @type {Uint8Array} */ bytes) => {
						if (!bytes || bytes.length === 0) return '0x'
						let hex = '0x'
						for (let i = 0; i < bytes.length; i++) {
							const byte = bytes[i]
							if (byte !== undefined) {
								hex += byte.toString(16).padStart(2, '0')
							}
						}
						return hex
					}

					const execResult = result.execResult

					// Check for EVM execution errors (Issue #73 fix)
					// execResult.exceptionError contains the error if the call failed
					if (execResult?.exceptionError) {
						const error = execResult.exceptionError
						const errorName = error.error || 'unknown'
						const returnData = bytesToHex(execResult.returnValue ?? new Uint8Array())

						// Map EVM error types to typed Effect errors for proper observability
						if (errorName === 'revert') {
							return yield* Effect.fail(
								new RevertError({
									raw: returnData !== '0x' ? /** @type {`0x${string}`} */ (returnData) : undefined,
									reason: error.message,
									message: error.message || 'Execution reverted',
								}),
							)
						} else if (errorName === 'out of gas') {
							return yield* Effect.fail(
								new OutOfGasError({
									message: error.message || 'Out of gas',
								}),
							)
						} else if (errorName === 'invalid opcode') {
							return yield* Effect.fail(
								new InvalidOpcodeError({
									opcode: 0,
									message: error.message || 'Invalid opcode',
								}),
							)
						} else {
							// Fallback for other EVM errors
							return yield* Effect.fail(
								new InternalError({
									message: `EVM execution failed: ${error.message || errorName}`,
									cause: error,
								}),
							)
						}
					}

					return bytesToHex(execResult?.returnValue ?? new Uint8Array())
				}),

			chainId: () => Effect.succeed(BigInt(common.chainId)),

			gasPrice: () =>
				Effect.gen(function* () {
					// Default gas price (1 gwei) for in-memory simulation
					// Note: In a real Ethereum network, gas price would be dynamically
					// calculated based on network conditions. For local in-memory execution,
					// a fixed value is appropriate as there's no network congestion to model.
					return 1000000000n
				}),

			getBalance: (params) => getBalanceService.getBalance(params),

			getCode: (params) => getCodeService.getCode(params),

			getStorageAt: (params) => getStorageAtService.getStorageAt(params),

			estimateGas: (params) =>
				Effect.gen(function* () {
					// Use eth_call internally but extract gas estimate
					// For estimation, we use a high gas limit and measure usage
					/**
					 * Converts hex string to bytes with validation
					 * @throws {Error} If hex string contains invalid characters
					 */
					const hexToBytes = (/** @type {string | undefined} */ hex) => {
						if (!hex || hex === '0x') return new Uint8Array()
						const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
						if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
							throw new Error(`Invalid hex string: contains non-hex characters in "${hex}"`)
						}
						const normalizedHex = cleanHex.length % 2 === 1 ? '0' + cleanHex : cleanHex
						const bytes = new Uint8Array(normalizedHex.length / 2)
						for (let i = 0; i < bytes.length; i++) {
							bytes[i] = parseInt(normalizedHex.substring(i * 2, i * 2 + 2), 16)
						}
						return bytes
					}

					const { createAddress } = yield* Effect.tryPromise({
						try: () => import('@tevm/address'),
						catch: (e) =>
							new InternalError({
								message: `Failed to import @tevm/address: ${e instanceof Error ? e.message : String(e)}`,
								cause: e instanceof Error ? e : undefined,
							}),
					})

					const dataBytes = yield* Effect.try({
						try: () => hexToBytes(params.data),
						catch: (e) =>
							new InvalidParamsError({
								message: `Invalid 'data' parameter: ${e instanceof Error ? e.message : String(e)}`,
								method: 'eth_estimateGas',
								cause: e instanceof Error ? e : undefined,
							}),
					})

					/** @type {Record<string, unknown>} */
					const callOpts = {
						data: dataBytes,
						gasLimit: params.gas ?? 30000000n,
						gasPrice: params.gasPrice ?? 0n,
						value: params.value ?? 0n,
					}

					if (params.to) {
						callOpts['to'] = yield* Effect.try({
							try: () => createAddress(params.to),
							catch: (e) =>
								new InvalidParamsError({
									message: `Invalid 'to' address: ${e instanceof Error ? e.message : String(e)}`,
									method: 'eth_estimateGas',
									cause: e instanceof Error ? e : undefined,
								}),
						})
					}
					if (params.from) {
						const fromAddress = yield* Effect.try({
							try: () => createAddress(params.from),
							catch: (e) =>
								new InvalidParamsError({
									message: `Invalid 'from' address: ${e instanceof Error ? e.message : String(e)}`,
									method: 'eth_estimateGas',
									cause: e instanceof Error ? e : undefined,
								}),
						})
						callOpts['caller'] = fromAddress
						callOpts['origin'] = fromAddress
					}

					const result = yield* evm.runCall(/** @type {any} */ (callOpts)).pipe(
						Effect.mapError((e) =>
							new InternalError({
								message: `eth_estimateGas failed: ${e instanceof Error ? e.message : String(e)}`,
								cause: e instanceof Error ? e : undefined,
							})
						)
					)

					const execResult = result.execResult

					// Check for errors
					if (execResult?.exceptionError) {
						const error = execResult.exceptionError
						const errorName = error.error || 'unknown'
						const bytesToHex = (/** @type {Uint8Array} */ bytes) => {
							if (!bytes || bytes.length === 0) return '0x'
							let hex = '0x'
							for (let i = 0; i < bytes.length; i++) {
								const byte = bytes[i]
								if (byte !== undefined) {
									hex += byte.toString(16).padStart(2, '0')
								}
							}
							return hex
						}
						const returnData = bytesToHex(execResult.returnValue ?? new Uint8Array())

						if (errorName === 'revert') {
							return yield* Effect.fail(
								new RevertError({
									raw: returnData !== '0x' ? /** @type {`0x${string}`} */ (returnData) : undefined,
									reason: error.message,
									message: error.message || 'Execution reverted',
								}),
							)
						} else if (errorName === 'out of gas') {
							return yield* Effect.fail(
								new OutOfGasError({
									message: error.message || 'Out of gas',
								}),
							)
						} else {
							return yield* Effect.fail(
								new InternalError({
									message: `EVM execution failed: ${error.message || errorName}`,
									cause: error,
								}),
							)
						}
					}

					// Return gas used with a buffer (similar to how Ethereum nodes do it)
					// executionGasUsed is the gas used by EVM execution (excluding base tx cost)
					// Default to 0n when undefined since base cost is always added below
					const executionGas = execResult?.executionGasUsed ?? 0n
					// Add 21000 for base transaction cost (intrinsic gas)
					const totalGas = executionGas + 21000n
					// Add 10% buffer for estimation safety
					return (totalGas * 110n) / 100n
				}),

			getBlockByNumber: (params) =>
				Effect.gen(function* () {
					const block = yield* blockchain.getBlock(params.blockTag).pipe(
						Effect.catchAll(() => Effect.succeed(null))
					)

					if (!block) {
						return null
					}

					// Convert block to JSON-RPC format
					const bytesToHex = (/** @type {Uint8Array} */ bytes) => {
						if (!bytes || bytes.length === 0) return '0x'
						let hex = '0x'
						for (let i = 0; i < bytes.length; i++) {
							const byte = bytes[i]
							if (byte !== undefined) {
								hex += byte.toString(16).padStart(2, '0')
							}
						}
						return /** @type {`0x${string}`} */ (hex)
					}

					const header = block.header
					return /** @type {import('./types.js').JsonRpcBlock} */ ({
						number: `0x${header.number.toString(16)}`,
						hash: bytesToHex(block.hash()),
						parentHash: bytesToHex(header.parentHash),
						nonce: bytesToHex(header.nonce),
						sha3Uncles: bytesToHex(header.uncleHash),
						logsBloom: bytesToHex(header.logsBloom),
						transactionsRoot: bytesToHex(header.transactionsTrie),
						stateRoot: bytesToHex(header.stateRoot),
						receiptsRoot: bytesToHex(header.receiptTrie),
						miner: `0x${Array.from(header.coinbase.bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`,
						difficulty: `0x${header.difficulty.toString(16)}`,
						totalDifficulty: `0x0`,
						extraData: bytesToHex(header.extraData),
						size: `0x${block.serialize().length.toString(16)}`,
						gasLimit: `0x${header.gasLimit.toString(16)}`,
						gasUsed: `0x${header.gasUsed.toString(16)}`,
						timestamp: `0x${header.timestamp.toString(16)}`,
						transactions: params.includeTransactions
							? block.transactions.map((tx, txIndex) => {
								const txJSON = tx.toJSON()
								const from = tx.getSenderAddress ? tx.getSenderAddress().toString() : '0x0000000000000000000000000000000000000000'
								return /** @type {object} */ ({
									blockHash: bytesToHex(block.hash()),
									blockNumber: `0x${header.number.toString(16)}`,
									from: /** @type {`0x${string}`} */ (from),
									gas: /** @type {`0x${string}`} */ (txJSON.gasLimit ?? '0x0'),
									gasPrice: /** @type {`0x${string}`} */ (txJSON.gasPrice ?? txJSON.maxFeePerGas ?? '0x0'),
									hash: tx.hash ? bytesToHex(tx.hash()) : '0x',
									input: /** @type {`0x${string}`} */ (txJSON.data ?? '0x'),
									nonce: /** @type {`0x${string}`} */ (txJSON.nonce ?? '0x0'),
									to: txJSON.to ? /** @type {`0x${string}`} */ (String(txJSON.to)) : null,
									transactionIndex: `0x${txIndex.toString(16)}`,
									value: /** @type {`0x${string}`} */ (txJSON.value ?? '0x0'),
									type: `0x${tx.type.toString(16)}`,
									v: txJSON.v ?? '0x0',
									r: txJSON.r ?? '0x0',
									s: txJSON.s ?? '0x0',
									...(txJSON.chainId !== undefined ? { chainId: /** @type {`0x${string}`} */ (String(txJSON.chainId)) } : {}),
									...(txJSON.accessList !== undefined ? { accessList: txJSON.accessList } : {}),
									...(txJSON.maxFeePerGas !== undefined ? { maxFeePerGas: /** @type {`0x${string}`} */ (txJSON.maxFeePerGas) } : {}),
									...(txJSON.maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas: /** @type {`0x${string}`} */ (txJSON.maxPriorityFeePerGas) } : {}),
									...(txJSON.maxFeePerBlobGas !== undefined ? { maxFeePerBlobGas: /** @type {`0x${string}`} */ (txJSON.maxFeePerBlobGas) } : {}),
									...(txJSON.blobVersionedHashes !== undefined ? { blobVersionedHashes: txJSON.blobVersionedHashes } : {}),
								})
							})
							: block.transactions.map((tx) => tx.hash ? bytesToHex(tx.hash()) : '0x'),
						uncles: block.uncleHeaders?.map((uncle) => bytesToHex(uncle.hash())) ?? [],
					})
				}),

			getBlockByHash: (params) =>
				Effect.gen(function* () {
					const block = yield* blockchain.getBlockByHash(params.blockHash).pipe(
						Effect.catchAll(() => Effect.succeed(null))
					)

					if (!block) {
						return null
					}

					// Convert block to JSON-RPC format
					const bytesToHex = (/** @type {Uint8Array} */ bytes) => {
						if (!bytes || bytes.length === 0) return '0x'
						let hex = '0x'
						for (let i = 0; i < bytes.length; i++) {
							const byte = bytes[i]
							if (byte !== undefined) {
								hex += byte.toString(16).padStart(2, '0')
							}
						}
						return /** @type {`0x${string}`} */ (hex)
					}

					const header = block.header
					return /** @type {import('./types.js').JsonRpcBlock} */ ({
						number: `0x${header.number.toString(16)}`,
						hash: bytesToHex(block.hash()),
						parentHash: bytesToHex(header.parentHash),
						nonce: bytesToHex(header.nonce),
						sha3Uncles: bytesToHex(header.uncleHash),
						logsBloom: bytesToHex(header.logsBloom),
						transactionsRoot: bytesToHex(header.transactionsTrie),
						stateRoot: bytesToHex(header.stateRoot),
						receiptsRoot: bytesToHex(header.receiptTrie),
						miner: `0x${Array.from(header.coinbase.bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`,
						difficulty: `0x${header.difficulty.toString(16)}`,
						totalDifficulty: `0x0`,
						extraData: bytesToHex(header.extraData),
						size: `0x${block.serialize().length.toString(16)}`,
						gasLimit: `0x${header.gasLimit.toString(16)}`,
						gasUsed: `0x${header.gasUsed.toString(16)}`,
						timestamp: `0x${header.timestamp.toString(16)}`,
						transactions: params.includeTransactions
							? block.transactions.map((tx, txIndex) => {
								const txJSON = tx.toJSON()
								const from = tx.getSenderAddress ? tx.getSenderAddress().toString() : '0x0000000000000000000000000000000000000000'
								return /** @type {object} */ ({
									blockHash: bytesToHex(block.hash()),
									blockNumber: `0x${header.number.toString(16)}`,
									from: /** @type {`0x${string}`} */ (from),
									gas: /** @type {`0x${string}`} */ (txJSON.gasLimit ?? '0x0'),
									gasPrice: /** @type {`0x${string}`} */ (txJSON.gasPrice ?? txJSON.maxFeePerGas ?? '0x0'),
									hash: tx.hash ? bytesToHex(tx.hash()) : '0x',
									input: /** @type {`0x${string}`} */ (txJSON.data ?? '0x'),
									nonce: /** @type {`0x${string}`} */ (txJSON.nonce ?? '0x0'),
									to: txJSON.to ? /** @type {`0x${string}`} */ (String(txJSON.to)) : null,
									transactionIndex: `0x${txIndex.toString(16)}`,
									value: /** @type {`0x${string}`} */ (txJSON.value ?? '0x0'),
									type: `0x${tx.type.toString(16)}`,
									v: txJSON.v ?? '0x0',
									r: txJSON.r ?? '0x0',
									s: txJSON.s ?? '0x0',
									...(txJSON.chainId !== undefined ? { chainId: /** @type {`0x${string}`} */ (String(txJSON.chainId)) } : {}),
									...(txJSON.accessList !== undefined ? { accessList: txJSON.accessList } : {}),
									...(txJSON.maxFeePerGas !== undefined ? { maxFeePerGas: /** @type {`0x${string}`} */ (txJSON.maxFeePerGas) } : {}),
									...(txJSON.maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas: /** @type {`0x${string}`} */ (txJSON.maxPriorityFeePerGas) } : {}),
									...(txJSON.maxFeePerBlobGas !== undefined ? { maxFeePerBlobGas: /** @type {`0x${string}`} */ (txJSON.maxFeePerBlobGas) } : {}),
									...(txJSON.blobVersionedHashes !== undefined ? { blobVersionedHashes: txJSON.blobVersionedHashes } : {}),
								})
							})
							: block.transactions.map((tx) => tx.hash ? bytesToHex(tx.hash()) : '0x'),
						uncles: block.uncleHeaders?.map((uncle) => bytesToHex(uncle.hash())) ?? [],
					})
				}),

			accounts: () => Effect.succeed([]),

			netVersion: () => Effect.succeed(String(common.chainId)),

			web3ClientVersion: () => Effect.succeed('tevm/1.0.0'),
		})
	})
))
