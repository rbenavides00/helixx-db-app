/*
* users.js
* 
* Archivo que almacena las rutas de Usuarios
*/

// Importación de módulos NPM o librerías nativas
const express = require('express')
const validator = require('validator')
// Importación de modelos
const User = require('../models/userModel')
const Log = require('../models/logModel')
// Importación de funciones/definición de objetos
const router = express.Router()
const auth = require('../utils/isAuthenticated')

// GET /users
router.get('/users', auth, async (req, res) => {
    try {
        const users = await User.find({}).lean().sort({ createdAt: 1 })
        if (req.useragent.isMobile) {
            res.status(200).render('usersMobile', { title: 'Usuarios', users })
        } else {
            res.status(200).render('users', { title: 'Usuarios', users })
        }
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

// POST /users/signup (Registrar usuario)
router.post('/users/signup', auth, async (req, res) => {
    try {
        let { email, password, confirm_password } = req.body

        if (!email || !password || !confirm_password) {
            req.flash('errorMessage', 'Llena todos los campos.')
            return res.redirect('/users')
        }

        email = email.trim().toLowerCase()

        if (!validator.isEmail(email)) {
            req.flash('errorMessage', 'Ingrese un correo electrónico válido.')
            return res.redirect('/users')
        }

        const userFound = await User.findOne({ email })

        if (userFound) {
            req.flash('errorMessage', 'El correo electrónico ya ha sido tomado.')
            return res.redirect('/users')
        }
        if (password !== confirm_password) {
            req.flash('errorMessage', 'Las contraseñas no coinciden.')
            return res.redirect('/users')
        }
        if (password.length < 8) {
            req.flash('errorMessage', 'Las contraseña es muy débil. La contraseña debe tener como mínimo 8 carácteres.')
            return res.redirect('/users')
        }
        const user = new User({ email, password, role: 'user' })
        await user.save()
        const log = new Log()
        log.saveLog(req.user._id, req.user.email, 'createUser', `Se creó el usuario "${email}"`, email)
        req.flash('successMessage', `Se creó el usuario "${email}".`)
        return res.redirect('/users')
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

// POST /users/delete/:id (Borrar usuario por id)
router.post('/users/delete/:id', auth, async (req, res) => {
    try {
        const user = await User.findById({ _id: req.params.id })

        if (user) {
            if (user.role === 'admin') {
                req.flash('errorMessage', 'No se puede borrar esta cuenta ya que es de administrador.')
                return res.redirect('/users')
            }
            if (req.body.confirmation_email === user.email) {
                await User.findOneAndDelete({ _id: user.id })
                const log = new Log()
                log.saveLog(req.user._id, req.user.email, 'deleteUser', `Se eliminó el usuario "${user.email}"`, user.email)
                req.flash('successMessage', `Se eliminó el usuario "${user.email}" exitosamente.`)
                return res.redirect('/users')
            } else {
                req.flash('errorMessage', 'El correo electrónico que proporcionó no concuerda con el del usuario que desea eliminar.')
                return res.redirect('/users')
            }
        } else {
            req.flash('errorMessage', 'Identificación no reconocida.')
            return res.redirect('/users')
        }
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

//Herramientas de administrador
// POST /admin/signup (Registrar administrador)
router.post('/admin/signup', async (req, res) => {
    try {
        let { email, password, confirm_password, secret } = req.body
        email = email.trim().toLowerCase()

        if (!validator.isEmail(email))
            return res.status(400).send('[HELIXX-DB]: Ingrese un correo electrónico válido.')

        if (!email || !password || !confirm_password || !secret)
            return res.status(400).send('[HELIXX-DB]: Llena todos los campos.')

        if (password.length < 8)
            return res.status(400).send('[HELIXX-DB]: Las contraseña es muy débil. La contraseña debe tener como mínimo 8 carácteres.')
        
        const userFound = await User.findOne({ email })

        if (userFound)
            return res.status(400).send('[HELIXX-DB]: Ya hay un usuario con ese correo electrónico.')
        if (password !== confirm_password || secret !== process.env.ADMIN_SECRET)
            return res.status(400).send('[HELIXX-DB]: Las contraseñas o el secreto de administrador no coinciden.')

        const user = new User({ email, password, role: 'admin' })
        await user.save()
        const log = new Log()
        log.saveLog(user._id, email, 'createAdmin', `Se creó el usuario administrador "${email}"`, email)
        return res.status(201).send(`[HELIXX-DB]: Se creó el usuario administrador "${email}" exitosamente.`)
    } catch (error) {
        res.status(500).send(`[HELIXX-DB]: Se obtuvo el siguiente error: ${error}`)
    }
})

// POST /admin/delete (Borrar administrador)
router.post('/admin/delete', async (req, res) => {
    try {
        const { email, confirmation_email, secret } = req.body

        if (!email || !confirmation_email || !secret)
            return res.status(400).send('[HELIXX-DB]: Llena todos los campos.')

        const user = await User.findOne({ email })

        if (user) {
            if (user.role !== 'admin')
                return res.status(400).send('[HELIXX-DB]: El usuario no es administrador. Si desea eliminarlo, hágalo desde la aplicación web.')
            if (confirmation_email === user.email && secret === process.env.ADMIN_SECRET) {
                await User.findOneAndDelete({ email })
                const log = new Log()
                log.saveLog(user._id, user.email, 'deleteAdmin', `Se eliminó el usuario administrador ${user.email}`, user.email)
                return res.status(200).send(`[HELIXX-DB]: Se eliminó el usuario administrador "${email}" exitosamente.`)
            } else {
                return res.status(400).send('[HELIXX-DB]: Los correos electrónicos o el secreto de administrador no concuerdan.')
            }
        } else {
            return res.status(400).send('[HELIXX-DB]: No se encontró un administrador con ese correo electrónico.')
        }
    } catch (error) {
        res.status(500).send(`[HELIXX-DB]: Se obtuvo el siguiente error: ${error}`)
    }
})

module.exports = router