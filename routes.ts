import { Config } from './config';
import express, { Request } from 'express';
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
    const chatsCollection = firestore.collection('chats');

    routes.post(
        '/webhook',
        async (request, response) => {
            try {
                console.log('Received webhook request', JSON.stringify({body: request.body, headers: request.headers}));
                
                if (!await verifyRequest(request)) {
                    response.sendStatus(401);
                    return;
                }

                const { eventName, eventData } = request.body;

                if (eventName !== 'domain.message.created') {
                    console.log('Ignoring unsupported event', eventName);
                    response.sendStatus(200);
                    return;
                }

                const chat = await callTexterApi('GET', '/api/v2/chats/' + eventData.message.parent_chat);

                console.log('Received message', JSON.stringify({
                    chat,
                    message: eventData.message,
                }));

                response.sendStatus(200);
            } catch (error) {
                console.error('Error processing webhook request', error);
                response.sendStatus(500);
            }
        }
    );

    async function callTexterApi(method: string, path: string, params?: any){
        let url = config.texterBaseUrl + path;
        if (method === 'GET' && params && typeof params === 'object') {
            const queryParams = new URLSearchParams();
            for (const key in params) {
                queryParams.set(key, params[key]);
            }
            url += `?${queryParams.toString()}`;
        }
        const response = await fetch(
            url,
            {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + config.texterApiToken,
                },
                ...method !== 'GET'
                ? {
                    body: JSON.stringify(params),
                }
                : {},
            }
        );
        if (!response.ok) {
            const data = await response.text();
            throw new Error('Error calling TexterChat API. Status: ' + response.status + '; Response: ' + data);
        }
        return await response.json();
    }

    // Verify that the push request originates from Cloud Pub/Sub if service account name is provided.
    async function verifyRequest(request: Request){
        if (config.jwtServiceAccountName) {
            const bearer = request.header('Authorization');
            if (!bearer) {
                return false;
            }
            const token = bearer.replace(/^Bearer/, '');
            const verified = await verifyPubSubToken(token, config.jwtServiceAccountName);
            return verified;
        }
    }

    return routes;
}
