import { assertEquals } from 'jsr:@std/assert@0.225.3';
import { sanitizeBranchName } from './git_helpers.ts';

Deno.test('sanitizeBranchName should handle valid names', () =>
{
  assertEquals(sanitizeBranchName('feature-branch'), 'feature-branch');
  assertEquals(sanitizeBranchName('fix-123'), 'fix-123');
  assertEquals(sanitizeBranchName('release-v1.0'), 'release-v1-0'); // Note: '.' replaced
});

Deno.test('sanitizeBranchName should replace invalid characters', () =>
{
  assertEquals(sanitizeBranchName('feat/new feature'), 'feat-new-feature');
  assertEquals(sanitizeBranchName('fix_bug#123'), 'fix-bug-123');
  assertEquals(sanitizeBranchName('user@example'), 'user-example');
  assertEquals(sanitizeBranchName('branch with spaces'), 'branch-with-spaces');
});

Deno.test('sanitizeBranchName should handle leading/trailing hyphens', () =>
{
  assertEquals(sanitizeBranchName('-start-hyphen'), 'start-hyphen');
  assertEquals(sanitizeBranchName('end-hyphen-'), 'end-hyphen');
  assertEquals(sanitizeBranchName('--multiple-start'), 'multiple-start');
  assertEquals(sanitizeBranchName('multiple-end--'), 'multiple-end');
  assertEquals(sanitizeBranchName('-both-'), 'both');
});

Deno.test('sanitizeBranchName should collapse consecutive hyphens', () =>
{
  assertEquals(sanitizeBranchName('feat--double'), 'feat-double');
  assertEquals(sanitizeBranchName('fix---triple'), 'fix-triple');
  assertEquals(sanitizeBranchName('a---b--c'), 'a-b-c');
});

Deno.test('sanitize BranchName should handle mixed cases', () =>
{
  assertEquals(sanitizeBranchName('-feat/new--feature-'), 'feat-new-feature');
  assertEquals(sanitizeBranchName(' fix_invalid#chars---'), 'fix-invalid-chars');
});

Deno.test('sanitizeBranchName should handle empty or invalid results', () =>
{
  assertEquals(sanitizeBranchName('-'), 'sanitized-branch-name-for-pr-maker');
  assertEquals(sanitizeBranchName('--'), 'sanitized-branch-name-for-pr-maker');
  assertEquals(sanitizeBranchName('_@#'), 'sanitized-branch-name-for-pr-maker');
  assertEquals(sanitizeBranchName('   '), 'sanitized-branch-name-for-pr-maker'); // Spaces become hyphens, then removed
  assertEquals(sanitizeBranchName(''), 'sanitized-branch-name-for-pr-maker');
});

Deno.test('sanitizeBranchName should handle empty or invalid results', () =>
{
  assertEquals(sanitizeBranchName('  日本語'), 'sanitized-branch-name-for-pr-maker');
  assertEquals(sanitizeBranchName('日本語'), 'sanitized-branch-name-for-pr-maker');
  assertEquals(sanitizeBranchName('ホゲ　ヒゲ　ハゲ'), 'sanitized-branch-name-for-pr-maker');
});
