import express from 'express';
import logger from 'morgan';

import { Server } from 'socket.io';
import { createServer } from 'node:http';

const port = process.env.PORT ?? 3000;

const app = express();
const server = createServer(app); // Create an HTTP server
const io = new Server(server); // Attach Socket.IO to the HTTP server

app.use(logger('dev'));

app.get('/', (req, res) => {
    res.sendFile('./client/index.html', { root: '.' });
});

io.on('connection', (socket) => {
    console.log('a user has connected');

    socket.on('disconnect', () => {
        console.log('a user has disconnected');
    });
    
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });
});



server.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
