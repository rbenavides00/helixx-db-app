/*
* database.js
* 
* Archivo responsable de conectar a la base de datos usando MongoClient
*/

// Importación de módulos NPM o librerías nativas
const { MongoClient } = require('mongodb')

const url = process.env.MONGODB_URL
const opts = { useNewUrlParser: true }

async function connect() {
    return MongoClient.connect(url, opts)
}

module.exports = connect