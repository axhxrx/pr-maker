import { Input, Select, Toggle } from 'jsr:@cliffy/prompt@1.0.0-rc.4';
import { parseArgs } from 'jsr:@std/cli@0.224.3';
import { applyProposedChanges } from './applyProposedChanges.ts';
import {
  checkoutRevision,
  commitChanges,
  createUniqueBranch,
  pushBranch,
} from './git_helpers.ts';
import { createPullRequest } from './github_api.ts';
import { configValue, initConfig } from './initConfig.ts';

// Define a type for our specific application configuration
interface PrMakerConfig
{
  githubOrg: string;
  repoName: string;
  baseBranch: string;
  prTitle: string;
  prBody: string;
  prLabels: string; // Comma-separated for simplicity first
  githubToken: string;
  yes: boolean; // Skip confirmation
  dryRun: boolean;
}

const appId = 'com.axhxrx.pr-maker';

// Define CLI arguments
// Note: We'll merge these with config values later
const argsDefinition = {
  boolean: ['help', 'yes', 'dryRun'],
  string: [
    'githubOrg',
    'repoName',
    'baseBranch',
    'prTitle',
    'prBody',
    'prLabels',
    'githubToken',
  ],
  alias: {
    h: 'help',
    y: 'yes',
    o: 'githubOrg',
    r: 'repoName',
    b: 'baseBranch',
    t: 'prTitle',
    l: 'prLabels',
  },
} as const;

// Define default configuration and prompts
export const defaultConfig = {
  githubOrg: configValue('', { promptIfFalsy: 'Enter the GitHub organization name:',
    envOverride: 'PR_MAKER_GITHUB_ORG' }),
  repoName: configValue('', { promptIfFalsy: 'Enter the repository name:', envOverride: 'PR_MAKER_REPO_NAME' }),
  baseBranch: configValue('main', { promptIfFalsy: 'Enter the base branch name:',
    envOverride: 'PR_MAKER_BASE_BRANCH' }),
  prTitle: configValue('Automated PR', { promptIfFalsy: 'Enter the pull request title:',
    envOverride: 'PR_MAKER_PR_TITLE' }),
  prBody: configValue('This PR was created automatically.', { promptIfFalsy: 'Enter the pull request body:',
    envOverride: 'PR_MAKER_PR_BODY' }),
  prLabels: configValue('', {
    envOverride: 'PR_MAKER_PR_LABELS',
  }),
  githubToken: configValue('', {
    promptIfFalsy: 'Enter GitHub Token (or set GITHUB_TOKEN env var):',
    envOverride: 'GITHUB_TOKEN', // Standard environment variable for GitHub token
  }),
  yes: configValue(false, { envOverride: 'PR_MAKER_YES' }),
  dryRun: configValue(false, { envOverride: 'PR_MAKER_DRY_RUN' }),
};

/**
 * Wrapper for Select.prompt to allow for non-interactive testing.
 */
async function promptSelect<T>(
  options: Parameters<typeof Select.prompt<T>>[0],
  testAnswer?: T,
): Promise<T>
{
  if (testAnswer !== undefined)
  {
    // Find the option corresponding to the test answer
    // deno-lint-ignore no-explicit-any -- Suppressing warning for explicit any type needed for complex @cliffy/prompt types
    const choice = options.options.find((opt: any) => 'value' in opt && opt.value === testAnswer);
    // Added check and clearer error message
    if (!choice || typeof choice !== 'object' || !('name' in choice))
    {
      console.warn(`[Test Mode] Could not find matching option for answer: ${testAnswer}`);
      // Fallback or throw - throwing is safer for tests
      throw new Error(`[Test Mode] Test answer '${testAnswer}' not found or is not a valid option object in options`);
    }
    // Now 'choice' is guaranteed to have 'name'
    console.log(`[Test Mode] Selecting: ${choice.name}`);
    // Return the provided test answer directly, assuming it's the correct type T
    return testAnswer;
  }

  return await Select.prompt(options) as T; // Cast needed due to complex type inference
}

/**
 * Wrapper for Input.prompt to allow for non-interactive testing.
 */
async function promptInput(
  options: Parameters<typeof Input.prompt>[0],
  testAnswer?: string,
): Promise<string>
{
  if (testAnswer !== undefined)
  {
    // Safely access message, assuming options is an object
    const message = typeof options === 'object' && options !== null && 'message' in options ? options.message : 'Input';
    console.log(`[Test Mode] Inputting: ${message} -> ${testAnswer}`);
    return testAnswer;
  }
  return await Input.prompt(options);
}

/**
 * Wrapper for Toggle.prompt to allow for non-interactive testing.
 */
async function promptToggle(
  options: Parameters<typeof Toggle.prompt>[0],
  testAnswer?: boolean,
): Promise<boolean>
{
  if (testAnswer !== undefined)
  {
    // Safely access message, assuming options is an object
    const message = typeof options === 'object' && options !== null && 'message' in options
      ? options.message
      : 'Toggle';
    console.log(`[Test Mode] Toggling: ${message} -> ${testAnswer}`);
    return testAnswer;
  }
  return await Toggle.prompt(options);
}

// Define the expected structure for the result of runCli
export interface CliResult
{
  exitCode: number;
  prUrl?: string;
  error?: string;
}

// Main CLI function
export async function runCli(
  argsOverride?: string[],
  proposedChanges?: Record<string, unknown>, // Added parameter for direct instructions
): Promise<CliResult>
{ // Changed return type
  console.log('Welcome to pr-maker!\n');

  const parsedArgs = parseArgs(argsOverride ?? Deno.args, argsDefinition); // Use argsOverride or Deno.args

  if (parsedArgs.help)
  {
    // Basic help message (can be expanded)
    console.log('Usage: deno run cli.ts [options]');
    console.log('\nOptions:');
    console.log('  --githubOrg, -o    GitHub organization name');
    console.log('  --repoName, -r     Repository name');
    console.log('  --baseBranch, -b   Base branch for PR (default: main)');
    console.log('  --prTitle, -t      Pull request title');
    console.log('  --prBody           Pull request body');
    console.log('  --prLabels, -l     Comma-separated labels');
    console.log('  --githubToken      GitHub Token (or use GITHUB_TOKEN env var)');
    console.log('  --yes, -y          Skip confirmation prompts');
    console.log('  --dryRun           Perform a dry run without making changes');
    console.log('  --help, -h         Show this help message');
    console.log('\nConfiguration is stored in:', await initConfig(appId, {}, {}).then(c => c.getConfigFilePath())); // Show path only
    return { exitCode: 0 }; // Return success object
  }

  // 1. Initialize configuration (handles env, config file, prompts)
  const configManager = await initConfig(appId, defaultConfig, {
    githubToken: parsedArgs.githubToken,
    yes: parsedArgs.yes,
    dryRun: parsedArgs.dryRun,
    prTitle: parsedArgs.prTitle,
    prBody: parsedArgs.prBody,
    prLabels: parsedArgs.prLabels,
    baseBranch: parsedArgs.baseBranch,
    repoName: parsedArgs.repoName,
    githubOrg: parsedArgs.githubOrg,
  });

  // Correctly build the initial config object by getting each value
  const currentConfig = {} as PrMakerConfig;
  for (const key of Object.keys(defaultConfig) as Array<keyof PrMakerConfig>)
  {
    // Re-applied 'as any' to fix TS 'never' type error
    // @ts-ignore - Suppressing persistent 'never' error due to complex type inference
    // deno-lint-ignore no-explicit-any -- Suppressing warning for explicit any type needed for complex @cliffy/prompt types
    currentConfig[key] = configManager.get(key) as any;
  }

  // 2. Override with CLI arguments
  // TODO: Track source (CLI, env, config, prompt, default) for better confirmation message
  for (const key of Object.keys(defaultConfig) as Array<keyof PrMakerConfig>)
  {
    if (parsedArgs[key] !== undefined)
    {
      // deno-lint-ignore no-explicit-any
      (currentConfig as any)[key] = parsedArgs[key];
    }
  }

  let proceed = parsedArgs.yes ?? currentConfig.yes;

  // 3. Confirmation Loop
  while (!proceed)
  {
    console.log('\nCurrent Configuration:');
    console.log(`  Config File: ${configManager.getConfigFilePath()}`);
    console.log(`  GitHub Org:    ${currentConfig.githubOrg}`);
    console.log(`  Repo Name:     ${currentConfig.repoName}`);
    console.log(`  Base Branch:   ${currentConfig.baseBranch}`);
    console.log(`  PR Title:      ${currentConfig.prTitle}`);
    console.log(`  PR Body:       ${currentConfig.prBody || '(empty)'}`);
    console.log(`  PR Labels:     ${currentConfig.prLabels || '(none)'}`);
    console.log(`  GitHub Token:  ${currentConfig.githubToken ? '********' : '(not set)'}`); // Mask token
    console.log(`  Dry Run:       ${currentConfig.dryRun}`);
    console.log('---');

    if (!currentConfig.yes)
    {
      const action = await promptSelect<'continue' | 'change' | 'exit'>({
        message: 'Review the configuration above. What would you like to do?',
        options: [
          { value: 'continue', name: '✅ Continue with this configuration' },
          { value: 'change', name: '✏️ Change configuration' },
          { value: 'exit', name: '❌ Exit' },
        ],
      });

      if (action === 'continue')
      {
        proceed = true;
      }
      else if (action === 'exit')
      {
        console.log('Exiting.');
        return { exitCode: 1, error: 'User exited configuration.' }; // Changed to return error object
      }
      else
      {
        // 4. Change Configuration Menu
        const keyToChange = await promptSelect<keyof PrMakerConfig | 'done'>({
          message: 'Which setting do you want to change?',
          options: [
            ...Object.keys(currentConfig).map(k => ({
              value: k as keyof PrMakerConfig,
              name: `${k}: ${
                k === 'githubToken' && currentConfig[k]
                  ? '********'
                  : currentConfig[k as keyof PrMakerConfig] || '(empty)'
              }`,
            })),
            Select.separator('---'),
            { value: 'done', name: 'Done Changing' },
          ],
        });

        if (keyToChange !== 'done')
        {
          const configKey = keyToChange as keyof PrMakerConfig;
          const currentValue = currentConfig[configKey];
          let newValue: string | boolean;

          if (typeof currentValue === 'boolean')
          {
            newValue = await promptToggle({
              message: `Set '${configKey}' to:`,
              default: currentValue,
            });
          }
          else
          {
            newValue = await promptInput({
              message: `Enter new value for '${configKey}':`,
              default: String(currentValue ?? ''), // Ensure default is string
            });
          }

          // Persist change using configManager.set (handles type coercion better)
          // Using 'as any' for newValue initially, might need refinement if type errors persist
          try
          {
            // Ensured deno-lint suppression comment is present
            // deno-lint-ignore no-explicit-any -- Suppressing warning for explicit any type needed until initConfig improves type handling
            await configManager.set(configKey, newValue as any); // Use set for persistence and potential type coercion
            // Update local state *after* successful persistence
            // Re-applied 'as any' to fix TS 'never' type error
            // @ts-ignore - Re-adding suppression for persistent 'never' error due to complex type inference
            // deno-lint-ignore no-explicit-any -- Moving suppression to correct line
            currentConfig[configKey] = configManager.get(configKey) as any;
            console.log(`Configuration '${configKey}' updated and saved.`);
          }
          catch (error)
          {
            console.error(`Failed to update configuration for ${configKey}:`, error);
            // Optionally revert local state or handle error differently
          }
        }
      }
    }
  }

  console.log('\nConfiguration confirmed!');

  // --- Core Workflow ---
  let tempCheckoutDir: string | undefined;
  try
  {
    // 1. Checkout revision
    console.log(`\nChecking out ${currentConfig.repoName}@${currentConfig.baseBranch}...`);
    tempCheckoutDir = await checkoutRevision(
      currentConfig.githubOrg,
      currentConfig.repoName,
      currentConfig.baseBranch, // Use baseBranch as the starting point
      currentConfig.githubToken,
    );
    console.log(`Checked out to temporary directory: ${tempCheckoutDir}`);

    // 2. Create unique branch
    // Derive a branch name from the PR title or use a default
    const desiredBranchName = currentConfig.prTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      || 'automated-pr';
    console.log(`\nCreating unique branch based on: ${desiredBranchName}...`);
    const newBranchName = await createUniqueBranch(desiredBranchName, tempCheckoutDir);
    console.log(`Created and checked out branch: ${newBranchName}`);

    // 3. Apply Code Changes (using proposedChanges parameter or env var)
    console.log('\nApplying code changes...');
    const actualInstructions = proposedChanges ?? JSON.parse(Deno.env.get('CHANGE_INSTRUCTIONS_JSON') || '{}');

    console.log('[Placeholder] Applying change based on instructions (appending to README.md)...');
    console.log('[Placeholder] Instructions received:', JSON.stringify(actualInstructions));

    // This will throw if it fails. This is the actual change-application logic, which expects a JSON object containing a translation (*.i18n.ts) changeset in the format defined by @axhxrx/internationalization-format-converter. Currently, that is the only kind of changeset that is supported, but this could be extended in the future to support arbitrary user-defined changesets.
    await applyProposedChanges(tempCheckoutDir, actualInstructions);

    // 4. Commit changes
    console.log('\nCommitting changes...');
    const commitMessage = currentConfig.prTitle; // Use PR title as commit message
    await commitChanges(commitMessage, tempCheckoutDir);

    // 5. Push branch
    console.log(`\nPushing branch ${newBranchName} to origin...`);
    await pushBranch(newBranchName, tempCheckoutDir);

    // 6. Create Pull Request
    console.log(`\nCreating pull request...`);
    const prLabels = currentConfig.prLabels
      ? currentConfig.prLabels.split(',').map(l => l.trim()).filter(l => l)
      : undefined;
    const prUrl = await createPullRequest(
      currentConfig.githubOrg,
      currentConfig.repoName,
      currentConfig.prTitle,
      currentConfig.prBody,
      newBranchName,
      currentConfig.baseBranch,
      currentConfig.githubToken,
      prLabels,
    );

    console.log(`\n✅ Successfully created Pull Request: ${prUrl}`);
    return { exitCode: 0, prUrl: prUrl }; // Return success object with URL
  }
  catch (error)
  {
    // Add type check for error object
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n❌ Workflow failed:', errorMessage);
    // Optionally print stack trace if it's an Error instance
    if (error instanceof Error && error.stack)
    {
      console.error(error.stack);
    }
    return { exitCode: 1, error: errorMessage }; // Return error object
  }
  finally
  {
    // 7. Cleanup temporary directory
    if (tempCheckoutDir)
    {
      try
      {
        console.log(`\nCleaning up temporary directory: ${tempCheckoutDir}...`);
        await Deno.remove(tempCheckoutDir, { recursive: true });
        console.log('Cleanup successful.');
      }
      catch (cleanupError)
      {
        console.error(`⚠️ Failed to cleanup temporary directory ${tempCheckoutDir}:`, cleanupError);
      }
    }
  }
}
