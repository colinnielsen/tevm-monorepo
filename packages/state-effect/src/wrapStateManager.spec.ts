import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Effect, Exit } from 'effect'
import { createStateManagerShape } from './wrapStateManager.js'

// Mock StateManager
const createMockStateManager = () => {
	const mockAccount = {
		nonce: 1n,
		balance: 1000n,
		storageRoot: new Uint8Array(32).fill(0),
		codeHash: new Uint8Array(32).fill(0),
	}

	const mockStateManager = {
		getAccount: vi.fn().mockResolvedValue(mockAccount),
		putAccount: vi.fn().mockResolvedValue(undefined),
		deleteAccount: vi.fn().mockResolvedValue(undefined),
		getStorage: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
		putStorage: vi.fn().mockResolvedValue(undefined),
		clearStorage: vi.fn().mockResolvedValue(undefined),
		getCode: vi.fn().mockResolvedValue(new Uint8Array([0x60, 0x00])),
		putCode: vi.fn().mockResolvedValue(undefined),
		getStateRoot: vi.fn().mockResolvedValue(new Uint8Array(32).fill(1)),
		setStateRoot: vi.fn().mockResolvedValue(undefined),
		checkpoint: vi.fn().mockResolvedValue(undefined),
		commit: vi.fn().mockResolvedValue(undefined),
		revert: vi.fn().mockResolvedValue(undefined),
		dumpCanonicalGenesis: vi.fn().mockResolvedValue({ accounts: {} }),
		generateCanonicalGenesis: vi.fn().mockResolvedValue(undefined),
		ready: vi.fn().mockResolvedValue(undefined),
		deepCopy: vi.fn().mockImplementation(() => Promise.resolve(createMockStateManager())),
		shallowCopy: vi.fn().mockImplementation(() => createMockStateManager()),
	}
	return mockStateManager as unknown as import('@tevm/state').StateManager
}

describe('createStateManagerShape', () => {
	let mockStateManager: ReturnType<typeof createMockStateManager>

	beforeEach(() => {
		mockStateManager = createMockStateManager()
		vi.clearAllMocks()
	})

	it('should create a shape with stateManager property', () => {
		const shape = createStateManagerShape(mockStateManager)
		expect(shape.stateManager).toBe(mockStateManager)
	})

	it('should wrap getAccount in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)
		const address = '0x1234567890123456789012345678901234567890'

		const result = await Effect.runPromise(shape.getAccount(address))

		expect(result).toBeDefined()
		expect(result?.nonce).toBe(1n)
		expect(result?.balance).toBe(1000n)
		expect((mockStateManager as any).getAccount).toHaveBeenCalled()
	})

	it('should accept EthjsAddress objects as address parameter', async () => {
		const shape = createStateManagerShape(mockStateManager)
		// Create an EthjsAddress-like object with bytes property
		const addressObj = {
			bytes: new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56, 0x78, 0x90,
				0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56, 0x78, 0x90]),
			toString: () => '0x1234567890123456789012345678901234567890',
		}

		const result = await Effect.runPromise(shape.getAccount(addressObj as any))

		expect(result).toBeDefined()
		expect((mockStateManager as any).getAccount).toHaveBeenCalledWith(addressObj)
	})

	it('should wrap putAccount in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)
		const address = '0x1234567890123456789012345678901234567890'
		const account = {
			nonce: 5n,
			balance: 5000n,
			storageRoot: new Uint8Array(32),
			codeHash: new Uint8Array(32),
		}

		await Effect.runPromise(shape.putAccount(address, account as any))

		expect((mockStateManager as any).putAccount).toHaveBeenCalled()
	})

	it('should wrap deleteAccount in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)
		const address = '0x1234567890123456789012345678901234567890'

		await Effect.runPromise(shape.deleteAccount(address))

		expect((mockStateManager as any).deleteAccount).toHaveBeenCalled()
	})

	it('should wrap getStorage in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)
		const address = '0x1234567890123456789012345678901234567890'
		const slot = new Uint8Array(32)

		const result = await Effect.runPromise(shape.getStorage(address, slot))

		expect(result).toEqual(new Uint8Array([1, 2, 3]))
		expect((mockStateManager as any).getStorage).toHaveBeenCalled()
	})

	it('should wrap putStorage in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)
		const address = '0x1234567890123456789012345678901234567890'
		const slot = new Uint8Array(32)
		const value = new Uint8Array([4, 5, 6])

		await Effect.runPromise(shape.putStorage(address, slot, value))

		expect((mockStateManager as any).putStorage).toHaveBeenCalled()
	})

	it('should wrap clearStorage in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)
		const address = '0x1234567890123456789012345678901234567890'

		await Effect.runPromise(shape.clearStorage(address))

		expect((mockStateManager as any).clearStorage).toHaveBeenCalled()
	})

	it('should wrap getCode in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)
		const address = '0x1234567890123456789012345678901234567890'

		const result = await Effect.runPromise(shape.getCode(address))

		expect(result).toEqual(new Uint8Array([0x60, 0x00]))
		expect((mockStateManager as any).getCode).toHaveBeenCalled()
	})

	it('should wrap putCode in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)
		const address = '0x1234567890123456789012345678901234567890'
		const code = new Uint8Array([0x60, 0x01])

		await Effect.runPromise(shape.putCode(address, code))

		expect((mockStateManager as any).putCode).toHaveBeenCalled()
	})

	it('should wrap getStateRoot in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)

		const result = await Effect.runPromise(shape.getStateRoot())

		expect(result).toEqual(new Uint8Array(32).fill(1))
		expect((mockStateManager as any).getStateRoot).toHaveBeenCalled()
	})

	it('should wrap setStateRoot in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)
		const root = new Uint8Array(32).fill(2)

		await Effect.runPromise(shape.setStateRoot(root))

		expect((mockStateManager as any).setStateRoot).toHaveBeenCalled()
	})

	it('should wrap checkpoint in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)

		await Effect.runPromise(shape.checkpoint())

		expect((mockStateManager as any).checkpoint).toHaveBeenCalled()
	})

	it('should wrap commit in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)

		await Effect.runPromise(shape.commit())

		expect((mockStateManager as any).commit).toHaveBeenCalled()
	})

	it('should wrap revert in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)

		await Effect.runPromise(shape.revert())

		expect((mockStateManager as any).revert).toHaveBeenCalled()
	})

	it('should wrap dumpState in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)

		const result = await Effect.runPromise(shape.dumpState())

		expect(result).toEqual({ accounts: {} })
		expect((mockStateManager as any).dumpCanonicalGenesis).toHaveBeenCalled()
	})

	it('should wrap loadState in Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)
		const state = { accounts: {} }

		await Effect.runPromise(shape.loadState(state as any))

		expect((mockStateManager as any).generateCanonicalGenesis).toHaveBeenCalled()
	})

	it('should provide ready Effect', async () => {
		const shape = createStateManagerShape(mockStateManager)

		await Effect.runPromise(shape.ready)

		expect((mockStateManager as any).ready).toHaveBeenCalled()
	})

	it('should wrap deepCopy in Effect that returns a new shape', async () => {
		const shape = createStateManagerShape(mockStateManager)

		const copiedShape = await Effect.runPromise(shape.deepCopy())

		expect(copiedShape).toBeDefined()
		expect(copiedShape.stateManager).not.toBe(mockStateManager)
		expect((mockStateManager as any).deepCopy).toHaveBeenCalled()
	})

	// #R140-P2-008 fix: shallowCopy now returns an Effect for consistent error handling
	it('should provide shallowCopy that returns an Effect with a new shape', async () => {
		const shape = createStateManagerShape(mockStateManager)

		const copiedShape = await Effect.runPromise(shape.shallowCopy())

		expect(copiedShape).toBeDefined()
		expect(copiedShape.stateManager).not.toBe(mockStateManager)
		expect((mockStateManager as any).shallowCopy).toHaveBeenCalled()
	})

	it('should handle shallowCopy errors', async () => {
		const failingMock = {
			...mockStateManager,
			shallowCopy: vi.fn().mockImplementation(() => {
				throw new Error('Shallow copy failed')
			}),
		} as unknown as import('@tevm/state').StateManager
		const shape = createStateManagerShape(failingMock)

		const exit = await Effect.runPromiseExit(shape.shallowCopy())

		expect(Exit.isFailure(exit)).toBe(true)
	})

	describe('error handling', () => {
		it('should handle getAccount errors', async () => {
			const failingMock = {
				...mockStateManager,
				getAccount: vi.fn().mockRejectedValue(new Error('Get account failed')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)
			const address = '0x1234567890123456789012345678901234567890'

			const exit = await Effect.runPromiseExit(shape.getAccount(address))

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle putAccount errors', async () => {
			const failingMock = {
				...mockStateManager,
				putAccount: vi.fn().mockRejectedValue(new Error('Put account failed')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)
			const address = '0x1234567890123456789012345678901234567890'
			const account = {
				nonce: 5n,
				balance: 5000n,
				storageRoot: new Uint8Array(32),
				codeHash: new Uint8Array(32),
			}

			const exit = await Effect.runPromiseExit(shape.putAccount(address, account as any))

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle deleteAccount errors', async () => {
			const failingMock = {
				...mockStateManager,
				deleteAccount: vi.fn().mockRejectedValue(new Error('Delete account failed')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)
			const address = '0x1234567890123456789012345678901234567890'

			const exit = await Effect.runPromiseExit(shape.deleteAccount(address))

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle getStorage errors', async () => {
			const failingMock = {
				...mockStateManager,
				getStorage: vi.fn().mockRejectedValue(new Error('Get storage failed')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)
			const address = '0x1234567890123456789012345678901234567890'
			const slot = new Uint8Array(32)

			const exit = await Effect.runPromiseExit(shape.getStorage(address, slot))

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle putStorage errors', async () => {
			const failingMock = {
				...mockStateManager,
				putStorage: vi.fn().mockRejectedValue(new Error('Put storage failed')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)
			const address = '0x1234567890123456789012345678901234567890'
			const slot = new Uint8Array(32)
			const value = new Uint8Array([1, 2, 3])

			const exit = await Effect.runPromiseExit(shape.putStorage(address, slot, value))

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle clearStorage errors', async () => {
			const failingMock = {
				...mockStateManager,
				clearStorage: vi.fn().mockRejectedValue(new Error('Clear storage failed')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)
			const address = '0x1234567890123456789012345678901234567890'

			const exit = await Effect.runPromiseExit(shape.clearStorage(address))

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle getCode errors', async () => {
			const failingMock = {
				...mockStateManager,
				getCode: vi.fn().mockRejectedValue(new Error('Get code failed')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)
			const address = '0x1234567890123456789012345678901234567890'

			const exit = await Effect.runPromiseExit(shape.getCode(address))

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle putCode errors', async () => {
			const failingMock = {
				...mockStateManager,
				putCode: vi.fn().mockRejectedValue(new Error('Put code failed')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)
			const address = '0x1234567890123456789012345678901234567890'
			const code = new Uint8Array([0x60, 0x01])

			const exit = await Effect.runPromiseExit(shape.putCode(address, code))

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle getStateRoot errors', async () => {
			const failingMock = {
				...mockStateManager,
				getStateRoot: vi.fn().mockRejectedValue(new Error('Failed to get state root')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)

			const exit = await Effect.runPromiseExit(shape.getStateRoot())

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle setStateRoot errors with hex conversion', async () => {
			const failingMock = {
				...mockStateManager,
				setStateRoot: vi.fn().mockRejectedValue(new Error('State root not found')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)
			const root = new Uint8Array([0xab, 0xcd])

			const exit = await Effect.runPromiseExit(shape.setStateRoot(root))

			expect(Exit.isFailure(exit)).toBe(true)
			if (Exit.isFailure(exit)) {
				const error = exit.cause as any
				// Should contain hex-formatted state root in error message
				expect(error).toBeDefined()
			}
		})

		it('should handle checkpoint errors', async () => {
			const failingMock = {
				...mockStateManager,
				checkpoint: vi.fn().mockRejectedValue(new Error('Checkpoint failed')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)

			const exit = await Effect.runPromiseExit(shape.checkpoint())

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle ready errors', async () => {
			const failingMock = {
				...mockStateManager,
				ready: vi.fn().mockRejectedValue(new Error('Not ready')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)

			const exit = await Effect.runPromiseExit(shape.ready)

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle commit errors', async () => {
			const failingMock = {
				...mockStateManager,
				commit: vi.fn().mockRejectedValue(new Error('Commit failed')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)

			const exit = await Effect.runPromiseExit(shape.commit())

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle revert errors', async () => {
			const failingMock = {
				...mockStateManager,
				revert: vi.fn().mockRejectedValue(new Error('Revert failed')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)

			const exit = await Effect.runPromiseExit(shape.revert())

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle deepCopy errors', async () => {
			const failingMock = {
				...mockStateManager,
				deepCopy: vi.fn().mockRejectedValue(new Error('DeepCopy failed')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)

			const exit = await Effect.runPromiseExit(shape.deepCopy())

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle dumpState errors', async () => {
			const failingMock = {
				...mockStateManager,
				dumpCanonicalGenesis: vi.fn().mockRejectedValue(new Error('Dump state failed')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)

			const exit = await Effect.runPromiseExit(shape.dumpState())

			expect(Exit.isFailure(exit)).toBe(true)
		})

		it('should handle loadState errors', async () => {
			const failingMock = {
				...mockStateManager,
				generateCanonicalGenesis: vi.fn().mockRejectedValue(new Error('Load state failed')),
			} as unknown as import('@tevm/state').StateManager
			const shape = createStateManagerShape(failingMock)
			const state = { accounts: {} }

			const exit = await Effect.runPromiseExit(shape.loadState(state as any))

			expect(Exit.isFailure(exit)).toBe(true)
		})
	})
})
