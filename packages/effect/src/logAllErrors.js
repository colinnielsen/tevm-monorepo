import { all, logError } from 'effect/Effect'

/**
 * Logs all errors and causes from effect
 * @param {unknown} e
 * @returns {import("effect/Effect").Effect<void, never, never>}
 * @internal
 * @example
 * ```typescript
 * import { logAllErrors } from '@eth-optimism/config'
 *
 * someEffect.pipe(
 *   tapError(logAllErrors)
 * )
 */
export const logAllErrors = (e) => {
	const errors = [e]
	let current = e
	// #R146-P1-001 fix: Add type guards to prevent infinite loop when cause is non-error value
	// The loop now checks that:
	// 1. current is a non-null object
	// 2. current has a 'cause' property that is also an object (not string/number/etc)
	// This prevents infinite loops when cause is a primitive or lacks a cause property
	while (
		current != null &&
		typeof current === 'object' &&
		'cause' in current &&
		current.cause != null &&
		typeof current.cause === 'object'
	) {
		errors.unshift(current.cause)
		current = current.cause
	}
	// Also handle the case where cause exists but is a primitive (still log it)
	if (
		current != null &&
		typeof current === 'object' &&
		'cause' in current &&
		current.cause != null &&
		typeof current.cause !== 'object'
	) {
		errors.unshift(current.cause)
	}
	return all(errors.map((e) => logError(e)))
}
