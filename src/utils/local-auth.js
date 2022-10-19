/*
* local-auth.
* 
* Archivo con middleware para autentificar un usuario.
*/

// Importación de módulos NPM o librerías nativas
const passport = require('passport')
// Importación de modelos
const User = require('../models/userModel')
const Log = require('../models/logModel')
// Importación de funciones/definición de objetos
const LocalStrategy = require('passport-local').Strategy

passport.serializeUser((user, done) => {
    done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
    const user = await User.findById(id)
    done(null, user)
})

passport.use('local-login', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
}, async (req, email, password, done) => {
    try {
        if (!req.body) return done(null, false, req.flash('errorMessage', 'Favor de llenar el formulario'))

        const user = await User.findOne({ email })
        if (!user) return done(null, false, req.flash('errorMessage', 'Usuario y/o contraseña inválidas.'))

        const isMatch = await user.comparePassword(password)
        if (!isMatch) return done(null, false, req.flash('errorMessage', 'Usuario y/o contraseña inválidas.'))

        const log = new Log()
        log.saveLog(user._id, user.email, 'login', 'Inició sesión', undefined)
        return done(null, user)
    } catch (error) {
        return done(null, false, req.flash('errorMessage', 'Hubo un error en la conexión en el servidor. Verifique la estabilidad de la base de datos y vuélvalo a intentar.'))
    }
}))