import { createAjv } from './ajv';
import { RegistryComposer } from './di/registryComposer';
import { createFirebaseServices } from './firebase';
import { createConfig } from './config';

/**
 * Instantiate all the services that are needed for the application to run.
 */
export function composeAppRegistry() {
    return new RegistryComposer()
        .add(createAjv)
        .add(createConfig)
        .add(createFirebaseServices)
        .compose();
}
