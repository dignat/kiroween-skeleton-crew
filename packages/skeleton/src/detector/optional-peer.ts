// The TensorFlow.js packages are optional peer dependencies, loaded only when an adapter's load()
// runs. This keeps `import '@skeleton-playground/core'` light, and lets an app that uses its own
// adapter (or only the MCP kit) skip the ~250 MB TensorFlow.js install.
const INSTALL_HINT = 'pnpm add --save-exact @tensorflow/tfjs';

/**
 * Runs a dynamic import of an optional peer package. If the package is not installed, throws an
 * error that names it and says how to install it, instead of a bare "Cannot find package".
 * Pass the import as a callback so bundlers still see the literal specifier.
 */
export async function importOptionalPeer<T>(packageName: string, adapterName: string, load: () => Promise<T>, extra?: string): Promise<T> {
  try {
    return await load();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const notFound = (error as { code?: string }).code === 'ERR_MODULE_NOT_FOUND' || /cannot find (package|module)|failed to resolve/i.test(message);
    if (notFound && message.includes(packageName)) {
      throw new Error(
        `The ${adapterName} adapter needs the optional package "${packageName}", which is not installed. ` +
          `Install it with: ${INSTALL_HINT}${extra ? ` ${extra}` : ''}`,
        { cause: error },
      );
    }
    throw error;
  }
}
