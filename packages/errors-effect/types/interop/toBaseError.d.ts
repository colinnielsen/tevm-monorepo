export function toBaseError<T extends TevmError | import("../evm/InsufficientBalanceError.js").InsufficientBalanceError | import("../evm/InsufficientFundsError.js").InsufficientFundsError | import("../evm/InvalidJumpError.js").InvalidJumpError | import("../evm/InvalidOpcodeError.js").InvalidOpcodeError | import("../evm/OutOfGasError.js").OutOfGasError | import("../evm/RevertError.js").RevertError | import("../evm/StackOverflowError.js").StackOverflowError | import("../evm/StackUnderflowError.js").StackUnderflowError | import("../block/BlockGasLimitExceededError.js").BlockGasLimitExceededError | import("../block/BlockNotFoundError.js").BlockNotFoundError | import("../block/InvalidBlockError.js").InvalidBlockError | import("../jsonrpc/InternalError.js").InternalError | import("../jsonrpc/InvalidParamsError.js").InvalidParamsError | import("../jsonrpc/InvalidRequestError.js").InvalidRequestError | import("../jsonrpc/MethodNotFoundError.js").MethodNotFoundError | import("../node/FilterNotFoundError.js").FilterNotFoundError | import("../node/InvalidFilterTypeError.js").InvalidFilterTypeError | import("../node/NodeNotReadyError.js").NodeNotReadyError | import("../node/SnapshotNotFoundError.js").SnapshotNotFoundError | import("../state/AccountNotFoundError.js").AccountNotFoundError | import("../state/StateRootNotFoundError.js").StateRootNotFoundError | import("../state/StorageError.js").StorageError | import("../transaction/GasTooLowError.js").GasTooLowError | import("../transaction/InvalidTransactionError.js").InvalidTransactionError | import("../transaction/NonceTooHighError.js").NonceTooHighError | import("../transaction/NonceTooLowError.js").NonceTooLowError | import("../transport/ForkError.js").ForkError | import("../transport/NetworkError.js").NetworkError | import("../transport/TimeoutError.js").TimeoutError>(taggedError: T): BaseErrorLike & Omit<T, "_tag" | "message" | "code" | "docsPath">;
export type BaseErrorLike = {
    /**
     * - Internal tag for the error
     */
    _tag: string;
    /**
     * - The name of the error
     */
    name: string;
    /**
     * - Human-readable error message
     */
    message: string;
    /**
     * - JSON-RPC error code
     */
    code: number;
    /**
     * - Path to documentation
     */
    docsPath: string | undefined;
    /**
     * - Short description of the error
     */
    shortMessage: string;
    /**
     * - Library version
     */
    version: string;
    /**
     * - Error details computed from cause (matches BaseError behavior)
     */
    details: string;
    /**
     * - The underlying cause of the error (for error chaining)
     */
    cause: unknown;
    /**
     * - Additional meta messages for display
     */
    metaMessages: string[] | undefined;
    /**
     * - Walk through error chain to find matching error
     */
    walk: (fn?: (err: unknown) => boolean) => unknown;
};
import { TevmError } from '../TevmError.js';
//# sourceMappingURL=toBaseError.d.ts.map