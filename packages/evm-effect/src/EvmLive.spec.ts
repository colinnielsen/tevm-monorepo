import { describe, it, expect } from 'vitest'
import { Effect, Layer, Exit } from 'effect'
import { EvmService } from './EvmService.js'
import { EvmLive } from './EvmLive.js'
import { CommonLocal } from '@tevm/common-effect'
import { StateManagerService, StateManagerLocal } from '@tevm/state-effect'
import { BlockchainService, BlockchainLocal } from '@tevm/blockchain-effect'
import { createAddressFromString } from '@tevm/utils'

describe('EvmLive', () => {
	describe('layer creation', () => {
		it('should create a layer that provides EvmService', () => {
			const layer = EvmLive()
			expect(layer).toBeDefined()
		})

		it('should require CommonService, StateManagerService, and BlockchainService dependencies', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				return evmService
			})

			// Should fail without dependencies
			const layer = EvmLive()
			const exit = await Effect.runPromiseExit(
				program.pipe(Effect.provide(layer as unknown as Layer.Layer<EvmService>)),
			)
			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should accept EvmLiveOptions with allowUnlimitedContractSize', () => {
			const layer = EvmLive({
				allowUnlimitedContractSize: true,
			})
			expect(layer).toBeDefined()
		})

		it('should accept EvmLiveOptions with profiler', () => {
			const layer = EvmLive({
				profiler: true,
			})
			expect(layer).toBeDefined()
		})

		it('should accept EvmLiveOptions with loggingEnabled', () => {
			const layer = EvmLive({
				loggingEnabled: true,
			})
			expect(layer).toBeDefined()
		})

		it('should accept empty EvmLiveOptions', () => {
			const layer = EvmLive({})
			expect(layer).toBeDefined()
		})
	})

	describe('with full dependencies', () => {
		// Build the layer stack
		const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
		const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
		const fullLayer = Layer.provide(
			EvmLive(),
			Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal),
		)

		it('should create a working EVM service', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				expect(evmService).toBeDefined()
				expect(evmService.evm).toBeDefined()
				return 'success'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('success')
		})

		it('should get active precompiles', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				const precompiles = yield* evmService.getActivePrecompiles()
				return precompiles
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBeDefined()
			expect(result instanceof Map).toBe(true)
		})

		it('should execute runCall', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				// Execute a simple call with no data (just creates empty call)
				const result = yield* evmService.runCall({
					gasLimit: 1000000n,
					skipBalance: true,
				})
				return result
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBeDefined()
			expect(result.execResult).toBeDefined()
		})

		it('should execute runCode', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				// Execute runCode with bytecode (PUSH1 0x42 PUSH1 0x00 MSTORE PUSH1 0x01 PUSH1 0x1F RETURN)
				// This bytecode stores 0x42 at memory and returns 1 byte
				const code = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x01, 0x60, 0x1f, 0xf3])
				const result = yield* evmService.runCode({
					code,
					gasLimit: 1000000n,
				})
				return result
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBeDefined()
			// runCode returns ExecResult directly (not wrapped in EVMResult)
			expect(result.executionGasUsed).toBeDefined()
		})

		it('should add and remove custom precompile', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				// Create a mock precompile
				const mockPrecompile = {
					address: createAddressFromString('0x0000000000000000000000000000000000000020'),
					function: async () => ({ returnValue: new Uint8Array(), executionGasUsed: 0n }),
				}
				// Add the precompile
				yield* evmService.addCustomPrecompile(mockPrecompile as any)
				// Remove the precompile
				yield* evmService.removeCustomPrecompile(mockPrecompile as any)
				return 'precompile added and removed'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('precompile added and removed')
		})

		it('should expose the underlying evm instance', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				expect(evmService.evm).toBeDefined()
				expect(typeof evmService.evm.runCall).toBe('function')
				return 'evm exposed'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('evm exposed')
		})

		it('should execute call with value transfer', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				const to = createAddressFromString('0x1234567890123456789012345678901234567890')
				const result = yield* evmService.runCall({
					to: to as any,
					value: 100n,
					gasLimit: 1000000n,
					skipBalance: true,
				})
				return result
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBeDefined()
			expect(result.execResult).toBeDefined()
		})
	})

	describe('with loggingEnabled option', () => {
		// Build the layer stack with loggingEnabled
		const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
		const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
		const fullLayerWithLogging = Layer.provide(
			EvmLive({ loggingEnabled: true }),
			Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal),
		)

		it('should work with loggingEnabled true', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				expect(evmService).toBeDefined()
				const precompiles = yield* evmService.getActivePrecompiles()
				return precompiles
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayerWithLogging)))
			expect(result).toBeDefined()
		})
	})

	describe('exports', () => {
		it('should export EvmLive from the module', async () => {
			const { EvmLive: ExportedEvmLive } = await import('./EvmLive.js')
			expect(ExportedEvmLive).toBeDefined()
			expect(typeof ExportedEvmLive).toBe('function')
		})

		it('should export mapEvmError from the module', async () => {
			const { mapEvmError } = await import('./index.js')
			expect(mapEvmError).toBeDefined()
			expect(typeof mapEvmError).toBe('function')
		})
	})

	describe('deepCopy and shallowCopy', () => {
		// Build the layer stack
		const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
		const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
		const fullLayer = Layer.provide(
			EvmLive(),
			Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal),
		)

		it('should create a shallow copy with shallowCopy', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				// #R140-P2-007 fix: shallowCopy now returns an Effect for consistent error handling
				const shallowCopiedService = yield* evmService.shallowCopy()
				// Verify it has all the expected methods
				expect(shallowCopiedService).toBeDefined()
				expect(shallowCopiedService.evm).toBeDefined()
				expect(shallowCopiedService.runCall).toBeDefined()
				expect(shallowCopiedService.runCode).toBeDefined()
				expect(shallowCopiedService.getActivePrecompiles).toBeDefined()
				expect(shallowCopiedService.addCustomPrecompile).toBeDefined()
				expect(shallowCopiedService.removeCustomPrecompile).toBeDefined()
				expect(shallowCopiedService.deepCopy).toBeDefined()
				expect(shallowCopiedService.shallowCopy).toBeDefined()
				// The shallow copied evm is a separate instance
				expect(shallowCopiedService.evm).not.toBe(evmService.evm)
				return 'shallow copy created'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('shallow copy created')
		})

		it('should create a deep copy with deepCopy', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				// Create a deep copy
				const deepCopiedService = yield* evmService.deepCopy()
				// Verify it has all the expected methods
				expect(deepCopiedService).toBeDefined()
				expect(deepCopiedService.evm).toBeDefined()
				expect(deepCopiedService.runCall).toBeDefined()
				expect(deepCopiedService.runCode).toBeDefined()
				expect(deepCopiedService.getActivePrecompiles).toBeDefined()
				expect(deepCopiedService.addCustomPrecompile).toBeDefined()
				expect(deepCopiedService.removeCustomPrecompile).toBeDefined()
				expect(deepCopiedService.deepCopy).toBeDefined()
				expect(deepCopiedService.shallowCopy).toBeDefined()
				// Deep copy has its own stateManager and blockchain (not the same references)
				expect(deepCopiedService.evm.stateManager).not.toBe(evmService.evm.stateManager)
				expect(deepCopiedService.evm.blockchain).not.toBe(evmService.evm.blockchain)
				return 'deep copy created'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('deep copy created')
		})

		it('should execute runCall on shallow copy', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				// #R140-P2-007 fix: shallowCopy now returns an Effect
				const shallowCopiedService = yield* evmService.shallowCopy()
				// Execute a call on the shallow copy
				const result = yield* shallowCopiedService.runCall({
					gasLimit: 1000000n,
					skipBalance: true,
				})
				return result
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBeDefined()
			expect(result.execResult).toBeDefined()
		})

		it('should execute runCall on deep copy', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				const deepCopiedService = yield* evmService.deepCopy()
				// Execute a call on the deep copy
				const result = yield* deepCopiedService.runCall({
					gasLimit: 1000000n,
					skipBalance: true,
				})
				return result
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBeDefined()
			expect(result.execResult).toBeDefined()
		})

		it('should recursively create copies from copies', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				// #R140-P2-007 fix: shallowCopy now returns an Effect
				// Create a shallow copy, then create a shallow copy of that
				const shallowCopy1 = yield* evmService.shallowCopy()
				const shallowCopy2 = yield* shallowCopy1.shallowCopy()
				expect(shallowCopy2).toBeDefined()
				// Each shallow copy is a separate EVM instance
				expect(shallowCopy2.evm).not.toBe(evmService.evm)
				expect(shallowCopy2.evm).not.toBe(shallowCopy1.evm)

				// Create a deep copy, then create a deep copy of that
				const deepCopy1 = yield* evmService.deepCopy()
				const deepCopy2 = yield* deepCopy1.deepCopy()
				expect(deepCopy2).toBeDefined()
				// Each deep copy has its own state
				expect(deepCopy2.evm.stateManager).not.toBe(evmService.evm.stateManager)
				expect(deepCopy2.evm.stateManager).not.toBe(deepCopy1.evm.stateManager)
				return 'nested copies created'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('nested copies created')
		})
	})

	describe('error handling', () => {
		// Build the layer stack
		const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
		const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
		const fullLayer = Layer.provide(
			EvmLive(),
			Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal),
		)

		it('should map runCall errors through mapEvmError', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				// Mock the underlying evm.runCall to throw
				const originalRunCall = evmService.evm.runCall
				evmService.evm.runCall = async () => {
					throw new Error('Out of gas during call')
				}
				// Try to run call - should fail with mapped error
				const result = yield* evmService.runCall({
					gasLimit: 1000000n,
				})
				// Restore original
				evmService.evm.runCall = originalRunCall
				return result
			})

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(fullLayer)))
			expect(Exit.isFailure(exit)).toBe(true)
			if (Exit.isFailure(exit)) {
				const error = exit.cause
				// Verify the error was mapped
				expect(error).toBeDefined()
			}
		})

		it('should map runCode errors through mapEvmError', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				// Mock the underlying evm.runCode to throw
				const originalRunCode = evmService.evm.runCode
				evmService.evm.runCode = async () => {
					throw new Error('Invalid opcode in bytecode')
				}
				// Try to run code - should fail with mapped error
				const result = yield* evmService.runCode({
					code: new Uint8Array([0xff]), // invalid opcode
					gasLimit: 1000000n,
				})
				// Restore original
				evmService.evm.runCode = originalRunCode
				return result
			})

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(fullLayer)))
			expect(Exit.isFailure(exit)).toBe(true)
			if (Exit.isFailure(exit)) {
				const error = exit.cause
				// Verify the error was mapped
				expect(error).toBeDefined()
			}
		})

		it('should map deepCopy stateManager errors through mapEvmError', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				// Mock the underlying stateManager.deepCopy to throw
				const originalDeepCopy = evmService.evm.stateManager.deepCopy
				evmService.evm.stateManager.deepCopy = async () => {
					throw new Error('Failed to deep copy state manager')
				}
				// Try to deep copy - should fail with mapped error
				const result = yield* evmService.deepCopy()
				// Restore original
				evmService.evm.stateManager.deepCopy = originalDeepCopy
				return result
			})

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(fullLayer)))
			expect(Exit.isFailure(exit)).toBe(true)
			if (Exit.isFailure(exit)) {
				const error = exit.cause
				expect(error).toBeDefined()
			}
		})

		it('should map deepCopy blockchain errors through mapEvmError', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				// Mock the underlying blockchain.deepCopy to throw
				const originalDeepCopy = evmService.evm.blockchain.deepCopy
				evmService.evm.blockchain.deepCopy = async () => {
					throw new Error('Failed to deep copy blockchain')
				}
				// Try to deep copy - should fail with mapped error
				const result = yield* evmService.deepCopy()
				// Restore original
				evmService.evm.blockchain.deepCopy = originalDeepCopy
				return result
			})

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(fullLayer)))
			expect(Exit.isFailure(exit)).toBe(true)
			if (Exit.isFailure(exit)) {
				const error = exit.cause
				expect(error).toBeDefined()
			}
		})
	})

	describe('deepCopy with loggingEnabled', () => {
		// Build the layer stack with loggingEnabled
		const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
		const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
		const fullLayerWithLogging = Layer.provide(
			EvmLive({ loggingEnabled: true }),
			Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal),
		)

		it('should deep copy with loggingEnabled option', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				// Create a deep copy to test loggingEnabled path in deepCopy
				const deepCopiedService = yield* evmService.deepCopy()
				expect(deepCopiedService).toBeDefined()
				return 'deep copy with logging created'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayerWithLogging)))
			expect(result).toBe('deep copy with logging created')
		})
	})

	describe('deepCopy fallback paths', () => {
		const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
		const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
		const fullLayer = Layer.provide(
			EvmLive(),
			Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal),
		)

		it('should use fallback values when evm properties are undefined', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				// Mock the EVM instance to have undefined properties to trigger ?? fallbacks
				const evmAny = evmService.evm as any
				const originalAllowUnlimited = evmAny.allowUnlimitedContractSize
				const originalCustomPrecompiles = evmAny._customPrecompiles
				const originalOptsCached = evmAny.optsCached

				// Set properties to undefined to trigger fallbacks
				evmAny.allowUnlimitedContractSize = undefined
				evmAny._customPrecompiles = undefined
				evmAny.optsCached = undefined

				// Now deep copy - this should use the ?? fallback values
				const deepCopiedService = yield* evmService.deepCopy()
				expect(deepCopiedService).toBeDefined()

				// Restore original values
				evmAny.allowUnlimitedContractSize = originalAllowUnlimited
				evmAny._customPrecompiles = originalCustomPrecompiles
				evmAny.optsCached = originalOptsCached

				return 'fallback paths tested'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('fallback paths tested')
		})

		it('should handle when profiler exists but enabled is undefined', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				const evmAny = evmService.evm as any
				const originalOptsCached = evmAny.optsCached

				// Set optsCached.profiler to exist but have undefined enabled
				evmAny.optsCached = { profiler: {} }

				const deepCopiedService = yield* evmService.deepCopy()
				expect(deepCopiedService).toBeDefined()

				// Restore
				evmAny.optsCached = originalOptsCached

				return 'profiler path tested'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('profiler path tested')
		})

		it('should handle when optsCached.profiler.enabled is true', async () => {
			const program = Effect.gen(function* () {
				const evmService = yield* EvmService
				const evmAny = evmService.evm as any
				const originalOptsCached = evmAny.optsCached

				// Set optsCached.profiler.enabled to true
				evmAny.optsCached = { profiler: { enabled: true } }

				const deepCopiedService = yield* evmService.deepCopy()
				expect(deepCopiedService).toBeDefined()

				// Restore
				evmAny.optsCached = originalOptsCached

				return 'profiler enabled path tested'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('profiler enabled path tested')
		})
	})
})
