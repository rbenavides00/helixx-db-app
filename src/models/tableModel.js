/*
* tableModel.js
* 
* Archivo que define el modelo de mongoose de "Table".
*/

// Importación de librerías
const mongoose = require('mongoose')
const { Schema } = mongoose

// Esquema de objeto "Table"
const tableSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
}, {
    timestamps: true
})

const Table = mongoose.model('Table', tableSchema)

module.exports = Table