import express from 'express';
import logger from 'morgan';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';
import { Server } from 'socket.io';
import { createServer } from 'node:http';

dotenv.config();
const port = process.env.PORT ?? 3000;

const app = express();
const server = createServer(app); // Create an HTTP server
const io = new Server(server, {
    connectionStateRecovery: {maxDisconnectionDuration: 10000}} // Enable connection state recovery with a maximum disconnection duration of 10 seconds
); // Attach Socket.IO to the HTTP server

const db = createClient({
    url: 'libsql://chat-sergioreq.aws-eu-west-1.turso.io',
    authToken: process.env.DB_TOKEN
});

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    content TEXT,
    username TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

app.use(logger('dev'));

app.get('/', (req, res) => {
    res.sendFile('./client/index.html', { root: '.' });
});

io.on('connection', async (socket) => {
    console.log('a user has connected');

    socket.on('disconnect', () => {
        console.log('a user has disconnected');
    });
    
    socket.on('chat message', async (msg) => {
        let result
        try {
            result = await db.execute({
                sql: 'INSERT INTO messages (content) VALUES (:msg)',
                args: { msg }
            });
        }
        catch (e) {
            console.error(e);
            return
        }

        io.emit('chat message', msg, result.lastInsertRowid?.toString());
    });

});


server.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
