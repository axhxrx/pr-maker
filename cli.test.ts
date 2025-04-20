import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { spy, type SpyCall } from 'https://deno.land/std@0.224.0/testing/mock.ts';
import { type CliResult, runCli } from './cli.ts';

/**
 * Tests for the main CLI logic in runCli.
 */
Deno.test('runCli should display help message and return 0 with --help argument', async () =>
{
  // Spy on console.log to capture output
  const logSpy = spy(console, 'log');

  let result: CliResult;
  try
  {
    // Provide the --help argument and capture the returned CliResult object
    result = await runCli(['--help']);
  }
  finally
  {
    // Restore original functions
    logSpy.restore();
  }

  // Assert that the exit code returned by runCli is 0
  assertEquals(result.exitCode, 0, 'runCli should return 0 when --help is provided.');

  // Verify that the help message includes expected sections
  const allLogCalls = logSpy.calls.map((call: SpyCall) => call.args.join(' ')).join('\n');
  assertStringIncludes(allLogCalls, 'Usage: deno run', 'Help message should contain Usage info.');
  assertStringIncludes(allLogCalls, 'Options:', 'Help message should contain Options section.');
  assertStringIncludes(allLogCalls, '--githubOrg', 'Help message should list githubOrg option.');
  assertStringIncludes(allLogCalls, '--help', 'Help message should list help option.');
});
