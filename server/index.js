/* ========================================
 * SERVIDOR DE CHAT - Express + Socket.IO + SQLite
 * ========================================
 * Este archivo contiene el servidor completo del chat
 * Funcionalidades:
 * - API HTTP con Express
 * - WebSocket con Socket.IO para mensajes en tiempo real
 * - Base de datos SQLite local para persistencia de mensajes
 * ======================================== */

// ===== IMPORTS =====
import express from 'express';           // Framework web para manejar rutas HTTP
import logger from 'morgan';            // Middleware para logging de peticiones HTTP
import dotenv from 'dotenv';            // Cargar variables de entorno desde .env
import { createClient } from '@libsql/client';  // Cliente para base de datos Turso/LibSQL
import { Server } from 'socket.io';     // Servidor WebSocket para chat en tiempo real
import { createServer } from 'node:http'; // Servidor HTTP nativo de Node.js

// ===== CONFIGURACIÓN INICIAL =====
dotenv.config();  // Cargar variables de entorno
const port = process.env.PORT ?? 3000;  // Puerto del servidor (3000 por defecto)

// ===== SERVIDORES =====
const app = express();                    // App Express para rutas HTTP
const httpServer = createServer(app);     // Servidor HTTP que Express usa
const io = new Server(httpServer, {       // Socket.IO servidor
    connectionStateRecovery: {maxDisconnectionDuration: 10000}  // Recuperar conexión si se pierde < 10s
});

// ===== BASE DE DATOS =====
const db = createClient({
    url: 'file:./chat.db'  // Base de datos SQLite local (se crea automáticamente)
});

// ===== CREACIÓN DE TABLA  =====
await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,  
        content TEXT,                          
        user TEXT                              
    );
`);

// ===== MIDDLEWARES =====
app.use(logger('dev'));  // Log de todas las peticiones HTTP

// ===== RUTAS HTTP =====
app.get('/', (req, res) => {
    // Servir el archivo HTML del cliente en la raíz
    res.sendFile('./client/index.html', { root: '.' });
});

// ===== SOCKET.IO - EVENTOS DE CONEXIÓN =====
io.on('connection', async (socket) => {
    console.log('Nuevo usuario conectado:', socket.id);

    // Evento cuando usuario se desconecta
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
    });
    
    // ===== MANEJO DE MENSAJES =====
    socket.on('chat message', async (msg) => {
        let result;
        try {
            // Guardar mensaje en base de datos
            result = await db.execute({
                sql: 'INSERT INTO messages (content, user) VALUES (:msg, :username)',
                args: { 
                    msg, 
                    username: socket.handshake.auth.username || 'Anónimo' 
                }
            });
        } catch (e) {
            console.error('Error guardando mensaje:', e);
            return;
        }

        // Enviar mensaje a TODOS los clientes conectados
        io.emit('chat message', 
            msg, 
            result.lastInsertRowid?.toString(),  // ID del mensaje para sincronización
            socket.handshake.auth.username || 'Anónimo'
        );
    });

    // ===== RECUPERACIÓN DE MENSAJES ANTIGUOS =====
    console.log('Recuperación:', socket.recovered);
    console.log('Datos auth:', socket.handshake.auth);
    
    if (!socket.recovered) {  // Solo si es nueva conexión (no recuperación)
        try {
            // Cargar mensajes más recientes (desde el último ID conocido)
            const result = await db.execute({
                sql: 'SELECT id, content, user FROM messages WHERE id > ? ORDER BY id',
                args: [socket.handshake.auth.serverOffset || 0]
            });
            
            // Enviar mensajes antiguos al nuevo cliente
            result.rows.forEach(row => {
                socket.emit('chat message', row.content, row.id.toString(), row.user);
            });
        } catch (e) {
            console.error('Error recuperando mensajes:', e);
        }
    }
});

// ===== INICIO DEL SERVIDOR =====
httpServer.listen(port, () => {
    console.log(`Servidor de chat corriendo en http://localhost:${port}`);
    console.log(`Total conexiones Socket.IO: ${io.engine.clientsCount}`);
});

