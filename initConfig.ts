import { ensureDir } from '@std/fs';
import { join } from '@std/path';

/** Options for individual configuration values */
export interface ConfigValueOptions
{
  /** Environment variable name to check for override. If a matching environment variable is found, its value will override the loaded value (or default value). */
  envOverride?: string;

  /** CLI arguments to check for override. If a matching CLI argument is found, its value will override any environment variable or the loaded value (or default value). */
  cliArgs?: string[];

  /**
   * Prompt the user interactively if the value is falsy after loading and env check.
   * If true, generates a default prompt message.
   * If a string, uses that string as the prompt message.
   */
  promptIfFalsy?: string | boolean;
}

const CONFIG_VALUE_WRAPPER = Symbol('ConfigValueWrapper');

/** Internal wrapper to hold value and options */
interface ConfigValueWrapper<T>
{
  [CONFIG_VALUE_WRAPPER]: true; // Identify wrapper
  value: T;
  options: ConfigValueOptions;
}

/** Type guard to check if a value is a ConfigValueWrapper */
function isConfigValueWrapper<T>(value: unknown): value is ConfigValueWrapper<T>
{
  return (
    typeof value === 'object'
    && value !== null
    && (value as Record<string | symbol, unknown>)[CONFIG_VALUE_WRAPPER] === true
  );
}

/** Represents a config value that can be raw or wrapped */
export type ConfigInput<T> = T | ConfigValueWrapper<T>;

/** Represents the structure of the config object passed to initConfig */
export type ConfigInputObject<T extends Record<string, unknown>> = {
  [K in keyof T]: ConfigInput<T[K]>;
};

/**
 * Helper function to associate metadata with a default configuration value.
 *
 * @param value The default value.
 * @param options Metadata options (envOverride, promptIfFalsy).
 * @returns A wrapper object used internally by initConfig.
 */
export function configValue<T>(
  value: T,
  options: ConfigValueOptions,
): ConfigValueWrapper<T>
{
  return {
    [CONFIG_VALUE_WRAPPER]: true,
    value,
    options,
  };
}

/**
 * Determines the platform-specific configuration file path.
 *
 * @param appId The application identifier.
 * @returns The absolute path to the configuration file.
 * @throws {Error} If the config directory cannot be determined.
 */
async function getConfigPath(appId: string): Promise<string>
{
  let configDir: string | undefined;

  switch (Deno.build.os)
  {
    case 'windows':
      configDir = Deno.env.get('APPDATA');
      break;
    case 'darwin': // macOS
      configDir = Deno.env.get('HOME');
      if (configDir)
      {
        configDir = join(configDir, 'Library', 'Application Support');
      }
      break;
    // Assume Linux/BSD/other Unix-like
    case 'linux':
    default:
      configDir = Deno.env.get('XDG_CONFIG_HOME')
        ?? (Deno.env.get('HOME') ? join(Deno.env.get('HOME')!, '.config') : undefined);
      break;
  }

  if (!configDir)
  {
    throw new Error(
      `Could not determine user config directory for OS '${Deno.build.os}'. Required environment variables might be missing.`,
    );
  }

  const appConfigDir = join(configDir, appId);
  await ensureDir(appConfigDir);
  return join(appConfigDir, 'config.json');
}

// --- New: Type Helpers to Infer Base Config ---
/** Utility type to get the inner value type from a potential wrapper */
type UnwrapConfigValue<V> = V extends ConfigValueWrapper<infer U> ? U : V;

/** Utility type to infer the base config structure from the default config object */
export type InferBaseConfig<D extends Record<string, unknown>> = {
  [K in keyof D]: UnwrapConfigValue<D[K]>;
};

/** Represents a config value passed in defaultConfig (raw or wrapped) */
type ConfigInputValue<T> = T | ConfigValueWrapper<T>;

/**
 * Initializes a type-safe configuration object with persistence, environment variable overrides,
 * and interactive prompting for missing values.
 *
 * @param appId A unique identifier for the application.
 * @param defaultConfig The default configuration object, accepting raw values or `configValue` helpers. The structure of this object defines the configuration shape.
 * @param overrideConfig Optional configuration object with *base* types to override defaults/env vars.
 * @returns A promise resolving to an object with type-safe `get`, async `set`, and `getConfigFilePath` methods based on the inferred config shape.
 */
export async function initConfig<
  // D is the actual type of the defaultConfig object passed by the user
  D extends Record<string, ConfigInputValue<unknown>>,
  // T is the inferred base configuration type (e.g., { key: string, count: number })
  T extends Record<string, unknown> = InferBaseConfig<D>,
>(
  appId: string,
  defaultConfig: D,
  // Override uses the inferred base type T
  overrideConfig?: Partial<T>,
)
{
  const filePath = await getConfigPath(appId);
  const metadataMap = new Map<keyof T, ConfigValueOptions>();
  // actualDefaultConfig will hold the base types
  const actualDefaultConfig = {} as T;

  // Process defaultConfig (type D) to extract base values (for T) and options
  for (const key in defaultConfig)
  {
    const keyTyped = key as keyof T; // We assume keys of D and T align
    const inputValue = defaultConfig[key];
    if (isConfigValueWrapper(inputValue))
    {
      actualDefaultConfig[keyTyped] = inputValue.value as T[typeof keyTyped];
      metadataMap.set(keyTyped, inputValue.options);
    }
    else
    {
      // Assert value is compatible using double assertion
      actualDefaultConfig[keyTyped] = inputValue as unknown as T[typeof keyTyped];
      metadataMap.set(keyTyped, {}); // Default empty options for raw values
    }
  }

  const currentConfig: T = structuredClone(actualDefaultConfig);

  // 1. Load from file
  try
  {
    const fileContent = await Deno.readTextFile(filePath);
    const loadedConfig = JSON.parse(fileContent) as Partial<T>; // Assume file has subset of T
    Object.assign(currentConfig, loadedConfig);
  }
  catch (error: unknown)
  {
    if (error instanceof Deno.errors.NotFound)
    {
      console.info(`Configuration file not found at ${filePath}. Using defaults.`);
    }
    else
    {
      console.warn(
        `Failed to load/parse ${filePath}. Using defaults/env/prompt. Error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  // 2. Apply overrides (type Partial<T>), then environment variables
  for (const keyAsString in currentConfig)
  {
    const key = keyAsString as keyof T;
    const options = metadataMap.get(key) ?? {};
    let valueApplied = false;

    // Apply overrideConfig (base types) first
    if (overrideConfig && key in overrideConfig)
    {
      const overrideValue = overrideConfig[key];
      // Check for undefined because Partial<T> allows undefined values
      if (overrideValue !== undefined)
      {
        console.info(`Using override value for config key '${String(key)}'.`);
        currentConfig[key] = overrideValue;
        valueApplied = true;
      }
    }

    // If no override applied, check environment variable
    if (!valueApplied && options.envOverride)
    {
      const envValue = Deno.env.get(options.envOverride);
      if (envValue !== undefined && envValue !== '')
      {
        console.info(`Using environment variable ${options.envOverride} for config key '${String(key)}'.`);
        // TODO: Consider type coercion based on actualDefaultConfig[key] type?
        currentConfig[key] = envValue as T[typeof key];
        // valueApplied = true; // No need to set this, env is fallback only if override absent
      }
    }
  }

  // 3. Prompt for Falsy Values if Needed
  let needsSaveAfterPrompt = false;
  for (const [key, options] of metadataMap.entries())
  {
    if (options.promptIfFalsy && !currentConfig[key])
    { // Check if falsy
      let promptMessage = `Configuration needed for '${String(key)}'.`;
      if (typeof options.promptIfFalsy === 'string')
      {
        promptMessage = options.promptIfFalsy;
      }
      else if (options.envOverride)
      {
        promptMessage = `Please enter value for '${String(key)}' (or set env var ${options.envOverride}):`;
      }
      else
      {
        promptMessage = `Please enter value for '${String(key)}':`;
      }

      // Use Deno.prompt - requires --allow-env implicitly, sometimes --allow-read/write for tty
      const userInput = prompt(promptMessage);

      if (userInput === null)
      {
        throw new Error(`Configuration incomplete: User cancelled prompt for key '${String(key)}'.`);
      }

      console.info(`Received user input for config key '${String(key)}'.`);
      // Simple string assignment. Caller might need coercion.
      // Assigning string from prompt. May not match original type T[K].
      currentConfig[key] = userInput as T[typeof key];
      needsSaveAfterPrompt = true;
    }
  }

  /** Writes the current configuration state to the persistent file. */
  async function saveConfig(): Promise<void>
  {
    try
    {
      const jsonString = JSON.stringify(currentConfig, null, 2);
      await Deno.writeTextFile(filePath, jsonString);
    }
    catch (error: unknown)
    {
      console.error(
        `Failed to save configuration to ${filePath}. Error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    }
  }

  // 4. Save immediately if any values were prompted
  if (needsSaveAfterPrompt)
  {
    console.info('Saving configuration after receiving user input...');
    await saveConfig();
  }

  // 5. Return API
  return {
    /** Retrieves a configuration value by key (synchronous). */
    get<K extends keyof T>(key: K): T[K]
    {
      return currentConfig[key];
    },

    /** Sets a configuration value by key and persists the change (asynchronous). */
    async set<K extends keyof T>(key: K, value: T[K]): Promise<void>
    {
      if (!(key in actualDefaultConfig))
      { // Check against the original structure
        throw new Error(`initConfig(): Attempted to set unknown config key: ${String(key)}`);
      }
      currentConfig[key] = value;
      await saveConfig();
    },

    /** Gets the full path to the configuration file. */
    getConfigFilePath(): string
    {
      return filePath;
    },

    /** Custom serialization for JSON.stringify */
    toJSON(): T
    {
      return currentConfig;
    },

    /** Custom inspection formatting for console.log / Deno.inspect (Deno 2+) */
    [Symbol.for('Deno.customInspect')](): string
    {
      // Return the same pretty-printed JSON representation
      return JSON.stringify(currentConfig, null, 2);
    },
  };
}
