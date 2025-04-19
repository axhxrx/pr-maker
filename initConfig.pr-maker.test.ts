import { assertEquals } from 'jsr:@std/assert@0.225.3';
import { initConfig, initConfigPromptHistory, initConfigScriptedUserInputs } from './initConfig.ts';
// Import the actual defaultConfig used by the pr-maker cli
import { defaultConfig as prMakerDefaultConfig } from './cli.ts';
// Import join and dirname for path manipulation
import { dirname, join } from '@std/path';

// Helper to get config path (simplified from initConfig.ts)
function getTestConfigPath(appId: string): string {
  const configDir: string | undefined = Deno.env.get('HOME') ? join(Deno.env.get('HOME')!, 'Library', 'Application Support') : undefined;
  if (!configDir) {
    throw new Error(`Could not determine config directory.`);
  }
  const fullConfigDir = join(configDir, appId);
  // No ensureDir needed for deletion path
  return join(fullConfigDir, 'config.json');
}

// Unique app ID for these tests to avoid collision with other tests
const TEST_APP_ID_BASE = 'com.axhxrx.pr-maker-tests';

Deno.test('initConfig (pr-maker) should load default pr-maker config and handle prompts', async () => {
  const testAppId = TEST_APP_ID_BASE + '-defaults-prompt';
  // --- Setup ---
  initConfigPromptHistory.length = 0; // Clear history
  initConfigScriptedUserInputs.length = 0; // Clear scripted inputs
  // Provide inputs for: githubOrg, repoName, prLabels
  initConfigScriptedUserInputs.push('test-org-scripted', 'test-repo-scripted', 'bug, enhancement');
  // Manage env vars that could override prompts
  const originalToken = Deno.env.get('GITHUB_TOKEN');
  const originalOrg = Deno.env.get('GITHUB_ORG');
  const originalRepo = Deno.env.get('REPO_NAME');
  const originalLabels = Deno.env.get('PR_LABELS');
  Deno.env.set('GITHUB_TOKEN', 'dummy-token-for-test-1'); // Set dummy token
  Deno.env.delete('GITHUB_ORG'); // Unset potential overrides
  Deno.env.delete('REPO_NAME');
  Deno.env.delete('PR_LABELS');
  // -----------

  try {
    // --- Act ---
    const config = await initConfig(testAppId, prMakerDefaultConfig);
    // ---------

    // --- Assert ---
    assertEquals(config.get('githubOrg'), 'test-org-scripted');
    assertEquals(config.get('repoName'), 'test-repo-scripted');
    assertEquals(config.get('prLabels'), 'bug, enhancement');
    assertEquals(config.get('baseBranch'), 'main'); // Default
    assertEquals(config.get('githubToken'), 'dummy-token-for-test-1'); // Env override
    assertEquals(initConfigPromptHistory.length, 3);
    assertEquals(initConfigPromptHistory[0]?.message, 'Enter the GitHub organization name:');
    assertEquals(initConfigPromptHistory[1]?.message, 'Enter the repository name:');
    assertEquals(initConfigPromptHistory[2]?.message, 'Enter comma-separated labels (optional):');
    // ------------
  } finally {
    // --- Teardown ---
    // Restore all managed env vars
    if (originalToken === undefined) { Deno.env.delete('GITHUB_TOKEN'); } else { Deno.env.set('GITHUB_TOKEN', originalToken); }
    if (originalOrg === undefined) { Deno.env.delete('GITHUB_ORG'); } else { Deno.env.set('GITHUB_ORG', originalOrg); }
    if (originalRepo === undefined) { Deno.env.delete('REPO_NAME'); } else { Deno.env.set('REPO_NAME', originalRepo); }
    if (originalLabels === undefined) { Deno.env.delete('PR_LABELS'); } else { Deno.env.set('PR_LABELS', originalLabels); }
    // Delete the config directory created by this test
    try {
        const configPath = getTestConfigPath(testAppId);
        const configDir = dirname(configPath);
        await Deno.remove(configDir, { recursive: true }).catch(() => {}); // Remove dir recursively
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`Error cleaning up config dir for ${testAppId}: ${errorMessage}`);
    }
    initConfigPromptHistory.length = 0; // Clear history post-test
    initConfigScriptedUserInputs.length = 0; // Clear inputs post-test (belt-and-suspenders)
    // ---------------
  }
});

Deno.test('initConfig (pr-maker) should respect GITHUB_TOKEN env override (no prompts for token)', async () => {
  const testAppId = TEST_APP_ID_BASE + '-envtest';
  // --- Setup ---
  initConfigPromptHistory.length = 0; // Clear history
  initConfigScriptedUserInputs.length = 0; // Clear scripted inputs
  // Provide inputs for other required fields (org, repo, labels) even though we are testing token override
  initConfigScriptedUserInputs.push('dummy-org-env', 'dummy-repo-env', ''); 
  // Manage env vars 
  const originalToken = Deno.env.get('GITHUB_TOKEN');
  const originalOrg = Deno.env.get('GITHUB_ORG');
  const originalRepo = Deno.env.get('REPO_NAME');
  const originalLabels = Deno.env.get('PR_LABELS');
  const testToken = 'test-token-from-env-override';
  Deno.env.set('GITHUB_TOKEN', testToken); // Set the token we are testing
  Deno.env.delete('GITHUB_ORG'); // Unset others to ensure prompts trigger for scripted input
  Deno.env.delete('REPO_NAME');
  Deno.env.delete('PR_LABELS');
  // -----------

  try {
    // --- Act ---
    const config = await initConfig(testAppId, prMakerDefaultConfig);
    // ---------

    // --- Assert ---
    assertEquals(config.get('githubToken'), testToken);
    // Expect prompts for org, repo, labels as they are empty defaults and need scripted input
    assertEquals(initConfigPromptHistory.length, 3); 
    assertEquals(initConfigPromptHistory.some(p => p.message.includes('GitHub Token')), false); // Ensure token specifically wasn't prompted
    // ------------
  } finally {
    // --- Teardown ---
    // Restore all managed env vars
    if (originalToken === undefined) { Deno.env.delete('GITHUB_TOKEN'); } else { Deno.env.set('GITHUB_TOKEN', originalToken); }
    if (originalOrg === undefined) { Deno.env.delete('GITHUB_ORG'); } else { Deno.env.set('GITHUB_ORG', originalOrg); }
    if (originalRepo === undefined) { Deno.env.delete('REPO_NAME'); } else { Deno.env.set('REPO_NAME', originalRepo); }
    if (originalLabels === undefined) { Deno.env.delete('PR_LABELS'); } else { Deno.env.set('PR_LABELS', originalLabels); }
    // Delete the config directory created by this test
    try {
        const configPath = getTestConfigPath(testAppId);
        const configDir = dirname(configPath);
        await Deno.remove(configDir, { recursive: true }).catch(() => {}); // Remove dir recursively
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`Error cleaning up config dir for ${testAppId}: ${errorMessage}`);
    }
    initConfigPromptHistory.length = 0; // Clear history post-test
    initConfigScriptedUserInputs.length = 0; // Clear inputs post-test
    // ---------------
  }
});

Deno.test('initConfig (pr-maker) set/get should work with pr-maker config', async () => {
  const testAppId = TEST_APP_ID_BASE + '-setget';
  // --- Setup ---
  initConfigPromptHistory.length = 0; // Clear history
  initConfigScriptedUserInputs.length = 0; // Clear scripted inputs
  // Provide inputs needed for initConfig prompts (org, repo, labels)
  initConfigScriptedUserInputs.push('dummy-org-setget', 'dummy-repo-setget', 'fix');
  // Manage env vars
  const originalToken = Deno.env.get('GITHUB_TOKEN');
  const originalOrg = Deno.env.get('GITHUB_ORG');
  const originalRepo = Deno.env.get('REPO_NAME');
  const originalLabels = Deno.env.get('PR_LABELS');
  Deno.env.set('GITHUB_TOKEN', 'dummy-token-for-setget-test'); // Set token 
  Deno.env.delete('GITHUB_ORG'); // Unset others to ensure prompts trigger for scripted input
  Deno.env.delete('REPO_NAME');
  Deno.env.delete('PR_LABELS');
  // -----------

  try {
    // --- Act 1: Initialize Config ---
    const config = await initConfig(testAppId, prMakerDefaultConfig);
    // --- Assert 1: Check init prompts ---
    // Check that the 3 expected prompts occurred during init
    assertEquals(initConfigPromptHistory.length, 3);
    const initHistoryLength = initConfigPromptHistory.length;
    // ------------------------------------

    // --- Act 2: Set new values ---
    const newOrg = 'test-org-setget-updated';
    await config.set('githubOrg', newOrg);
    const newTitle = 'My Test PR SetGet Updated';
    await config.set('prTitle', newTitle);
    // ---------------------------

    // --- Assert 2: Check values and no new prompts ---
    assertEquals(config.get('githubOrg'), newOrg);
    assertEquals(config.get('prTitle'), newTitle);
    // Ensure no *new* prompts occurred during set operations
    assertEquals(initConfigPromptHistory.length, initHistoryLength); 
    // ------------------------------------------------
  } finally {
    // --- Teardown ---
    // Restore all managed env vars
    if (originalToken === undefined) { Deno.env.delete('GITHUB_TOKEN'); } else { Deno.env.set('GITHUB_TOKEN', originalToken); }
    if (originalOrg === undefined) { Deno.env.delete('GITHUB_ORG'); } else { Deno.env.set('GITHUB_ORG', originalOrg); }
    if (originalRepo === undefined) { Deno.env.delete('REPO_NAME'); } else { Deno.env.set('REPO_NAME', originalRepo); }
    if (originalLabels === undefined) { Deno.env.delete('PR_LABELS'); } else { Deno.env.set('PR_LABELS', originalLabels); }
    // Delete the config directory created by this test
    try {
        const configPath = getTestConfigPath(testAppId);
        const configDir = dirname(configPath);
        await Deno.remove(configDir, { recursive: true }).catch(() => {}); // Remove dir recursively
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`Error cleaning up config dir for ${testAppId}: ${errorMessage}`);
    }
    initConfigPromptHistory.length = 0; // Clear history post-test
    initConfigScriptedUserInputs.length = 0; // Clear inputs post-test
    // ---------------
  }
});
