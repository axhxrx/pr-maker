/**
 * Main entry point for the pr-maker CLI application.
 * This file imports the core CLI logic from `cli.ts` and executes it.
 * Separating this allows `cli.ts` to be imported for testing without immediately running.
 */
import { runCli } from "./cli.ts";

/**
 * Executes the main CLI logic.
 * Catches and logs any top-level errors.
 */
export async function main(): Promise<void> {
  try {
    await runCli();
  } catch (err) {
    // Ensure error is properly handled and logged
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('\n❌ An unexpected error occurred:', errorMessage);
    if (err instanceof Error && err.stack) {
      // Optionally log stack trace for debugging
      // console.error(err.stack);
    }
    // Exit with a non-zero code to indicate failure
    Deno.exit(1);
  }
}

// Execute main if this script is the entry point
if (import.meta.main) {
  main();
}
