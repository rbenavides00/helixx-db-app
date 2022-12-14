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

// Validación de variables de ambiente
const fileLimit = Number(process.env.FILE_LIMIT)
const tableRowsDefault = Number(process.env.TABLE_ROWS_DEFAULT)
const tableRowsMin = Number(process.env.TABLE_ROWS_MIN)
const tableRowsMax = Number(process.env.TABLE_ROWS_MAX)

if (isNaN(fileLimit) ||
    isNaN(tableRowsDefault) ||
    isNaN(tableRowsMin) ||
    isNaN(tableRowsMax)) {
    throw new Error(`[VARIABLE DE AMBIENTE INVÁLIDA]: Alguno de los valores de FILE_LIMIT, TABLE_ROWS_DEFAULT, TABLE_ROWS_MIN ó TABLE_ROWS_MAX no es numérico.`)
}
if (tableRowsDefault <= 0 ||
    tableRowsMin <= 0 ||
    tableRowsMax <= 0) {
    throw new Error(`[VARIABLE DE AMBIENTE INVÁLIDA]: Alguno de los valores de TABLE_ROWS_DEFAULT, TABLE_ROWS_MIN ó TABLE_ROWS_MAX es menor o igual a 0.`)
}
if (!Number.isInteger(tableRowsDefault) ||
    !Number.isInteger(tableRowsMin) ||
    !Number.isInteger(tableRowsMax)) {
    throw new Error(`[VARIABLE DE AMBENTE INVÁLIDA]: Alguno de los valores de TABLE_ROWS_DEFAULT, TABLE_ROWS_MIN ó TABLE_ROWS_MAX es decimal.`)
}
if (tableRowsMin > tableRowsMax) {
    throw new Error(`[VARIABLE DE AMBENTE INVÁLIDA]: La variable TABLES_ROWS_MIN no puede ser mayor a TABLES_ROWS_MAX (${tableRowsMin} > ${tableRowsMax}).`)
}
if (tableRowsMin === tableRowsMax) {
    throw new Error(`[VARIABLE DE AMBENTE INVÁLIDA]: Las variables TABLES_ROWS_MIN y TABLES_ROWS_MAX no pueden tener el mismo valor (${tableRowsMin} = ${tableRowsMax}).`)
}
if (tableRowsDefault < tableRowsMin ||
    tableRowsDefault > tableRowsMax) {
    throw new Error(`[VARIABLE DE AMBENTE INVÁLIDA]: La variable TABLE_ROWS_DEFAULT debe estar dentro del rango de las variables TABLES_ROWS_MIN y TABLES_ROWS_MAX (El valor ${process.env.TABLE_ROWS_DEFAULT} no se encuentra dentro del rango: ${process.env.TABLE_ROWS_MIN} - ${tableRowsMax}).`)
}

module.exports = app