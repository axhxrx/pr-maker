import { parseArgs } from '@std/cli';
import { configValue, initConfig } from './initConfig.ts';

export const appId = 'com.axhxrx.init-config.example';

// For this example app, all CLI args are also config properties. We don't have to worry about combining them but keeping the distinction between CLI-only args that aren't app config properties.

const argsDefinition = {
  boolean: [
    'help',
    'yes',
    'dryRun',
  ],
  string: [
    'message',
    'prefix',
    'suffix',
    'api-key',
  ],
  number: [
    'repeat',
  ],
  alias: {
    a: 'api-key',
    m: 'message',
    p: 'prefix',
    s: 'suffix',
    r: 'repeat',
    h: 'help',
    y: 'yes',
    'dry-run': 'dryRun',
  },
} as const;

const defaultConfig = {
  message: configValue('', { promptIfFalsy: true }),
  prefix: '',
  suffix: '',
  repeat: 1,
  'api-key': configValue('', {
    promptIfFalsy: 'Enter your API key (or quit this program, set the env var API_KEY, and re-run it)',
    envOverride: 'API_KEY',
  }),
  yes: false,
  dryRun: false,
};

export async function initConfigExample()
{
  const parsedArgs = await parseArgs(Deno.args);
  const config = await initConfig(appId, defaultConfig);

  // Todo: make initConfig somehow aware of the CLI args it should use, and automatically check them
  const message = parsedArgs.message ?? config.get('message');
  const prefix = parsedArgs.prefix ?? config.get('prefix');
  const suffix = parsedArgs.suffix ?? config.get('suffix');
  const repeat = parsedArgs.repeat ?? config.get('repeat');
  // const apiKey = parsedArgs['api-key'] ?? config.get('api-key');

  console.log('repeat', repeat);

  const validatedRepeat = Number(repeat) > 0 ? Number(repeat) : 1;
  for (let i = 0; i < validatedRepeat; i++)
  {
    console.log(`${prefix}${message}${suffix}`);
  }
}

if (import.meta.main)
{
  initConfigExample();
}
