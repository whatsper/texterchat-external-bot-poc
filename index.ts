import express from 'express';
import { createHttpTerminator } from 'http-terminator';
import { Socket } from 'net';
import { createRoutes } from './routes';
import { composeAppRegistry } from './services';

let isReady = true;
let isShutdown = false;

const services = composeAppRegistry();
const app = express();
app.use(express.json({
    limit: '5mb',
}));
// Container lifecycle hooks checks
app.get(
    '/liveness',
    (req, res) => {
        console.debug(`Liveness probe requested. Result: ${isShutdown ? 'SHUTDOWN' : 'LIVE'}`);
        res.sendStatus(isShutdown ? 503 : 200);
    }
);
app.get(
    '/readiness',
    (req, res) => {
        console.debug(`Readiness probe requested. Result: ${isShutdown || !isReady ? 'UNREADY' : 'READY'}`);
        res.sendStatus(isShutdown || !isReady ? 503 : 200);
    }
);
app.use(createRoutes(services));

function shutdown(){
    isReady = false;
    isShutdown = true;
    setTimeout(
        closeServer,
        5000
    );
}

process.once('uncaughtException', (err: Error, origin: string) => {
    console.error(
        `Uncaught exception: ${err.message} \n${err.stack})\n Exception origin: ${origin}`
    );
    shutdown();
});

process.once('SIGTERM', function onSigterm() {
    console.warn(`Got SIGTERM. Graceful shutdown start ${new Date().toISOString()}`);
    shutdown();
});

const server = app.listen(process.env.PORT ? parseInt(process.env.PORT) : 4000, '0.0.0.0', function(){
    console.info('Server listening', server.address(), {});
});

server.on('clientError', (err: Error & { code: string }, socket: Socket) => {
    console.warn(`Client error${err.code ? `: ${err.code}` : ''}`, err, {});
    if (err.code === 'ECONNRESET' || !socket.writable) {
        return;
    }
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

const httpTerminator = createHttpTerminator({
    gracefulTerminationTimeout: 5000,
    server,
});

function closeServer() {
    console.info('Closing server...');
    httpTerminator
        .terminate()
        .then(() => {
            console.info('Server closed');
            process.exit();
        })
        .catch((error) => {
            console.error('Error closing server', error);
            process.exit(1);
        });
}
