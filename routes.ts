import { Config } from './config';
import express from 'express';
import { verifyPubSubToken } from './verifyPubSubToken';

export function createRoutes(
    {
        config,
        firestore,
    }: {
        config: Config;
        firestore: FirebaseFirestore.Firestore;
    }
){
    const routes = express();

    routes.post(
        '/webhook',
        async (request, response) => {
            console.log('Received webhook request', JSON.stringify({body: request.body, headers: request.headers}));
            // Verify that the push request originates from Cloud Pub/Sub if service account name is provided.
            if (config.jwtServiceAccountName) {
                const bearer = request.header('Authorization');
                if (!bearer) {
                    response.sendStatus(401);
                    return;
                }
                const token = bearer.replace(/^Bearer/, '');
                const verified = await verifyPubSubToken(token, config.jwtServiceAccountName);
                if (!verified) {
                    response.sendStatus(401);
                    return;
                }
            }

            console.log('Received push request', request.body);

            response.sendStatus(200);
        }
    );

    return routes;
}
