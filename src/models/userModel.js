/*
* userModel.js
* 
* Archivo que define el modelo de mongoose de "User".
*/

// Importación de librerías
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const { Schema } = mongoose

// Esquema de objeto "User"
const userSchema = new Schema({
    email: {
        type: String,
        unique: true,
        required: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    }
}, {
    timestamps: true
})

userSchema.pre('save', async function (next) {
    const user = this
    user.password = await bcrypt.hash(user.password, 8)
    next()
})

userSchema.methods.comparePassword = function (password) {
    return bcrypt.compare(password, this.password)
}

const User = mongoose.model('User', userSchema)

module.exports = User