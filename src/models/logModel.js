/*
* logModel.js
* 
* Archivo que define el modelo de mongoose de "Log".
*/

// Importación de librerías
const mongoose = require('mongoose')
const { Schema } = mongoose

// Esquema de objeto "Log"
const logSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    email: {
        type: String,
        required: true,
        trim: true
    },
    actionType: {
        type: String,
        required: true,
        trim: true
    },
    actionDesc: {
        type: String,
        required: true,
        trim: true
    },
    affectedObj: {
        type: String,
        required: false,
        trim: true
    }
}, {
    timestamps: true
})

logSchema.methods.saveLog = async (user, email, actionType, actionDesc, affectedObj) => {
    const log = new Log({
        user,
        email,
        actionType,
        actionDesc,
        affectedObj
    })
    await log.save()
}

const Log = mongoose.model('Log', logSchema)

module.exports = Log