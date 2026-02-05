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
import { StateManagerService } from '@tevm/state-effect'
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
export const EthActionsLive = /** @type {Layer.Layer<import('./EthActionsService.js').EthActionsServiceId, never, import('@tevm/vm-effect').VmService | import('@tevm/evm-effect').EvmService | import('@tevm/common-effect').CommonService | import('@tevm/blockchain-effect').BlockchainService | import('@tevm/actions-effect').GetBalanceService | import('@tevm/actions-effect').GetCodeService | import('@tevm/actions-effect').GetStorageAtService | import('@tevm/state-effect').StateManagerService>} */ (Layer.effect(
	EthActionsService,
	Effect.gen(function* () {
		const vm = yield* VmService
		const evm = yield* EvmService
		const common = yield* CommonService
		const blockchain = yield* BlockchainService
		const getBalanceService = yield* GetBalanceService
		const getCodeService = yield* GetCodeService
		const getStorageAtService = yield* GetStorageAtService
		const stateManager = yield* StateManagerService

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
					// #R153-P4-002 fix: Use state checkpointing to ensure call doesn't persist state changes
					// eth_call is a read-only simulation that should not modify state
					yield* stateManager.checkpoint()

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
				}).pipe(
					// #R153-P4-002 fix: Always revert state after eth_call completes (success or failure)
					// This ensures read-only simulation behavior per EIP-1193
					Effect.ensuring(stateManager.revert())
				),

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
					// Contract creation uses 53000n intrinsic gas (21000 base + 32000 CREATE per EIP-2)
					// Regular transactions use 21000n base transaction cost (#R139-P4-003 fix)
					const isContractCreation = !params.to
					const intrinsicGas = isContractCreation ? 53000n : 21000n

					// #R140-P4-001 fix: Calculate calldata gas costs per EIP-2028
					// 4 gas per zero byte, 16 gas per non-zero byte
					let calldataGas = 0n
					for (let i = 0; i < dataBytes.length; i++) {
						// @ts-expect-error - dataBytes indexing may return undefined but we're in bounds
						calldataGas += dataBytes[i] === 0 ? 4n : 16n
					}

					const totalGas = executionGas + intrinsicGas + calldataGas
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

					// #R149-P4-005 fix: Safe hash getter - wrap hash() calls in try-catch to prevent crashes from malformed data
					const safeHash = (/** @type {{ hash?: () => Uint8Array }} */ obj) => {
						if (!obj || typeof obj.hash !== 'function') return null
						try {
							return bytesToHex(obj.hash())
						} catch {
							// Malformed transaction/block/uncle - return null instead of crashing
							return null
						}
					}

					const header = block.header
					// #R149-P4-005 fix: Use safeHash for block hash to prevent crashes
					const blockHash = safeHash(block)
					return /** @type {import('./types.js').JsonRpcBlock} */ ({
						number: `0x${header.number.toString(16)}`,
						hash: blockHash ?? '0x',
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
						// #R148-P4-001 fix: Add post-London/Shanghai/Cancun block fields per JSON-RPC spec
						...(header.baseFeePerGas !== undefined && header.baseFeePerGas !== null
							? { baseFeePerGas: `0x${header.baseFeePerGas.toString(16)}` }
							: {}),
						// mixHash is prevRandao post-merge
						...(header.mixHash !== undefined ? { mixHash: bytesToHex(header.mixHash) } : {}),
						// Shanghai fields (EIP-4895)
						...(header.withdrawalsRoot !== undefined
							? {
									withdrawalsRoot: bytesToHex(header.withdrawalsRoot),
									withdrawals: block.withdrawals?.map((w) => ({
										index: `0x${w.index.toString(16)}`,
										validatorIndex: `0x${w.validatorIndex.toString(16)}`,
										address: `0x${Array.from(w.address.bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`,
										amount: `0x${w.amount.toString(16)}`,
									})) ?? [],
								}
							: {}),
						// Cancun fields (EIP-4844)
						...(header.blobGasUsed !== undefined ? { blobGasUsed: `0x${header.blobGasUsed.toString(16)}` } : {}),
						...(header.excessBlobGas !== undefined ? { excessBlobGas: `0x${header.excessBlobGas.toString(16)}` } : {}),
						...(header.parentBeaconBlockRoot !== undefined ? { parentBeaconBlockRoot: bytesToHex(header.parentBeaconBlockRoot) } : {}),
						transactions: params.includeTransactions
							? block.transactions.map((tx, txIndex) => {
								const txJSON = tx.toJSON()
								// Wrap getSenderAddress in try-catch to handle unsigned/invalid transactions gracefully
								let from = '0x0000000000000000000000000000000000000000'
								if (tx.getSenderAddress) {
									try {
										from = tx.getSenderAddress().toString()
									} catch {
										// Transaction is unsigned or has invalid signature - use zero address
									}
								}
								// #R148-P4-002 fix: For typed transactions (type > 0), compute yParity from v value
								// yParity is 0 or 1, derived from v. For EIP-2930/1559/4844, v is 0 or 1 directly (or 27/28 legacy encoding)
								// #R149-P4-006 fix: Handle EIP-155 v values where v = chainId * 2 + 35 + yParity
								const computeYParity = () => {
									if (tx.type === 0) return undefined // Legacy transactions don't use yParity
									const v = txJSON.v ? BigInt(txJSON.v) : 0n
									// For typed transactions, v is typically 0 or 1
									// Some implementations may still use 27/28 encoding
									if (v === 0n || v === 27n) return '0x0'
									if (v === 1n || v === 28n) return '0x1'
									// EIP-155 v values: v = chainId * 2 + 35 + yParity
									// For v > 36, use (v - 35) % 2 to extract yParity correctly
									if (v > 36n) {
										return `0x${((v - 35n) % 2n).toString(16)}`
									}
									// Fallback for other cases: compute v % 2
									return `0x${(v % 2n).toString(16)}`
								}
								const yParity = computeYParity()
								return /** @type {object} */ ({
									// #R149-P4-005 fix: Use cached blockHash to avoid repeated hash() calls
									blockHash: blockHash ?? '0x',
									blockNumber: `0x${header.number.toString(16)}`,
									from: /** @type {`0x${string}`} */ (from),
									gas: /** @type {`0x${string}`} */ (txJSON.gasLimit ?? '0x0'),
									gasPrice: /** @type {`0x${string}`} */ (txJSON.gasPrice ?? txJSON.maxFeePerGas ?? '0x0'),
									// #R149-P4-005 fix: Use safeHash to prevent crashes from malformed transactions
									hash: safeHash(tx),
									input: /** @type {`0x${string}`} */ (txJSON.data ?? '0x'),
									nonce: /** @type {`0x${string}`} */ (txJSON.nonce ?? '0x0'),
									to: txJSON.to ? /** @type {`0x${string}`} */ (String(txJSON.to)) : null,
									transactionIndex: `0x${txIndex.toString(16)}`,
									value: /** @type {`0x${string}`} */ (txJSON.value ?? '0x0'),
									type: `0x${tx.type.toString(16)}`,
									v: txJSON.v ?? '0x0',
									r: txJSON.r ?? '0x0',
									s: txJSON.s ?? '0x0',
									// #R148-P4-002 fix: Add yParity for typed transactions per JSON-RPC spec
									...(yParity !== undefined ? { yParity } : {}),
									// #R146-P4-001 fix: Convert chainId to hex (not decimal string) per JSON-RPC spec
									...(txJSON.chainId !== undefined ? { chainId: /** @type {`0x${string}`} */ (`0x${BigInt(txJSON.chainId).toString(16)}`) } : {}),
									...(txJSON.accessList !== undefined ? { accessList: txJSON.accessList } : {}),
									...(txJSON.maxFeePerGas !== undefined ? { maxFeePerGas: /** @type {`0x${string}`} */ (txJSON.maxFeePerGas) } : {}),
									...(txJSON.maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas: /** @type {`0x${string}`} */ (txJSON.maxPriorityFeePerGas) } : {}),
									...(txJSON.maxFeePerBlobGas !== undefined ? { maxFeePerBlobGas: /** @type {`0x${string}`} */ (txJSON.maxFeePerBlobGas) } : {}),
									...(txJSON.blobVersionedHashes !== undefined ? { blobVersionedHashes: txJSON.blobVersionedHashes } : {}),
								})
							})
							// #R149-P4-005 fix: Use safeHash to prevent crashes from malformed transactions
							// #R153-P4-003 fix: Filter out null values from malformed transactions
							: block.transactions.map((tx) => safeHash(tx)).filter((hash) => hash !== null),
						// #R149-P4-005 fix: Use safeHash for uncle hashes to prevent crashes
						// #R153-P4-003 fix: Filter out null values from malformed uncle headers
						uncles: (block.uncleHeaders?.map((uncle) => safeHash(uncle)) ?? []).filter((hash) => hash !== null),
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

					// #R149-P4-005 fix: Safe hash getter - wrap hash() calls in try-catch to prevent crashes from malformed data
					const safeHash = (/** @type {{ hash?: () => Uint8Array }} */ obj) => {
						if (!obj || typeof obj.hash !== 'function') return null
						try {
							return bytesToHex(obj.hash())
						} catch {
							// Malformed transaction/block/uncle - return null instead of crashing
							return null
						}
					}

					const header = block.header
					// #R149-P4-005 fix: Use safeHash for block hash to prevent crashes
					const blockHash = safeHash(block)
					return /** @type {import('./types.js').JsonRpcBlock} */ ({
						number: `0x${header.number.toString(16)}`,
						hash: blockHash ?? '0x',
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
						// #R148-P4-001 fix: Add post-London/Shanghai/Cancun block fields per JSON-RPC spec
						...(header.baseFeePerGas !== undefined && header.baseFeePerGas !== null
							? { baseFeePerGas: `0x${header.baseFeePerGas.toString(16)}` }
							: {}),
						// mixHash is prevRandao post-merge
						...(header.mixHash !== undefined ? { mixHash: bytesToHex(header.mixHash) } : {}),
						// Shanghai fields (EIP-4895)
						...(header.withdrawalsRoot !== undefined
							? {
									withdrawalsRoot: bytesToHex(header.withdrawalsRoot),
									withdrawals: block.withdrawals?.map((w) => ({
										index: `0x${w.index.toString(16)}`,
										validatorIndex: `0x${w.validatorIndex.toString(16)}`,
										address: `0x${Array.from(w.address.bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`,
										amount: `0x${w.amount.toString(16)}`,
									})) ?? [],
								}
							: {}),
						// Cancun fields (EIP-4844)
						...(header.blobGasUsed !== undefined ? { blobGasUsed: `0x${header.blobGasUsed.toString(16)}` } : {}),
						...(header.excessBlobGas !== undefined ? { excessBlobGas: `0x${header.excessBlobGas.toString(16)}` } : {}),
						...(header.parentBeaconBlockRoot !== undefined ? { parentBeaconBlockRoot: bytesToHex(header.parentBeaconBlockRoot) } : {}),
						transactions: params.includeTransactions
							? block.transactions.map((tx, txIndex) => {
								const txJSON = tx.toJSON()
								// Wrap getSenderAddress in try-catch to handle unsigned/invalid transactions gracefully
								let from = '0x0000000000000000000000000000000000000000'
								if (tx.getSenderAddress) {
									try {
										from = tx.getSenderAddress().toString()
									} catch {
										// Transaction is unsigned or has invalid signature - use zero address
									}
								}
								// #R148-P4-002 fix: For typed transactions (type > 0), compute yParity from v value
								// yParity is 0 or 1, derived from v. For EIP-2930/1559/4844, v is 0 or 1 directly (or 27/28 legacy encoding)
								// #R149-P4-006 fix: Handle EIP-155 v values where v = chainId * 2 + 35 + yParity
								const computeYParity = () => {
									if (tx.type === 0) return undefined // Legacy transactions don't use yParity
									const v = txJSON.v ? BigInt(txJSON.v) : 0n
									// For typed transactions, v is typically 0 or 1
									// Some implementations may still use 27/28 encoding
									if (v === 0n || v === 27n) return '0x0'
									if (v === 1n || v === 28n) return '0x1'
									// EIP-155 v values: v = chainId * 2 + 35 + yParity
									// For v > 36, use (v - 35) % 2 to extract yParity correctly
									if (v > 36n) {
										return `0x${((v - 35n) % 2n).toString(16)}`
									}
									// Fallback for other cases: compute v % 2
									return `0x${(v % 2n).toString(16)}`
								}
								const yParity = computeYParity()
								return /** @type {object} */ ({
									// #R149-P4-005 fix: Use cached blockHash to avoid repeated hash() calls
									blockHash: blockHash ?? '0x',
									blockNumber: `0x${header.number.toString(16)}`,
									from: /** @type {`0x${string}`} */ (from),
									gas: /** @type {`0x${string}`} */ (txJSON.gasLimit ?? '0x0'),
									gasPrice: /** @type {`0x${string}`} */ (txJSON.gasPrice ?? txJSON.maxFeePerGas ?? '0x0'),
									// #R149-P4-005 fix: Use safeHash to prevent crashes from malformed transactions
									hash: safeHash(tx),
									input: /** @type {`0x${string}`} */ (txJSON.data ?? '0x'),
									nonce: /** @type {`0x${string}`} */ (txJSON.nonce ?? '0x0'),
									to: txJSON.to ? /** @type {`0x${string}`} */ (String(txJSON.to)) : null,
									transactionIndex: `0x${txIndex.toString(16)}`,
									value: /** @type {`0x${string}`} */ (txJSON.value ?? '0x0'),
									type: `0x${tx.type.toString(16)}`,
									v: txJSON.v ?? '0x0',
									r: txJSON.r ?? '0x0',
									s: txJSON.s ?? '0x0',
									// #R148-P4-002 fix: Add yParity for typed transactions per JSON-RPC spec
									...(yParity !== undefined ? { yParity } : {}),
									// #R146-P4-001 fix: Convert chainId to hex (not decimal string) per JSON-RPC spec
									...(txJSON.chainId !== undefined ? { chainId: /** @type {`0x${string}`} */ (`0x${BigInt(txJSON.chainId).toString(16)}`) } : {}),
									...(txJSON.accessList !== undefined ? { accessList: txJSON.accessList } : {}),
									...(txJSON.maxFeePerGas !== undefined ? { maxFeePerGas: /** @type {`0x${string}`} */ (txJSON.maxFeePerGas) } : {}),
									...(txJSON.maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas: /** @type {`0x${string}`} */ (txJSON.maxPriorityFeePerGas) } : {}),
									...(txJSON.maxFeePerBlobGas !== undefined ? { maxFeePerBlobGas: /** @type {`0x${string}`} */ (txJSON.maxFeePerBlobGas) } : {}),
									...(txJSON.blobVersionedHashes !== undefined ? { blobVersionedHashes: txJSON.blobVersionedHashes } : {}),
								})
							})
							// #R149-P4-005 fix: Use safeHash to prevent crashes from malformed transactions
							// #R153-P4-003 fix: Filter out null values from malformed transactions
							: block.transactions.map((tx) => safeHash(tx)).filter((hash) => hash !== null),
						// #R149-P4-005 fix: Use safeHash for uncle hashes to prevent crashes
						// #R153-P4-003 fix: Filter out null values from malformed uncle headers
						uncles: (block.uncleHeaders?.map((uncle) => safeHash(uncle)) ?? []).filter((hash) => hash !== null),
					})
				}),

			accounts: () => Effect.succeed([]),

			netVersion: () => Effect.succeed(String(common.chainId)),

			web3ClientVersion: () => Effect.succeed('tevm/1.0.0'),

			getTransactionCount: (params) =>
				Effect.gen(function* () {
					// Validate address format
					const address = params.address
					if (!address || typeof address !== 'string') {
						return yield* Effect.fail(
							new InvalidParamsError({
								method: 'eth_getTransactionCount',
								params: { address },
								message: 'Address is required and must be a string',
							}),
						)
					}
					if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
						return yield* Effect.fail(
							new InvalidParamsError({
								method: 'eth_getTransactionCount',
								params: { address },
								message: `Invalid address format: ${address}. Must be a 40-character hex string prefixed with 0x`,
							}),
						)
					}

					// Validate blockTag - only 'latest' is supported
					if (params.blockTag !== undefined && params.blockTag !== 'latest') {
						return yield* Effect.fail(
							new InvalidParamsError({
								method: 'eth_getTransactionCount',
								params: { blockTag: params.blockTag },
								message: `Unsupported blockTag: ${String(params.blockTag)}. Only 'latest' is currently supported.`,
							}),
						)
					}

					// Import createAddress for proper address conversion (#R142-P4-001)
					const { createAddress } = yield* Effect.tryPromise({
						try: () => import('@tevm/address'),
						catch: (e) =>
							new InternalError({
								message: `Failed to import @tevm/address: ${e instanceof Error ? e.message : String(e)}`,
								cause: e,
							}),
					})

					// Convert hex string to EthjsAddress object (#R142-P4-001)
					const ethjsAddress = yield* Effect.try({
						try: () => createAddress(address.toLowerCase()),
						catch: (e) =>
							new InvalidParamsError({
								method: 'eth_getTransactionCount',
								params: { address },
								message: `Invalid address: ${e instanceof Error ? e.message : String(e)}`,
							}),
					})

					// Get account from state manager
					const account = yield* stateManager.getAccount(ethjsAddress).pipe(
						Effect.mapError(
							(e) =>
								new InternalError({
									message: `Failed to get account for transaction count: ${e instanceof Error ? e.message : String(e)}`,
									meta: { address, operation: 'getAccount' },
									cause: e,
								}),
						),
					)

					// Return nonce (default to 0 if account doesn't exist)
					return account?.nonce ?? 0n
				}),

			getLogs: (_params) =>
				Effect.gen(function* () {
					// STUB: eth_getLogs requires ReceiptsManager which is not yet available in the Effect stack
					// Full implementation requires:
					// 1. ReceiptsManager service for tracking transaction receipts and logs
					// 2. Fork handling for fetching historical logs from remote RPC
					// 3. Block range iteration and log filtering
					// For now, return empty array as a stub
					// TODO: Implement full getLogs support when ReceiptsManager is available (#R134-P4-007)
					return /** @type {import('./types.js').JsonRpcLog[]} */ ([])
				}),

			// #R148-P4-006 fix: Add eth_getTransactionByHash stub
			getTransactionByHash: (params) =>
				Effect.gen(function* () {
					// Validate hash format
					if (!params.hash || typeof params.hash !== 'string') {
						return yield* Effect.fail(
							new InvalidParamsError({
								method: 'eth_getTransactionByHash',
								params: { hash: params.hash },
								message: 'Transaction hash is required and must be a string',
							}),
						)
					}
					if (!/^0x[a-fA-F0-9]{64}$/.test(params.hash)) {
						return yield* Effect.fail(
							new InvalidParamsError({
								method: 'eth_getTransactionByHash',
								params: { hash: params.hash },
								message: `Invalid transaction hash format: ${params.hash}. Must be a 64-character hex string prefixed with 0x`,
							}),
						)
					}

					// STUB: eth_getTransactionByHash requires ReceiptsManager which is not yet available in the Effect stack
					// Full implementation requires:
					// 1. ReceiptsManager service for looking up transaction by hash
					// 2. BlockchainService for getting the containing block
					// 3. Fork handling for fetching from remote RPC if not found locally
					// For now, return null (transaction not found) as a stub
					// TODO: Implement full getTransactionByHash when ReceiptsManager is available (#R148-P4-006)
					return /** @type {import('./types.js').JsonRpcTransaction | null} */ (null)
				}),

			// #R148-P4-006 fix: Add eth_getTransactionReceipt stub
			getTransactionReceipt: (params) =>
				Effect.gen(function* () {
					// Validate hash format
					if (!params.hash || typeof params.hash !== 'string') {
						return yield* Effect.fail(
							new InvalidParamsError({
								method: 'eth_getTransactionReceipt',
								params: { hash: params.hash },
								message: 'Transaction hash is required and must be a string',
							}),
						)
					}
					if (!/^0x[a-fA-F0-9]{64}$/.test(params.hash)) {
						return yield* Effect.fail(
							new InvalidParamsError({
								method: 'eth_getTransactionReceipt',
								params: { hash: params.hash },
								message: `Invalid transaction hash format: ${params.hash}. Must be a 64-character hex string prefixed with 0x`,
							}),
						)
					}

					// STUB: eth_getTransactionReceipt requires ReceiptsManager which is not yet available in the Effect stack
					// Full implementation requires:
					// 1. ReceiptsManager service for looking up receipt by transaction hash
					// 2. BlockchainService for getting the containing block
					// 3. VM for re-executing the block to compute gas used
					// 4. Fork handling for fetching from remote RPC if not found locally
					// For now, return null (receipt not found) as a stub
					// TODO: Implement full getTransactionReceipt when ReceiptsManager is available (#R148-P4-006)
					return /** @type {import('./types.js').JsonRpcTransactionReceipt | null} */ (null)
				}),
		})
	})
))
