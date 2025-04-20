/**
 * Main entry point for the CLI application.
 *
 * This function calls the core CLI logic in `runCli` and handles exiting
 * the process with the appropriate exit code based on the result.
 */
import { runCli } from './cli.ts';

export async function main()
{
  try
  {
    // Execute the core CLI logic
    const result = await runCli(); // runCli now returns CliResult

    // If runCli encountered an error and returned it in the result
    if (result.exitCode !== 0 && result.error)
    {
      // We might have already logged the error in runCli, but log it here too for clarity
      console.error(`CLI Error: ${result.error}`);
    }

    // Exit the Deno process with the exit code from the result
    Deno.exit(result.exitCode);
  }
  catch (error)
  {
    // Catch any unexpected errors *not* handled gracefully by runCli
    console.error('Unhandled Exception:', error);
    Deno.exit(1); // Exit with a generic error code for unhandled exceptions
  }
}

// Run the main function if this script is the entry point
if (import.meta.main)
{
  main();
}
