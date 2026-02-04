import { describe, it, expect, vi } from 'vitest'
import { Effect, Layer } from 'effect'
import { RequestService } from './RequestService.js'
import { RequestLive } from './RequestLive.js'
import { EthActionsService } from './EthActionsService.js'
import { TevmActionsService } from './TevmActionsService.js'

describe('RequestLive', () => {
	const createMockEthActions = () => ({
		blockNumber: vi.fn(() => Effect.succeed(100n)),
		call: vi.fn(() => Effect.succeed('0x' as const)),
		chainId: vi.fn(() => Effect.succeed(1n)),
		gasPrice: vi.fn(() => Effect.succeed(1000000000n)),
		getBalance: vi.fn(() => Effect.succeed(1000000000000000000n)),
		getCode: vi.fn(() => Effect.succeed('0x' as const)),
		getStorageAt: vi.fn(() =>
			Effect.succeed(
				'0x0000000000000000000000000000000000000000000000000000000000000000' as const
			)
		),
		estimateGas: vi.fn(() => Effect.succeed(42000n)),
		getBlockByNumber: vi.fn(() => Effect.succeed({
			number: '0x64' as const,
			hash: '0x1234' as const,
			parentHash: '0x5678' as const,
			nonce: '0x0' as const,
			sha3Uncles: '0x0' as const,
			logsBloom: '0x0' as const,
			transactionsRoot: '0x0' as const,
			stateRoot: '0x0' as const,
			receiptsRoot: '0x0' as const,
			miner: '0x0000000000000000000000000000000000000000' as const,
			difficulty: '0x0' as const,
			totalDifficulty: '0x0' as const,
			extraData: '0x0' as const,
			size: '0x0' as const,
			gasLimit: '0x0' as const,
			gasUsed: '0x0' as const,
			timestamp: '0x0' as const,
			transactions: [],
			uncles: [],
		})),
		getBlockByHash: vi.fn(() => Effect.succeed({
			number: '0x64' as const,
			hash: '0x1234' as const,
			parentHash: '0x5678' as const,
			nonce: '0x0' as const,
			sha3Uncles: '0x0' as const,
			logsBloom: '0x0' as const,
			transactionsRoot: '0x0' as const,
			stateRoot: '0x0' as const,
			receiptsRoot: '0x0' as const,
			miner: '0x0000000000000000000000000000000000000000' as const,
			difficulty: '0x0' as const,
			totalDifficulty: '0x0' as const,
			extraData: '0x0' as const,
			size: '0x0' as const,
			gasLimit: '0x0' as const,
			gasUsed: '0x0' as const,
			timestamp: '0x0' as const,
			transactions: [],
			uncles: [],
		})),
		accounts: vi.fn(() => Effect.succeed([])),
		netVersion: vi.fn(() => Effect.succeed('1')),
		web3ClientVersion: vi.fn(() => Effect.succeed('tevm/1.0.0')),
		getTransactionCount: vi.fn(() => Effect.succeed(5n)),
		getLogs: vi.fn(() => Effect.succeed([])),
	})

	const createMockTevmActions = () => ({
		call: vi.fn(() =>
			Effect.succeed({
				rawData: '0x' as const,
				executionGasUsed: 21000n,
			})
		),
		getAccount: vi.fn((params: any) =>
			Effect.succeed({
				address: params.address,
				nonce: 0n,
				balance: 1000000000000000000n,
				deployedBytecode: '0x' as const,
				storageRoot:
					'0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421' as const,
				codeHash:
					'0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470' as const,
				isContract: false,
				isEmpty: false,
			})
		),
		setAccount: vi.fn((params: any) =>
			Effect.succeed({ address: params.address })
		),
		dumpState: vi.fn(() => Effect.succeed('0x' as const)),
		loadState: vi.fn(() => Effect.succeed(undefined)),
		mine: vi.fn(() => Effect.succeed(undefined)),
		snapshot: vi.fn(() => Effect.succeed('0x1' as const)),
		revert: vi.fn(() => Effect.succeed(undefined)),
	})

	const createTestLayer = () => {
		const ethActionsMock = createMockEthActions()
		const tevmActionsMock = createMockTevmActions()

		const mockLayer = Layer.mergeAll(
			Layer.succeed(EthActionsService, ethActionsMock as any),
			Layer.succeed(TevmActionsService, tevmActionsMock as any)
		)

		return {
			layer: Layer.provide(RequestLive, mockLayer),
			mocks: {
				ethActions: ethActionsMock,
				tevmActions: tevmActionsMock,
			},
		}
	}

	it('should handle eth_blockNumber request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_blockNumber',
				params: [],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('0x64') // 100 in hex
		expect(mocks.ethActions.blockNumber).toHaveBeenCalled()
	})

	it('should handle eth_chainId request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_chainId',
				params: [],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('0x1')
		expect(mocks.ethActions.chainId).toHaveBeenCalled()
	})

	it('should handle eth_getBalance request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getBalance',
				params: ['0x1234567890123456789012345678901234567890', 'latest'],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('0xde0b6b3a7640000') // 1e18 in hex
		expect(mocks.ethActions.getBalance).toHaveBeenCalled()
	})

	it('should handle tevm_getAccount request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'tevm_getAccount',
				params: [{ address: '0x1234567890123456789012345678901234567890' }],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect((result as any).balance).toBe(1000000000000000000n)
		expect(mocks.tevmActions.getAccount).toHaveBeenCalled()
	})

	it('should handle tevm_setAccount request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'tevm_setAccount',
				params: [
					{
						address: '0x1234567890123456789012345678901234567890',
						balance: 5000000000000000000n,
					},
				],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect((result as any).address).toBe(
			'0x1234567890123456789012345678901234567890'
		)
		expect(mocks.tevmActions.setAccount).toHaveBeenCalled()
	})

	it('should handle evm_mine request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'evm_mine',
				params: ['0x3'], // 3 blocks
			})
		})

		await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(mocks.tevmActions.mine).toHaveBeenCalledWith({ blocks: 3 })
	})

	it('should fail on unsupported method', async () => {
		const { layer } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'unsupported_method',
				params: [],
			})
		})

		await expect(
			Effect.runPromise(program.pipe(Effect.provide(layer)))
		).rejects.toThrow('Unsupported method')
	})

	it('should handle eth_gasPrice request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_gasPrice',
				params: [],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('0x3b9aca00') // 1 gwei in hex
		expect(mocks.ethActions.gasPrice).toHaveBeenCalled()
	})

	it('should handle eth_call request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_call',
				params: [{ to: '0x1234567890123456789012345678901234567890', data: '0x1234' }],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('0x')
		expect(mocks.ethActions.call).toHaveBeenCalled()
	})

	it('should fail eth_call with missing params', async () => {
		const { layer } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_call',
				params: [],
			})
		})

		await expect(
			Effect.runPromise(program.pipe(Effect.provide(layer)))
		).rejects.toThrow('Missing call parameters')
	})

	it('should fail eth_getBalance with missing address', async () => {
		const { layer } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getBalance',
				params: [],
			})
		})

		await expect(
			Effect.runPromise(program.pipe(Effect.provide(layer)))
		).rejects.toThrow('Missing address parameter')
	})

	it('should handle eth_getBalance without blockTag', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getBalance',
				params: ['0x1234567890123456789012345678901234567890'],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('0xde0b6b3a7640000')
		expect(mocks.ethActions.getBalance).toHaveBeenCalled()
	})

	it('should handle eth_getCode request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getCode',
				params: ['0x1234567890123456789012345678901234567890', 'latest'],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('0x')
		expect(mocks.ethActions.getCode).toHaveBeenCalled()
	})

	it('should fail eth_getCode with missing address', async () => {
		const { layer } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getCode',
				params: [],
			})
		})

		await expect(
			Effect.runPromise(program.pipe(Effect.provide(layer)))
		).rejects.toThrow('Missing address parameter')
	})

	it('should handle eth_getStorageAt request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getStorageAt',
				params: ['0x1234567890123456789012345678901234567890', '0x0', 'latest'],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('0x0000000000000000000000000000000000000000000000000000000000000000')
		expect(mocks.ethActions.getStorageAt).toHaveBeenCalled()
	})

	it('should fail eth_getStorageAt with missing address', async () => {
		const { layer } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getStorageAt',
				params: [],
			})
		})

		await expect(
			Effect.runPromise(program.pipe(Effect.provide(layer)))
		).rejects.toThrow('Missing address or position parameter')
	})

	it('should fail tevm_getAccount with missing address', async () => {
		const { layer } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'tevm_getAccount',
				params: [{}],
			})
		})

		await expect(
			Effect.runPromise(program.pipe(Effect.provide(layer)))
		).rejects.toThrow('Missing address parameter')
	})

	it('should fail tevm_setAccount with missing address', async () => {
		const { layer } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'tevm_setAccount',
				params: [{}],
			})
		})

		await expect(
			Effect.runPromise(program.pipe(Effect.provide(layer)))
		).rejects.toThrow('Missing address parameter')
	})

	it('should handle tevm_call request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'tevm_call',
				params: [{ to: '0x1234567890123456789012345678901234567890' }],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect((result as any).rawData).toBe('0x')
		expect(mocks.tevmActions.call).toHaveBeenCalled()
	})

	it('should handle tevm_call with no params', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'tevm_call',
				params: [],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect((result as any).rawData).toBe('0x')
		expect(mocks.tevmActions.call).toHaveBeenCalledWith({})
	})

	it('should handle tevm_dumpState request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'tevm_dumpState',
				params: [],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('0x')
		expect(mocks.tevmActions.dumpState).toHaveBeenCalled()
	})

	it('should handle tevm_loadState request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'tevm_loadState',
				params: ['0x1234'],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe(null)
		expect(mocks.tevmActions.loadState).toHaveBeenCalledWith('0x1234')
	})

	it('should fail tevm_loadState with missing state', async () => {
		const { layer } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'tevm_loadState',
				params: [],
			})
		})

		await expect(
			Effect.runPromise(program.pipe(Effect.provide(layer)))
		).rejects.toThrow('Missing state parameter')
	})

	it('should handle anvil_mine request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'anvil_mine',
				params: ['0x5'], // 5 blocks
			})
		})

		await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(mocks.tevmActions.mine).toHaveBeenCalledWith({ blocks: 5 })
	})

	it('should handle evm_mine with no params (default 1 block)', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'evm_mine',
				params: [],
			})
		})

		await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(mocks.tevmActions.mine).toHaveBeenCalledWith({ blocks: 1 })
	})

	// Tests for new JSON-RPC methods (Issue #R125-P4-004)
	it('should handle eth_estimateGas request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_estimateGas',
				params: [{ to: '0x1234567890123456789012345678901234567890', data: '0x1234' }],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('0xa410') // 42000 in hex
		expect(mocks.ethActions.estimateGas).toHaveBeenCalled()
	})

	it('should fail eth_estimateGas with missing params', async () => {
		const { layer } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_estimateGas',
				params: [],
			})
		})

		await expect(
			Effect.runPromise(program.pipe(Effect.provide(layer)))
		).rejects.toThrow('Missing estimate gas parameters')
	})

	it('should handle eth_getBlockByNumber request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getBlockByNumber',
				params: ['0x64', false],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect((result as any).number).toBe('0x64')
		expect(mocks.ethActions.getBlockByNumber).toHaveBeenCalled()
	})

	it('should fail eth_getBlockByNumber with missing block tag', async () => {
		const { layer } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getBlockByNumber',
				params: [],
			})
		})

		await expect(
			Effect.runPromise(program.pipe(Effect.provide(layer)))
		).rejects.toThrow('Missing block tag parameter')
	})

	it('should handle eth_getBlockByHash request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getBlockByHash',
				params: ['0x1234567890123456789012345678901234567890123456789012345678901234', false],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect((result as any).number).toBe('0x64')
		expect(mocks.ethActions.getBlockByHash).toHaveBeenCalled()
	})

	it('should fail eth_getBlockByHash with missing block hash', async () => {
		const { layer } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getBlockByHash',
				params: [],
			})
		})

		await expect(
			Effect.runPromise(program.pipe(Effect.provide(layer)))
		).rejects.toThrow('Missing block hash parameter')
	})

	it('should handle eth_accounts request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_accounts',
				params: [],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toEqual([])
		expect(mocks.ethActions.accounts).toHaveBeenCalled()
	})

	it('should handle net_version request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'net_version',
				params: [],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('1')
		expect(mocks.ethActions.netVersion).toHaveBeenCalled()
	})

	it('should handle web3_clientVersion request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'web3_clientVersion',
				params: [],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('tevm/1.0.0')
		expect(mocks.ethActions.web3ClientVersion).toHaveBeenCalled()
	})

	// Snapshot/revert tests (Issue #R126-P4-004)
	it('should handle anvil_snapshot request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'anvil_snapshot',
				params: [],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('0x1')
		expect(mocks.tevmActions.snapshot).toHaveBeenCalled()
	})

	it('should handle evm_snapshot request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'evm_snapshot',
				params: [],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('0x1')
		expect(mocks.tevmActions.snapshot).toHaveBeenCalled()
	})

	it('should handle anvil_revert request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'anvil_revert',
				params: ['0x1'],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe(true)
		expect(mocks.tevmActions.revert).toHaveBeenCalledWith('0x1')
	})

	it('should handle evm_revert request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'evm_revert',
				params: ['0x1'],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe(true)
		expect(mocks.tevmActions.revert).toHaveBeenCalledWith('0x1')
	})

	it('should fail anvil_revert with missing snapshot ID', async () => {
		const { layer } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'anvil_revert',
				params: [],
			})
		})

		await expect(
			Effect.runPromise(program.pipe(Effect.provide(layer)))
		).rejects.toThrow('Missing snapshot ID parameter')
	})

	// Tests for eth_getTransactionCount and eth_getLogs
	it('should handle eth_getTransactionCount request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getTransactionCount',
				params: ['0x1234567890123456789012345678901234567890', 'latest'],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('0x5') // 5 in hex
		expect(mocks.ethActions.getTransactionCount).toHaveBeenCalled()
	})

	it('should handle eth_getTransactionCount without blockTag', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getTransactionCount',
				params: ['0x1234567890123456789012345678901234567890'],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toBe('0x5')
		expect(mocks.ethActions.getTransactionCount).toHaveBeenCalled()
	})

	it('should fail eth_getTransactionCount with missing address', async () => {
		const { layer } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getTransactionCount',
				params: [],
			})
		})

		await expect(
			Effect.runPromise(program.pipe(Effect.provide(layer)))
		).rejects.toThrow('Missing address parameter')
	})

	it('should handle eth_getLogs request', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getLogs',
				params: [{ fromBlock: 'latest', toBlock: 'latest' }],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toEqual([])
		expect(mocks.ethActions.getLogs).toHaveBeenCalled()
	})

	it('should handle eth_getLogs with all filter params', async () => {
		const { layer, mocks } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getLogs',
				params: [{
					fromBlock: '0x0',
					toBlock: 'latest',
					address: '0x1234567890123456789012345678901234567890',
					topics: ['0x1234'],
					blockHash: '0x5678',
				}],
			})
		})

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
		expect(result).toEqual([])
		expect(mocks.ethActions.getLogs).toHaveBeenCalled()
	})

	it('should fail eth_getLogs with missing filter params', async () => {
		const { layer } = createTestLayer()

		const program = Effect.gen(function* () {
			const requestService = yield* RequestService
			return yield* requestService.request({
				method: 'eth_getLogs',
				params: [],
			})
		})

		await expect(
			Effect.runPromise(program.pipe(Effect.provide(layer)))
		).rejects.toThrow('Missing filter parameters')
	})
})
