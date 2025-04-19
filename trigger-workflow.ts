/**
 * Script to trigger the pr-maker-ci.yml GitHub Actions workflow dispatch.
 *
 * Usage:
 * deno run -A trigger-workflow.ts \
 *   --token <YOUR_GITHUB_TOKEN> \
 *   --owner <REPO_OWNER> \
 *   --repo <REPO_NAME> \
 *   --workflowRef <BRANCH_CONTAINING_WORKFLOW_YML> \
 *   --baseBranch <TARGET_BASE_BRANCH_FOR_PR> \
 *   --changeJson '{"fileToUpdate":"README.md","content":"New line from trigger script"}' \
 *   [--prTitle "Custom Title"] \
 *   [--prBody "Custom Body"] \
 *   [--prLabels "label1,label2"] \
 *   [--dryRun]
 *
 * Or set GITHUB_TOKEN environment variable.
 */

import { parseArgs } from 'jsr:@std/cli@0.224.3';

const argsDefinition = {
  string: [
    'token',        // GitHub PAT
    'owner',        // Repository owner
    'repo',         // Repository name
    'workflowRef',  // Branch/ref where the workflow file resides
    'baseBranch',   // Input: Base branch for the PR
    'prTitle',      // Input: PR Title
    'prBody',       // Input: PR Body
    'prLabels',     // Input: Comma-separated labels
    'changeJson',   // Input: JSON string for changes
  ],
  boolean: ['dryRun', 'help'], // Input: dryRun flag
  default: {
    workflowRef: 'main', // Default branch for the workflow file
    prTitle: 'Workflow Dispatch Triggered PR',
    prBody: 'This PR was triggered via the workflow_dispatch API.',
    prLabels: '',
    dryRun: false,
  },
  alias: { h: 'help' },
} as const;

async function main() {
  const args = parseArgs(Deno.args, argsDefinition);

  if (args.help) {
    console.log('Trigger GitHub Actions workflow_dispatch.');
    console.log('Required flags: --token (or GITHUB_TOKEN env), --owner, --repo, --baseBranch, --changeJson');
    console.log('Optional flags: --workflowRef, --prTitle, --prBody, --prLabels, --dryRun');
    return;
  }

  const token = args.token || Deno.env.get('GITHUB_TOKEN');
  if (!token) {
    console.error('Error: GitHub token is required. Use --token flag or set GITHUB_TOKEN environment variable.');
    Deno.exit(1);
  }

  if (!args.owner || !args.repo || !args.baseBranch || !args.changeJson) {
    console.error('Error: Missing required arguments: --owner, --repo, --baseBranch, --changeJson');
    console.error('Run with --help for usage details.');
    Deno.exit(1);
  }

  const workflowFileName = 'pr-maker-ci.yml'; // Hardcoded name of your workflow file
  const apiUrl = `https://api.github.com/repos/${args.owner}/${args.repo}/actions/workflows/${workflowFileName}/dispatches`;

  const payload = {
    ref: args.workflowRef, // The branch where the workflow file is located
    inputs: {
      baseBranch: args.baseBranch,
      prTitle: args.prTitle,
      prBody: args.prBody,
      prLabels: args.prLabels,
      changeInstructionsJson: args.changeJson, // Pass the JSON string directly
      dryRun: args.dryRun,
    },
  };

  console.log(`Triggering workflow '${workflowFileName}' on ref '${payload.ref}' for repo ${args.owner}/${args.repo}...`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 204) {
      console.log('✅ Successfully triggered workflow dispatch.');
    } else {
      console.error(`❌ Failed to trigger workflow dispatch. Status: ${response.status} ${response.statusText}`);
      const responseBody = await response.text();
      console.error('Response body:', responseBody);
      Deno.exit(1);
    }
  } catch (error) {
    console.error('❌ Error making API request:', error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
