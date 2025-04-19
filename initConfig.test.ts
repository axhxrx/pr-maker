import { assertEquals, assertRejects } from '@std/assert';
import { type InferBaseConfig, initConfig } from './initConfig.ts';

const baseAppId = 'com.example.test-app'; // Base for unique IDs

async function cleanupConfig(config: Awaited<ReturnType<typeof initConfig>>)
{
  try
  {
    const configPath = config.getConfigFilePath();
    await Deno.remove(configPath);
    // Attempt to remove the directory if empty, ignore error if not empty/doesn't exist
    const dirPath = configPath.substring(0, configPath.lastIndexOf('/'));
    await Deno.remove(dirPath).catch(() =>
    {});
  }
  catch (e: unknown)
  {
    if (!(e instanceof Deno.errors.NotFound))
    {
      console.warn(`Could not clean up test config file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

const defaultConfig = {
  foo: 'hello',
  bar: 123,
  baz: true,
};

Deno.test('initConfig should return initial default values', async () =>
{
  const appId = `${baseAppId}-defaults-test`;
  const config = await initConfig(appId, defaultConfig);
  assertEquals(config.get('foo'), 'hello');
  assertEquals(config.get('bar'), 123);
  assertEquals(config.get('baz'), true);
  // No file is written if only defaults are used, so cleanup might not be strictly needed,
  // but we add it in case the file was created by a previous failed run.
  await cleanupConfig(config);
});

Deno.test('initConfig should set and get values correctly', async () =>
{
  const appId = `${baseAppId}-setget-test`;
  const config = await initConfig(appId, defaultConfig);

  await config.set('foo', 'world');
  assertEquals(config.get('foo'), 'world');

  await config.set('bar', 456);
  assertEquals(config.get('bar'), 456);

  await config.set('baz', false);
  assertEquals(config.get('baz'), false);

  // Reload to check persistence
  const reloadedConfig = await initConfig(appId, defaultConfig);
  assertEquals(reloadedConfig.get('foo'), 'world');
  assertEquals(reloadedConfig.get('bar'), 456);
  assertEquals(reloadedConfig.get('baz'), false);

  await cleanupConfig(config); // Use original config object for path
});

Deno.test('initConfig set should not affect the original default object', async () =>
{
  const originalDefault = { value: 'original' };
  const appId = `${baseAppId}-immutable-test`;
  const config = await initConfig(appId, originalDefault);

  await config.set('value', 'modified');
  assertEquals(config.get('value'), 'modified');
  assertEquals(originalDefault.value, 'original'); // Verify original is unchanged

  await cleanupConfig(config);
});

Deno.test('initConfig should provide type safety', async () =>
{
  const appId = `${baseAppId}-typesafety-test`; // Still give unique ID
  const _config = await initConfig(appId, defaultConfig);

  // Error: Argument of type '"not-a-key"' is not assignable to parameter of type '"foo" | "bar" | "baz"'.
  // _config.get('not-a-key');

  // Error: Argument of type 'number' is not assignable to parameter of type 'string'.
  // _config.set('foo', 999);

  // Error: Argument of type '"qux"' is not assignable to parameter of type '"foo" | "bar" | "baz"'.
  // await _config.set('qux', 'new value'); // Needs await now
});

Deno.test('initConfig should support overrides', async () =>
{
  const appId = `${baseAppId}-overrides-test`;
  const overrideConfig: Partial<InferBaseConfig<typeof defaultConfig>> = { foo: 'override!!' };
  const config = await initConfig(appId, defaultConfig, overrideConfig);

  assertEquals(config.get('foo'), 'override!!');
  assertEquals(config.get('bar'), 123);
  assertEquals(config.get('baz'), true);

  await cleanupConfig(config);
});

Deno.test('initConfig set should throw for unknown keys at runtime', async () =>
{
  const appId = `${baseAppId}-unknownkey-test`;
  const config = await initConfig(appId, defaultConfig);
  // Simulate JavaScript calling set with an invalid key
  await assertRejects(
    async () =>
    {
      // deno-lint-ignore no-explicit-any
      await (config.set as any)('unknownKey', 'some value');
    },
    Error,
    'initConfig(): Attempted to set unknown config key: unknownKey',
  );

  // Verify the config state wasn't changed for the unknown key
  // deno-lint-ignore no-explicit-any
  assertEquals((config as any).unknownKey, undefined);
  // Verify existing keys are still accessible
  assertEquals(config.get('foo'), 'hello');

  await cleanupConfig(config);
});
