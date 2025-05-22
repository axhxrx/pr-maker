import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { spy, type SpyCall } from 'https://deno.land/std@0.224.0/testing/mock.ts';
import { applyProposedChanges } from './applyProposedChanges.ts';
import { type CliResult, runCli } from './cli.ts';
// import { ensureDir } from 'https://deno.land/std@0.224.0/fs/ensure_dir.ts'; // TODO: Uncomment if needed for file assertions
import { join } from 'https://deno.land/std@0.224.0/path/join.ts';

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

Deno.test('applyProposedChanges should correctly apply changes to a temporary directory', async () =>
{
  let tempDir = '';
  try
  {
    tempDir = await Deno.makeTempDir({ prefix: 'pr_maker_test_' });
    await Deno.copyFile(
      'test-fixtures/multi-spread-operators.fixture.i18n.ts',
      `${tempDir}/multi-spread-operators.fixture.i18n.ts`,
    );

    const proposedChangesInput = {
      'multi-spread-operators.fixture.i18n.ts': {
        soraCamNotificationI18n: {
          eventTypes: {
            deviceAdded: {
              description: { en: 'Notify you when a device is added to your account',
                ja: 'アカウントに新しくデバイスが追加されたときに通知します' },
            },
            deviceRemoved: {
              description: { en: 'Notify you when a device is removed from your account',
                ja: 'アカウントからデバイスが削除されたときに通知します' },
            },
            deviceShareStatusChanged: {
              description: { en: 'Notify you when a device is shared or unshared from another account.',
                ja:
                  'ほかのアカウントにデバイスを共有したり共有が解除されたとき、または、ほかのアカウントからデバイスが共有されたり共有が解除されたときに通知します' },
            },
            devicePropertyChanged: {
              description: { en: 'Notify you when properties of a device changes',
                ja: 'デバイスの設定が変更されたときに通知します' },
            },
            connected: {
              description: { en: 'Notify you when a device is connected to the network',
                ja: 'デバイスがネットワークに接続されたときに通知します' },
            },
            disconnected: {
              description: { en: 'Notify you when a device gets disconnected from the network',
                ja: 'デバイスがネットワークから切断されたときに通知します' },
            },
            eventRecordingStarted: {
              description: { en: 'Notify you when an event recording started',
                ja: 'デバイスがイベントを開始した際に通知します' },
            },
            cloudRecordingInterrupted: {
              description: { en: 'Notify you when cloud recording is interrupted',
                ja: 'クラウド録画が停止した際に通知します' },
            },
          },
        },
      },
    };

    const actualProposedChanges = proposedChangesInput as Record<string, unknown>;

    await applyProposedChanges(tempDir, actualProposedChanges);

    // Assert that the file in tempDir has been modified correctly
    const fixtureFilePathInTemp = join(tempDir, 'multi-spread-operators.fixture.i18n.ts');
    const modifiedFileContent = await Deno.readTextFile(fixtureFilePathInTemp);

    // This assertion should FAIL due to the bug, correctly capturing the issue.
    // It checks if the 'Notifiy' typo was corrected to 'Notify'.
    const expectedEnString = "en: 'Notify you when a device is added to your account'"; // Note: string within a string, ensure quotes are handled
    assertStringIncludes(
      modifiedFileContent,
      expectedEnString,
      `File should be updated to contain: "${expectedEnString}"`,
    );

    // also want to assert that the OLD string is GONE:
    const oldEnString = "en: 'Notifiy you when a device is added to your account'";
    assert(!modifiedFileContent.includes(oldEnString), `File should no longer contain the typo: "${oldEnString}"`);
  }
  catch (error)
  {
    // Ensure errors in the test itself are caught and reported
    console.error('Error during test execution:', error);
    throw error; // Re-throw to fail the test
  }
  finally
  {
    // --- Teardown ---
    // Clean up the temporary directory
    if (tempDir)
    {
      await Deno.remove(tempDir, { recursive: true });
    }
  }
});
