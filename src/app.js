/*
* app.js
* 
* Archivo que crea la aplicación, con sus inicializaciones y configuraciones
*/

// Importación de módulos NPM o librerías nativas
const path = require('path')
const express = require('express')
const engine = require('ejs-mate')
const session = require('express-session')
const flash = require('connect-flash')
const fileUpload = require('express-fileupload')
const passport = require('passport')
const useragent = require('express-useragent')
// Importación de funciones/definición de objetos
const auth = require('./utils/isAuthenticated')

// Inicializaciones
const app = express()
require('./db/mongoose')
require('./utils/local-auth')

// Configuraciones
app.set('views', path.join(__dirname, 'views'))
const publicDirectoryPath = path.join(__dirname, '../public')
app.use(express.static(publicDirectoryPath))
app.engine('ejs', engine)
app.set('view engine', 'ejs')
app.set('port', process.env.PORT || 3000)
app.disable('etag')

// Middlewares
app.use(express.urlencoded({ extended: true }))
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
app.use(flash())
app.use(passport.initialize())
app.use(passport.session())
app.use((req, res, next) => {
    app.locals.errorMessage = req.flash('errorMessage')
    app.locals.warningMessage = req.flash('warningMessage')
    app.locals.successMessage = req.flash('successMessage')
    app.locals.user = req.user
    next()
})
app.use(fileUpload({
    limits: {
        fileSize: Number(process.env.FILE_LIMIT) * 1024 // 150 KB DEFAULT
    },
    limitHandler: (req, res, next) => {
        req.flash('warningMessage', `El archivo ha superado el límite de subida (${process.env.FILE_LIMIT} KB).`)
        next()
    }
}))
app.use(useragent.express())

// Routers
app.use(require('./routers/login'))
app.use(require('./routers/view'))
app.use(require('./routers/history'))
app.use(require('./routers/tables'))
app.use(require('./routers/users'))

// Router para página no encontrada (GET)
app.get('*', auth, (req, res) => {
    res.status(404).render('404', {
        title: 'Error 404',
        errorTitle: 'Solicitud "GET" no reconocida',
        unknownUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        url: `${req.protocol}://${req.get('host')}`
    })
})

module.exports = app