/*
* login.js
* 
* Archivo que almacena las rutas de Inicio de sesión
*/

// Importación de módulos NPM o librerías nativas
const express = require('express')
const passport = require('passport')
// Importación de modelos
const Log = require('../models/logModel')
// Importación de funciones/definición de objetos
const router = express.Router()
const auth = require('../utils/isAuthenticated')

// GET /
router.get('/', (req, res) => {
    try {
        if (req.user) {
            return res.redirect('/tables')
        } else {
            res.render('login', { title: 'Iniciar sesión' })
        }
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

// GET /login
router.get('/login', (req, res) => {
    try {
        if (req.user) {
            return res.redirect('/tables')
        } else {
            res.render('login', { title: 'Iniciar sesión' })
        }
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

// POST /login (Inicio de sesión)
router.post('/login', passport.authenticate('local-login', {
    successRedirect: '/tables',
    failureRedirect: '/login',
    passReqToCallback: true
}))

// POST /logout (Cerrar sesión)
router.get('/logout', auth, (req, res) => {
    try {
        const log = new Log()
        log.saveLog(req.user._id, req.user.email, 'logout', 'Cerró sesión', undefined)
        req.logout(() => {
            res.redirect('/login')
        })
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

module.exports = router