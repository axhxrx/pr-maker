/**
 * Main entry point for the application.
 * This function calls the core CLI logic and handles the final process exit.
 */
import { runCli } from './cli.ts';

export async function main()
{
  let exitCode = 1; // Default to error exit code
  try
  {
    // Run the main CLI logic and get the intended exit code
    exitCode = await runCli();
  }
  catch (error)
  {
    // Catch unexpected errors *not* handled by runCli's try/catch
    console.error('\n❌ An unexpected error occurred in the main execution:', error);
    exitCode = 1; // Ensure exit code is 1 for unexpected errors
  }
  finally
  {
    // Ensure Deno.exit is called regardless of how the try block finishes
    Deno.exit(exitCode);
  }
}

// Execute main if this script is the entry point
if (import.meta.main)
{
  main();
}
