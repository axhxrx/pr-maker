import { Input, Select } from '@cliffy/prompt';
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

  // SPecial case not handled by initConfig():
  let apiKey = parsedArgs['api-key'] ?? config.get('api-key');
  if (!apiKey)
  {
    console.log(`
      🔑 No API key found. You can specify your API key by using the --api-key argment, or by setting the API_KEY environment variable before running this program, or by storing it in the local config file (NOTE: stored in plaintext), or by entering it interactively. What would you like to do?
    `);

    const answer = await Select.prompt({
      message: 'What would you like to do?',
      options: [
        { value: 'exit', name: 'Exit this program now' },
        { value: 'enter', name: 'Enter API key interactively, without storing' },
        { value: 'config', name: 'Store in config file (NOTE: stored in plaintext)' },
      ],
    });

    if (answer === 'enter' || answer === 'config')
    {
      apiKey = await Input.prompt({
        message: 'Enter your API key:',
      });
      if (answer === 'config')
      {
        await config.set('api-key', apiKey);
      }
    }
    else
    {
      Deno.exit(1);
    }
  }

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
