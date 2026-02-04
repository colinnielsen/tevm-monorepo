import { describe, it, expect, vi } from 'vitest'
import { Effect, Exit } from 'effect'
import { createBlockchainShape } from './createBlockchainShape.js'

describe('createBlockchainShape', () => {
	// Create a mock Chain instance for testing
	const createMockChain = () => ({
		getBlockByTag: vi.fn(() => Promise.resolve({ header: { number: 100n } })),
		getBlock: vi.fn(() => Promise.resolve({ header: { number: 100n } })),
		putBlock: vi.fn(() => Promise.resolve(undefined)),
		getCanonicalHeadBlock: vi.fn(() => Promise.resolve({ header: { number: 100n } })),
		getIteratorHead: vi.fn(() => Promise.resolve({ header: { number: 100n } })),
		setIteratorHead: vi.fn(() => Promise.resolve(undefined)),
		delBlock: vi.fn(() => Promise.resolve(undefined)),
		validateHeader: vi.fn(() => Promise.resolve(undefined)),
		deepCopy: vi.fn(() =>
			Promise.resolve({
				getBlockByTag: vi.fn(() => Promise.resolve({ header: { number: 101n } })),
				getBlock: vi.fn(() => Promise.resolve({ header: { number: 101n } })),
				putBlock: vi.fn(() => Promise.resolve(undefined)),
				getCanonicalHeadBlock: vi.fn(() => Promise.resolve({ header: { number: 101n } })),
				getIteratorHead: vi.fn(() => Promise.resolve({ header: { number: 101n } })),
				setIteratorHead: vi.fn(() => Promise.resolve(undefined)),
				delBlock: vi.fn(() => Promise.resolve(undefined)),
				validateHeader: vi.fn(() => Promise.resolve(undefined)),
				deepCopy: vi.fn(() => Promise.resolve({} as any)),
				shallowCopy: vi.fn(() => ({} as any)),
				ready: vi.fn(() => Promise.resolve(true)),
			})
		),
		shallowCopy: vi.fn(() => ({
			getBlockByTag: vi.fn(() => Promise.resolve({ header: { number: 100n } })),
			getBlock: vi.fn(() => Promise.resolve({ header: { number: 100n } })),
			putBlock: vi.fn(() => Promise.resolve(undefined)),
			getCanonicalHeadBlock: vi.fn(() => Promise.resolve({ header: { number: 100n } })),
			getIteratorHead: vi.fn(() => Promise.resolve({ header: { number: 100n } })),
			setIteratorHead: vi.fn(() => Promise.resolve(undefined)),
			delBlock: vi.fn(() => Promise.resolve(undefined)),
			validateHeader: vi.fn(() => Promise.resolve(undefined)),
			deepCopy: vi.fn(() => Promise.resolve({} as any)),
			shallowCopy: vi.fn(() => ({} as any)),
			ready: vi.fn(() => Promise.resolve(true)),
		})),
		ready: vi.fn(() => Promise.resolve(true)),
	})

	describe('factory function', () => {
		it('should create a BlockchainShape from a Chain instance', () => {
			const mockChain = createMockChain()
			const shape = createBlockchainShape(mockChain as any)

			expect(shape).toBeDefined()
			expect(shape.chain).toBe(mockChain)
			expect(typeof shape.getBlock).toBe('function')
			expect(typeof shape.getBlockByHash).toBe('function')
			expect(typeof shape.putBlock).toBe('function')
			expect(typeof shape.getCanonicalHeadBlock).toBe('function')
			expect(typeof shape.getIteratorHead).toBe('function')
			expect(typeof shape.setIteratorHead).toBe('function')
			expect(typeof shape.delBlock).toBe('function')
			expect(typeof shape.validateHeader).toBe('function')
			expect(typeof shape.deepCopy).toBe('function')
			expect(typeof shape.shallowCopy).toBe('function')
			expect(typeof shape.iterator).toBe('function')
		})
	})

	describe('getBlock', () => {
		it('should get block by tag', async () => {
			const mockChain = createMockChain()
			const shape = createBlockchainShape(mockChain as any)

			const result = await Effect.runPromise(shape.getBlock('latest'))

			expect(result).toEqual({ header: { number: 100n } })
			expect(mockChain.getBlockByTag).toHaveBeenCalledWith('latest')
		})

		it('should get block by number', async () => {
			const mockChain = createMockChain()
			const shape = createBlockchainShape(mockChain as any)

			const result = await Effect.runPromise(shape.getBlock(100n))

			expect(result).toEqual({ header: { number: 100n } })
			expect(mockChain.getBlockByTag).toHaveBeenCalledWith(100n)
		})

		it('should fail with BlockNotFoundError on error', async () => {
			const mockChain = createMockChain()
			mockChain.getBlockByTag.mockRejectedValue(new Error('Block not found'))
			const shape = createBlockchainShape(mockChain as any)

			const exit = await Effect.runPromiseExit(shape.getBlock('latest'))

			expect(Exit.isFailure(exit)).toBe(true)
		})
	})

	describe('getBlockByHash', () => {
		it('should get block by hash', async () => {
			const mockChain = createMockChain()
			const shape = createBlockchainShape(mockChain as any)
			const hash = new Uint8Array(32).fill(1)

			const result = await Effect.runPromise(shape.getBlockByHash(hash))

			expect(result).toEqual({ header: { number: 100n } })
			expect(mockChain.getBlockByTag).toHaveBeenCalledWith(hash)
		})

		it('should fail with BlockNotFoundError on error', async () => {
			const mockChain = createMockChain()
			mockChain.getBlockByTag.mockRejectedValue(new Error('Block not found'))
			const shape = createBlockchainShape(mockChain as any)

			const exit = await Effect.runPromiseExit(shape.getBlockByHash(new Uint8Array(32)))

			expect(Exit.isFailure(exit)).toBe(true)
		})
	})

	describe('putBlock', () => {
		it('should put block', async () => {
			const mockChain = createMockChain()
			const shape = createBlockchainShape(mockChain as any)
			const mockBlock = { header: { number: 101n } }

			await Effect.runPromise(shape.putBlock(mockBlock as any))

			expect(mockChain.putBlock).toHaveBeenCalledWith(mockBlock)
		})

		it('should fail with InvalidBlockError on error', async () => {
			const mockChain = createMockChain()
			mockChain.putBlock.mockRejectedValue(new Error('Invalid block'))
			const shape = createBlockchainShape(mockChain as any)

			const exit = await Effect.runPromiseExit(shape.putBlock({} as any))

			expect(Exit.isFailure(exit)).toBe(true)
		})
	})

	describe('getCanonicalHeadBlock', () => {
		it('should get canonical head block', async () => {
			const mockChain = createMockChain()
			const shape = createBlockchainShape(mockChain as any)

			const result = await Effect.runPromise(shape.getCanonicalHeadBlock())

			expect(result).toEqual({ header: { number: 100n } })
			expect(mockChain.getCanonicalHeadBlock).toHaveBeenCalled()
		})

		it('should fail with BlockNotFoundError on error', async () => {
			const mockChain = createMockChain()
			mockChain.getCanonicalHeadBlock.mockRejectedValue(new Error('No head'))
			const shape = createBlockchainShape(mockChain as any)

			const exit = await Effect.runPromiseExit(shape.getCanonicalHeadBlock())

			expect(Exit.isFailure(exit)).toBe(true)
		})
	})

	describe('getIteratorHead', () => {
		it('should get iterator head by name', async () => {
			const mockChain = createMockChain()
			const shape = createBlockchainShape(mockChain as any)

			const result = await Effect.runPromise(shape.getIteratorHead('vm'))

			expect(result).toEqual({ header: { number: 100n } })
			expect(mockChain.getIteratorHead).toHaveBeenCalledWith('vm')
		})

		it('should fail with BlockNotFoundError on error', async () => {
			const mockChain = createMockChain()
			mockChain.getIteratorHead.mockRejectedValue(new Error('Not found'))
			const shape = createBlockchainShape(mockChain as any)

			const exit = await Effect.runPromiseExit(shape.getIteratorHead('vm'))

			expect(Exit.isFailure(exit)).toBe(true)
		})
	})

	describe('setIteratorHead', () => {
		it('should set iterator head', async () => {
			const mockChain = createMockChain()
			const shape = createBlockchainShape(mockChain as any)
			const hash = new Uint8Array(32).fill(1)

			await Effect.runPromise(shape.setIteratorHead('vm', hash))

			expect(mockChain.setIteratorHead).toHaveBeenCalledWith('vm', hash)
		})

		it('should fail with InvalidBlockError on error', async () => {
			const mockChain = createMockChain()
			mockChain.setIteratorHead.mockRejectedValue(new Error('Invalid'))
			const shape = createBlockchainShape(mockChain as any)

			const exit = await Effect.runPromiseExit(shape.setIteratorHead('vm', new Uint8Array(32)))

			expect(Exit.isFailure(exit)).toBe(true)
		})
	})

	describe('delBlock', () => {
		it('should delete block', async () => {
			const mockChain = createMockChain()
			const shape = createBlockchainShape(mockChain as any)
			const hash = new Uint8Array(32).fill(1)

			await Effect.runPromise(shape.delBlock(hash))

			expect(mockChain.delBlock).toHaveBeenCalledWith(hash)
		})

		it('should fail with BlockNotFoundError on error', async () => {
			const mockChain = createMockChain()
			mockChain.delBlock.mockRejectedValue(new Error('Not found'))
			const shape = createBlockchainShape(mockChain as any)

			const exit = await Effect.runPromiseExit(shape.delBlock(new Uint8Array(32)))

			expect(Exit.isFailure(exit)).toBe(true)
		})
	})

	describe('validateHeader', () => {
		it('should validate header', async () => {
			const mockChain = createMockChain()
			const shape = createBlockchainShape(mockChain as any)
			const mockHeader = { number: 100n }

			await Effect.runPromise(shape.validateHeader(mockHeader as any, 100n))

			expect(mockChain.validateHeader).toHaveBeenCalledWith(mockHeader, 100n)
		})

		it('should fail with InvalidBlockError on error', async () => {
			const mockChain = createMockChain()
			mockChain.validateHeader.mockRejectedValue(new Error('Invalid header'))
			const shape = createBlockchainShape(mockChain as any)

			const exit = await Effect.runPromiseExit(shape.validateHeader({} as any, 100n))

			expect(Exit.isFailure(exit)).toBe(true)
		})
	})

	describe('deepCopy', () => {
		it('should create a deep copy of the blockchain', async () => {
			const mockChain = createMockChain()
			const shape = createBlockchainShape(mockChain as any)

			const copy = await Effect.runPromise(shape.deepCopy())

			expect(copy).toBeDefined()
			expect(mockChain.deepCopy).toHaveBeenCalled()
			// The copy should be a new BlockchainShape wrapping the copied chain
			expect(typeof copy.getBlock).toBe('function')
		})

		it('should fail with InvalidBlockError on error', async () => {
			const mockChain = createMockChain()
			mockChain.deepCopy.mockRejectedValue(new Error('Copy failed'))
			const shape = createBlockchainShape(mockChain as any)

			const exit = await Effect.runPromiseExit(shape.deepCopy())

			expect(Exit.isFailure(exit)).toBe(true)
		})
	})

	describe('shallowCopy', () => {
		it('should create a shallow copy of the blockchain', () => {
			const mockChain = createMockChain()
			const shape = createBlockchainShape(mockChain as any)

			const copy = shape.shallowCopy()

			expect(copy).toBeDefined()
			expect(mockChain.shallowCopy).toHaveBeenCalled()
			// The copy should be a new BlockchainShape wrapping the copied chain
			expect(typeof copy.getBlock).toBe('function')
		})
	})

	describe('ready', () => {
		it('should wait for chain to be ready', async () => {
			const mockChain = createMockChain()
			const shape = createBlockchainShape(mockChain as any)

			const result = await Effect.runPromise(shape.ready)

			expect(result).toBe(true)
			expect(mockChain.ready).toHaveBeenCalled()
		})

		it('should fail with InvalidBlockError on error', async () => {
			const mockChain = createMockChain()
			mockChain.ready.mockRejectedValue(new Error('Not ready'))
			const shape = createBlockchainShape(mockChain as any)

			const exit = await Effect.runPromiseExit(shape.ready)

			expect(Exit.isFailure(exit)).toBe(true)
		})
	})

	describe('iterator', () => {
		it('should iterate blocks in ascending order', async () => {
			const mockChain = createMockChain()
			mockChain.getBlock
				.mockResolvedValueOnce({ header: { number: 0n } })
				.mockResolvedValueOnce({ header: { number: 1n } })
				.mockResolvedValueOnce({ header: { number: 2n } })
			const shape = createBlockchainShape(mockChain as any)

			const blocks: any[] = []
			for await (const block of shape.iterator(0n, 2n)) {
				blocks.push(block)
			}

			expect(blocks.length).toBe(3)
			expect(blocks[0].header.number).toBe(0n)
			expect(blocks[1].header.number).toBe(1n)
			expect(blocks[2].header.number).toBe(2n)
		})

		it('should iterate blocks in descending order', async () => {
			const mockChain = createMockChain()
			mockChain.getBlock
				.mockResolvedValueOnce({ header: { number: 2n } })
				.mockResolvedValueOnce({ header: { number: 1n } })
				.mockResolvedValueOnce({ header: { number: 0n } })
			const shape = createBlockchainShape(mockChain as any)

			const blocks: any[] = []
			for await (const block of shape.iterator(2n, 0n)) {
				blocks.push(block)
			}

			expect(blocks.length).toBe(3)
			expect(blocks[0].header.number).toBe(2n)
			expect(blocks[1].header.number).toBe(1n)
			expect(blocks[2].header.number).toBe(0n)
		})

		it('should skip blocks that are not found (UnknownBlock)', async () => {
			const mockChain = createMockChain()
			const unknownBlockError = new Error('Block not found')
			unknownBlockError.name = 'UnknownBlock'
			mockChain.getBlock
				.mockResolvedValueOnce({ header: { number: 0n } })
				.mockRejectedValueOnce(unknownBlockError)
				.mockResolvedValueOnce({ header: { number: 2n } })
			const shape = createBlockchainShape(mockChain as any)

			const blocks: any[] = []
			for await (const block of shape.iterator(0n, 2n)) {
				blocks.push(block)
			}

			// Should have 2 blocks (0 and 2), skipping the missing one
			expect(blocks.length).toBe(2)
		})

		it('should re-throw non-block-not-found errors', async () => {
			const mockChain = createMockChain()
			mockChain.getBlock
				.mockResolvedValueOnce({ header: { number: 0n } })
				.mockRejectedValueOnce(new Error('Network error'))
			const shape = createBlockchainShape(mockChain as any)

			const blocks: any[] = []
			await expect(async () => {
				for await (const block of shape.iterator(0n, 2n)) {
					blocks.push(block)
				}
			}).rejects.toThrow('Network error')
		})
	})
})
