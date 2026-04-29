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
    url: 'file:./chat.db'
});

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    content TEXT,
    user TEXT
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
    
    socket.on('chat message', async (msg, user) => {
        let result
        try {
            result = await db.execute({
                sql: 'INSERT INTO messages (content, user) VALUES (:msg, :username)',
                args: { msg, username: socket.handshake.auth.username || 'Anonymous' }
            });
        }
        catch (e) {
            console.error(e);
            return
        }

        io.emit('chat message', msg, result.lastInsertRowid?.toString(), socket.handshake.auth.username || 'Anonymous');
    });

    console.log('socket.recovered:', socket.recovered); // <-- Verifica si el socket se ha recuperado
    console.log(socket.handshake.auth); // <-- Verifica los datos de autenticación en el handshake
    if (!socket.recovered) { // <-- Recupera mensajes sin conexión
        try {
            const result = await db.execute({
                sql: 'SELECT id, content, user FROM messages where id > ?',
                args: [socket.handshake.auth.serverOffset || 0]
            });
            result.rows.forEach(row => {
                socket.emit('chat message', row.content, row.id.toString(), row.user);
            });
        }
        catch (e) {
            console.error(e);
            return
        }
    }

});


server.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
