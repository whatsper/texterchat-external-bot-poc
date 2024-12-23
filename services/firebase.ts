import { cert, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let initialized = false;

function initialize(key: ServiceAccount) {
    if (initialized) {
        return;
    }

    initializeApp({
        // We populate `googleAppCredentials` above synchronously on file load or throw error, so it always not undefined
        credential: cert(key),
        projectId: key.projectId,
    });
    initialized = true;
}

export function createFirebaseServices(
    deps: {
        config: { googleAppCredentials: ServiceAccount };
    }
) {
    initialize(deps.config.googleAppCredentials);
    const firestore = getFirestore();
    firestore.settings({ ignoreUndefinedProperties: true });
    return {
        firestore,
    };
}
