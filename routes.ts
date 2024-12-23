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

    const initMenuMessage = {
        type: 'list',
        text: 'Hello! I am an external (micro-)bot connected to Texterchat. Please select an option below to get started.',
        list: {
            button: 'Menu',
            sections: [
                {
                    title: 'Something from this bot',
                    rows: [
                        {
                            title: 'Get my text messages',
                            payload: 'get_session_messages',
                        },
                        {
                            title: 'Send random image',
                            payload: 'random_image',
                        },
                    ],
                },
                {
                    title: 'Return back',
                    rows: [
                        {
                            title: 'Back to texter bot',
                            payload: 'back_to_texter_bot',
                        },
                        {
                            title: 'Resolve chat',
                            payload: 'resolve',
                        },
                    ],
                },
            ],
        },
    }

    const repeatMenuMessage = {
        ...initMenuMessage,
        text: 'Any more questions? Please select an option below.',
    }

    const sendMessage = async (chatId: string, message: any) => {
        try {
            await callTexterApi('POST', '/api/v2/messages/send/' + chatId, message);
        } catch (error) {
            console.error('Error sending message', error);
        }
    }

    const sendMessageDelayed = (chatId: string, message: any, delayMs: number) => new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            sendMessage(chatId, message).then(() => resolve()).catch((error) => reject(error));
        }, delayMs);
    });

    routes.post(
        '/webhook',
        async (request, response) => {
            try {
                console.log(JSON.stringify({
                    message: 'Received webhook request',
                    metadata: {
                        body: request.body, 
                        headers: request.headers
                    },
                }));
                
                if (!await verifyRequest(request)) {
                    response.sendStatus(401);
                    return;
                }

                const { eventName, eventData } = request.body;

                if (
                    eventName === 'domain.chat.bot.setExternal' 
                    // Important: This event occurs also when the bot is set from external mode
                    // so need to make sure externalBot is true
                    && eventData.chat.externalBot
                ) {
                    console.log('Bot set to external mode. Sending initial menu message');
                    await sendMessage(eventData.chat._id, initMenuMessage);
                    response.sendStatus(200);
                    return;
                }

                if (
                    eventName !== 'domain.message.created'
                    || eventData.message.direction !== 'incoming'
                ) {
                    // Note: It can be configured what events to send, in texterchat configuration
                    // and in Pub/Sub subscription in addition to that
                    console.log('Ignoring unsupported event or message direction: ' + eventName);
                    response.sendStatus(200);
                    return;
                }

                const chatId = eventData.message.parent_chat,
                    chat = await callTexterApi('GET', '/api/v2/chats/' + chatId);

                if (eventData.message.timestamp < chat.lastIncomingMessageTimestamp) {
                    // This is important to check because all the webhooks is asynchronous
                    // and one may be delayed slightly more than other,
                    // so we can get messages out of order and some of messages that sent before
                    // bot set to external mode
                    console.log('Ignoring message older than last chat update');
                    response.sendStatus(200);
                    return;
                }

                if (!chat.externalBot || chat.status !== 0) {
                    console.log('Ignoring message from chat not in external bot mode');
                    response.sendStatus(200);
                    return;
                }

                if (eventData.message.type !== 'postback') {
                    console.log('Ignoring message that is not a postback');
                    await sendMessage(chatId, {
                        ...repeatMenuMessage,
                        text: 'Please select an option from the menu.',
                    });
                    response.sendStatus(200);
                    return;
                }

                if (eventData.message.postback.payload === 'get_session_messages') {
                    const botSessionId = chat.botState.id;
                    if (typeof botSessionId !== 'string') {
                        console.warn('Bot session ID not found');
                        await sendMessage(chatId, {
                            type: 'text',
                            text: 'Sorry, can`t find previous messages.',
                        });
                    } else {
                        // Note: This will get only messages before chat was set to external bot.
                        // After that you need to record session messages on your side if you need them.
                        const messagesResponse = await callTexterApi('GET', '/api/v2/messages/chat/' + chatId, { botSessionId });
                        const textMessages = messagesResponse.messages
                            .filter((message: any) => message.type === 'text' && message.direction === 'incoming')
                            .map((message: any) => message.text)
                            .join('\n\n');

                        if (textMessages.length) {
                            await sendMessage(chatId, {
                                type: 'text',
                                text: 'You wrote before:\n\n' + textMessages,
                            });
                        } else {
                            await sendMessage(chatId, {
                                type: 'text',
                                text: 'I can`t find any text messages from you.',
                            });
                        }
                    }
                    await sendMessageDelayed(chatId, repeatMenuMessage, 3000);
                } else if (eventData.message.postback.payload === 'random_image') {
                    const randomImageUrl = await getRandomPhotoURL();
                    if (randomImageUrl) {
                        await sendMessage(chatId, {
                            type: 'media',
                            media: [{
                                mediaType: 'image',
                                url: randomImageUrl,
                            }],
                        });
                    } else {
                        await sendMessage(chatId, {
                            type: 'text',
                            text: 'Sorry, can`t get a random image right now.',
                        });
                    }
                    await sendMessageDelayed(chatId, repeatMenuMessage, 3000);
                } else if (eventData.message.postback.payload === 'back_to_texter_bot') {
                    await callTexterApi('PATCH', '/api/v2/chats/' + chatId, {
                        externalBot: false,
                    });
                    await sendMessage(chatId, {
                        type: 'text',
                        text: 'Ok, next messages will be handled by Texterchat bot, depending on the flow.',
                    });
                } else if (eventData.message.postback.payload === 'resolve') {
                    await callTexterApi('POST', `/api/v2/chats/${chatId}/resolve`);
                    await sendMessage(chatId, {
                        type: 'text',
                        text: 'Chat resolved.',
                    });
                } else {
                    console.log('Ignoring unsupported postback: ' + eventData.message.postback.payload);
                }

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
        } else {
            return true;
        }
    }

    async function getRandomPhotoURL(){
        const response = await fetch(
            'https://picsum.photos/500',
            {
                redirect: 'follow',
                method: 'GET',
            }
        );
        if (!response.ok) {
            return null;
        }
        return response.url;
    }

    return routes;
}
