declare global {
    namespace NodeJS {
        interface ProcessEnv {
            /**
             * Path to JSON file with Google service account key. Mandatory value
             */
            GOOGLE_SERVICE_ACCOUNT_KEY?: string;
            /**
             * Name of service account used to sign JWT token for Pub/Sub 
             * push subscription request. Optional value, if not provided - authentication not used
             */
            JWT_SERVICE_ACCOUNT_NAME?: string;
        }
    }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {};
