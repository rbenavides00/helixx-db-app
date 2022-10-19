/*
* mongoose.js
* 
* Archivo responsable de conectar a la base de datos usando la librería Mongoose
*/
// Importación de módulos NPM o librerías nativas
const mongoose = require('mongoose')

mongoose.connect(process.env.MONGODB_URL, {
    useNewUrlParser: true
})

const conn = mongoose.connection

conn.on('connected', () => {
    console.log('Conexión creada desde Mongoose')
})
conn.on('disconnected', () => {
    console.log('Conexión de Mongoose desconectada')
})
conn.on('error', (error) => {
    throw `Error de conexión de Mongoose: ${error}`
})