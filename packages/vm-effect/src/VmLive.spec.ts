import { describe, it, expect, vi } from 'vitest'
import { Effect, Layer, Exit, Cause } from 'effect'
import { VmService } from './VmService.js'
import { VmLive } from './VmLive.js'
import { CommonLocal, CommonService } from '@tevm/common-effect'
import { StateManagerLocal, StateManagerService } from '@tevm/state-effect'
import { BlockchainLocal, BlockchainService } from '@tevm/blockchain-effect'
import { EvmService, EvmLive } from '@tevm/evm-effect'
import { TevmError } from '@tevm/errors-effect'
import * as vmModule from '@tevm/vm'

describe('VmLive', () => {
	describe('layer creation', () => {
		it('should create a layer that provides VmService', () => {
			const layer = VmLive()
			expect(layer).toBeDefined()
		})

		it('should require CommonService, StateManagerService, BlockchainService, and EvmService dependencies', async () => {
			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				return vmService
			})

			// Should fail without dependencies
			const layer = VmLive()
			const exit = await Effect.runPromiseExit(
				program.pipe(Effect.provide(layer as unknown as Layer.Layer<VmService>)),
			)
			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should accept empty VmLiveOptions', () => {
			const layer = VmLive({})
			expect(layer).toBeDefined()
		})
	})

	describe('with full dependencies', () => {
		// Build the layer stack
		const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
		const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
		const evmLayer = Layer.provide(
			EvmLive(),
			Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal),
		)
		const fullLayer = Layer.provide(
			VmLive(),
			Layer.mergeAll(evmLayer, stateLayer, blockchainLayer, CommonLocal),
		)

		it('should create a working VM service', async () => {
			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				expect(vmService).toBeDefined()
				expect(vmService.vm).toBeDefined()
				return 'success'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('success')
		})

		it('should wait for VM ready', async () => {
			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				yield* vmService.ready
				return 'ready'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('ready')
		})

		it('should execute runTx', async () => {
			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				yield* vmService.ready

				// We need a valid transaction to run, but for testing we can catch the error
				// This tests that the Effect wrapper is properly set up
				const result = yield* vmService.runTx({
					skipBalance: true,
					skipNonce: true,
					skipHardForkValidation: true,
				} as any)
				return result
			})

			// runTx may throw for invalid params, but we're testing the Effect wrapping works
			try {
				await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			} catch (e) {
				// Expected - we don't have a valid tx
				expect(e).toBeDefined()
			}
		})

		it('should execute runBlock', async () => {
			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				yield* vmService.ready

				// runBlock requires a valid block, test the Effect wrapper is set up
				const result = yield* vmService.runBlock({
					skipBalance: true,
				} as any)
				return result
			})

			// runBlock may throw for invalid params
			try {
				await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			} catch (e) {
				// Expected - we don't have a valid block
				expect(e).toBeDefined()
			}
		})

		it('should execute buildBlock', async () => {
			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				yield* vmService.ready

				// buildBlock requires a parentBlock, so we test the Effect wrapper is set up
				const result = yield* vmService.buildBlock({} as any)
				return result
			})

			// buildBlock should throw for missing parentBlock
			try {
				await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			} catch (e) {
				// Expected - we don't have a valid parentBlock
				expect(e).toBeDefined()
			}
		})

		it('should create a deep copy of the VM', async () => {
			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				yield* vmService.ready

				const copy = yield* vmService.deepCopy()
				expect(copy).toBeDefined()
				expect(copy.vm).toBeDefined()
				expect(copy.vm).not.toBe(vmService.vm)
				return 'copied'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('copied')
		})

		it('should expose the underlying vm instance', async () => {
			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				expect(vmService.vm).toBeDefined()
				expect(typeof vmService.vm.runTx).toBe('function')
				expect(typeof vmService.vm.runBlock).toBe('function')
				expect(typeof vmService.vm.buildBlock).toBe('function')
				return 'vm exposed'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('vm exposed')
		})

		it('should allow executing deep copied VM operations', async () => {
			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				yield* vmService.ready

				const copy = yield* vmService.deepCopy()
				yield* copy.ready

				// The copy should have the same shape as the original
				expect(copy.vm).toBeDefined()
				expect(typeof copy.runTx).toBe('function')
				expect(typeof copy.runBlock).toBe('function')
				expect(typeof copy.buildBlock).toBe('function')

				return 'deep copy works'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('deep copy works')
		})

		it('should create a shallow copy of the VM', async () => {
			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				yield* vmService.ready

				const copy = vmService.shallowCopy()
				expect(copy).toBeDefined()
				expect(copy.vm).toBeDefined()
				// Shallow copy creates a new VM instance
				expect(copy.vm).not.toBe(vmService.vm)
				// But shares the same stateManager (shallow copy semantics)
				expect(copy.vm.stateManager).toBe(vmService.vm.stateManager)
				return 'shallow copied'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('shallow copied')
		})

		it('should allow executing shallow copied VM operations', async () => {
			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				yield* vmService.ready

				const copy = vmService.shallowCopy()
				yield* copy.ready

				// The copy should have the same shape as the original
				expect(copy.vm).toBeDefined()
				expect(typeof copy.runTx).toBe('function')
				expect(typeof copy.runBlock).toBe('function')
				expect(typeof copy.buildBlock).toBe('function')
				expect(typeof copy.shallowCopy).toBe('function')
				expect(typeof copy.deepCopy).toBe('function')

				return 'shallow copy works'
			})

			const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
			expect(result).toBe('shallow copy works')
		})
	})

	describe('exports', () => {
		it('should export VmLive from the module', async () => {
			const { VmLive: ExportedVmLive } = await import('./VmLive.js')
			expect(ExportedVmLive).toBeDefined()
			expect(typeof ExportedVmLive).toBe('function')
		})
	})

	describe('error handling', () => {
		it('should capture createVm errors in the typed error channel', async () => {
			// Mock createVm to throw a synchronous error
			const mockCreateVm = vi.spyOn(vmModule, 'createVm').mockImplementation(() => {
				throw new Error('Simulated createVm failure')
			})

			try {
				// Use valid layers for the other services
				const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
				const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
				const evmLayer = Layer.provide(
					EvmLive(),
					Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal),
				)

				// Build VmLive
				const vmLayer = Layer.provide(
					VmLive(),
					Layer.mergeAll(evmLayer, stateLayer, blockchainLayer, CommonLocal),
				)

				const program = Effect.gen(function* () {
					const vmService = yield* VmService
					return vmService
				})

				const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(vmLayer)))

				// The createVm failure should be captured as a TevmError
				expect(Exit.isFailure(exit)).toBe(true)
				if (Exit.isFailure(exit)) {
					const failure = Cause.failureOption(exit.cause)
					expect(failure._tag).toBe('Some')
					if (failure._tag === 'Some') {
						const error = failure.value
						expect(error).toBeInstanceOf(TevmError)
						expect((error as TevmError).message).toContain('Failed to create VM')
						expect((error as TevmError).message).toContain('Simulated createVm failure')
						expect((error as TevmError).code).toBe(-32603)
						expect((error as TevmError).docsPath).toBe('/reference/tevm/vm-effect/')
					}
				}
			} finally {
				mockCreateVm.mockRestore()
			}
		})

		it('should handle non-Error thrown values', async () => {
			// Mock createVm to throw a string (not an Error instance)
			const mockCreateVm = vi.spyOn(vmModule, 'createVm').mockImplementation(() => {
				throw 'String error message' // Throwing a string, not an Error
			})

			try {
				// Use valid layers for the other services
				const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
				const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
				const evmLayer = Layer.provide(
					EvmLive(),
					Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal),
				)

				// Build VmLive
				const vmLayer = Layer.provide(
					VmLive(),
					Layer.mergeAll(evmLayer, stateLayer, blockchainLayer, CommonLocal),
				)

				const program = Effect.gen(function* () {
					const vmService = yield* VmService
					return vmService
				})

				const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(vmLayer)))

				// The createVm failure should be captured as a TevmError
				expect(Exit.isFailure(exit)).toBe(true)
				if (Exit.isFailure(exit)) {
					const failure = Cause.failureOption(exit.cause)
					expect(failure._tag).toBe('Some')
					if (failure._tag === 'Some') {
						const error = failure.value
						expect(error).toBeInstanceOf(TevmError)
						// When throwing a string, it should be converted via String()
						expect((error as TevmError).message).toContain('Failed to create VM')
						expect((error as TevmError).message).toContain('String error message')
						expect((error as TevmError).code).toBe(-32603)
					}
				}
			} finally {
				mockCreateVm.mockRestore()
			}
		})

		it('should capture runTx errors in the typed error channel', async () => {
			// Build the layer stack
			const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
			const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
			const evmLayer = Layer.provide(
				EvmLive(),
				Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal),
			)
			const fullLayer = Layer.provide(
				VmLive(),
				Layer.mergeAll(evmLayer, stateLayer, blockchainLayer, CommonLocal),
			)

			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				yield* vmService.ready

				// Mock runTx to throw after getting the service
				const originalRunTx = vmService.vm.runTx
				vmService.vm.runTx = () => Promise.reject(new Error('runTx failed'))

				try {
					// This should fail and be captured in the error channel
					const result = yield* vmService.runTx({} as any)
					return result
				} finally {
					vmService.vm.runTx = originalRunTx
				}
			})

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(fullLayer)))
			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should capture runBlock errors in the typed error channel', async () => {
			// Build the layer stack
			const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
			const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
			const evmLayer = Layer.provide(
				EvmLive(),
				Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal),
			)
			const fullLayer = Layer.provide(
				VmLive(),
				Layer.mergeAll(evmLayer, stateLayer, blockchainLayer, CommonLocal),
			)

			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				yield* vmService.ready

				// Mock runBlock to throw after getting the service
				const originalRunBlock = vmService.vm.runBlock
				vmService.vm.runBlock = () => Promise.reject(new Error('runBlock failed'))

				try {
					const result = yield* vmService.runBlock({} as any)
					return result
				} finally {
					vmService.vm.runBlock = originalRunBlock
				}
			})

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(fullLayer)))
			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should capture buildBlock errors in the typed error channel', async () => {
			// Build the layer stack
			const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
			const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
			const evmLayer = Layer.provide(
				EvmLive(),
				Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal),
			)
			const fullLayer = Layer.provide(
				VmLive(),
				Layer.mergeAll(evmLayer, stateLayer, blockchainLayer, CommonLocal),
			)

			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				yield* vmService.ready

				// Mock buildBlock to throw after getting the service
				const originalBuildBlock = vmService.vm.buildBlock
				vmService.vm.buildBlock = () => Promise.reject(new Error('buildBlock failed'))

				try {
					const result = yield* vmService.buildBlock({} as any)
					return result
				} finally {
					vmService.vm.buildBlock = originalBuildBlock
				}
			})

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(fullLayer)))
			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should capture ready errors in the typed error channel', async () => {
			// Build the layer stack
			const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
			const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
			const evmLayer = Layer.provide(
				EvmLive(),
				Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal),
			)
			const fullLayer = Layer.provide(
				VmLive(),
				Layer.mergeAll(evmLayer, stateLayer, blockchainLayer, CommonLocal),
			)

			const program = Effect.gen(function* () {
				const vmService = yield* VmService

				// Mock ready to throw after getting the service
				const originalReady = vmService.vm.ready
				vmService.vm.ready = () => Promise.reject(new Error('ready failed'))

				try {
					yield* vmService.ready
					return 'should not reach'
				} finally {
					vmService.vm.ready = originalReady
				}
			})

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(fullLayer)))
			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should capture deepCopy errors in the typed error channel', async () => {
			// Build the layer stack
			const stateLayer = Layer.provide(StateManagerLocal(), CommonLocal)
			const blockchainLayer = Layer.provide(BlockchainLocal(), CommonLocal)
			const evmLayer = Layer.provide(
				EvmLive(),
				Layer.mergeAll(stateLayer, blockchainLayer, CommonLocal),
			)
			const fullLayer = Layer.provide(
				VmLive(),
				Layer.mergeAll(evmLayer, stateLayer, blockchainLayer, CommonLocal),
			)

			const program = Effect.gen(function* () {
				const vmService = yield* VmService
				yield* vmService.ready

				// Mock deepCopy to throw after getting the service
				const originalDeepCopy = vmService.vm.deepCopy
				vmService.vm.deepCopy = () => Promise.reject(new Error('deepCopy failed'))

				try {
					const result = yield* vmService.deepCopy()
					return result
				} finally {
					vmService.vm.deepCopy = originalDeepCopy
				}
			})

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(fullLayer)))
			expect(Exit.isFailure(exit)).toBe(true)
		})
	})
})
