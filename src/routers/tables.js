/*
* tables.js
* 
* Archivo que almacena las rutas de Tablas
*/

// Importación de módulos NPM o librerías nativas
const fs = require('fs')
const path = require('path')
const express = require('express')
const parser = require('simple-excel-to-json')
// Importación de modelos
const Log = require('../models/logModel')
const Table = require('../models/tableModel')
// Importación de funciones/definición de objetos
const router = express.Router()
const auth = require('../utils/isAuthenticated')
const connect = require('../db/database')
const { getColls, dropColl, createColl, getDocs, insertDocs } = require('../db/dbFunctions')
const { exportExcel } = require('../utils/excelConverter')

// GET /tables
router.get('/tables', auth, async (req, res) => {
    try {
        const tables = await Table.find({}).lean().sort({ createdAt: 1 })
        if (req.useragent.isMobile) {
            res.render('tablesMobile', { title: 'Tablas', tables })
        } else {
            res.render('tables', { title: 'Tablas', tables })
        }
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

// POST /tables/download/:table (Descargar tabla por nombre)
router.post('/tables/download/:table', auth, async (req, res) => {
    try {
        const table = req.params.table
        const connection = await connect()
        const colls = await getColls(connection)
        let tableFound = false

        // ERROR HANDLER: Tabla no existe en base de datos
        for (let i = 0; i < colls.length; i++) {
            if (colls[i].name === table) tableFound = true
        }
        if (!tableFound) {
            req.flash('errorMessage', `La tabla que intentó consultar ("${table}") no existe.`)
            return res.redirect('/tables')
        }

        if (table === 'users' || table === 'logs' || table === 'tables') {
            req.flash('errorMessage', 'Acción denegada.')
            return res.redirect('/tables')
        }
            
        const docs = await getDocs(connection, table, {}, { _id: 0 }, 0, 0, {})
        const buff = await exportExcel(table, docs)
        const fileName = `helixx-db-${table}.xlsx`
        var fileContents = Buffer.from(buff, 'base64')
        var savedFilePath = path.join(__dirname, '/../private/files/', fileName)

        fs.writeFile(savedFilePath, fileContents, (error) => {
            if (error) throw error
            res.download(savedFilePath, (error) => {
                if (error) throw error
                const log = new Log()
                log.saveLog(req.user._id, req.user.email, 'downloadTable', `Se descargó la tabla "${table}"`, undefined)
                fs.unlink(savedFilePath, (error) => {
                    if (error) throw error
                })
            })
        })
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

// POST /tables/upload 
router.post('/tables/upload', auth, async (req, res) => {
    try {
        //ERROR HANDLER: No req.body = Se superó el límite de subida
        if (Object.keys(req.body).length === 0) {
            return res.redirect('/tables')
        }
        const table = req.body.coll_name.trim()

        // ERROR HANDLER: No se llenó el formulario
        if (!req.files ||
            Object.keys(req.files).length === 0 ||
            !table) {
            req.flash('errorMessage', 'Favor de llenar el formulario.')
            return res.redirect('/tables')
        }
        // ERROR HANDLER: Nombre de archivo inválido
        if (!table.match(/^[a-zA-Z0-9_.-]*$/) ||
            table.startsWith('system.') ||
            table === 'users' ||
            table === 'logs' ||
            table === 'tables' ||
            table.startsWith('.') ||
            table.endsWith('.') ||
            table.length === 0 ||
            table.length > 40) {
            req.flash('errorMessage', 'Favor de coincidir el formato solicitado de nombre de tabla. El nombre de la tabla no debe ser "users", "logs", ni "tables"; empezar con "system.", empezar con un punto, terminar con un punto ni contener carácteres especiales.')
            return res.redirect('/tables')
        }

        // Limpiar carpeta "/private/files" si es que tiene archivos
        const directory = path.join(__dirname, '/../private/files/')
        fs.readdir(directory, (error, files) => {
            if (error) throw error
            for (const file of files) {
                if (file !== '.gitignore') {
                    fs.unlink(path.join(directory, file), error => {
                        if (error) throw error
                    })
                }
            }
        })

        const uploadedFile = req.files.newFile
        const ext = path.extname(uploadedFile.name)
        const uploadPath = path.join(__dirname, '/../private/files/', uploadedFile.name)

        // ERROR HANDLER: No se subió un archivo con extensión XLSX, XLSX ni CSV
        if (ext !== '.xls' &&
            ext !== '.xlsx' &&
            ext !== '.csv') {
            req.flash('errorMessage', 'Favor de subir un archivo de tipo Excel (XLS, XLSX ó CSV).')
            return res.redirect('/tables')
        }

        const connection = await connect()
        const colls = await getColls(connection)

        // ERROR HANDLER: Nombre de tabla repetido
        for (let i = 0; i < colls.length; i++) {
            if (colls[i].name === table) {
                req.flash('errorMessage', `El nombre de la tabla debe ser único. La tabla "${table}" ya existe.`)
                return res.redirect('/tables')
            }
        }

        await uploadedFile.mv(uploadPath)
        const data = parser.parseXls2Json(uploadPath)
        const sample = data[0][0]
        var sampleColumns = 0

        fs.unlink(uploadPath, (error) => {
            if (error) throw error
        })

        // ERROR HANDLER: Alguna columna tiene un formato inválido
        for (const key in sample) {
            if (!key.match(/^[a-zA-Z0-9_ .-]*$/) ||
                key === '_id' ||
                key.startsWith('.') ||
                key.endsWith('.') ||
                key.length > 40) {
                req.flash('errorMessage', `Archivo rechazado. Las columnas de las tablas no pueden ser "_id", tener espacios en blanco, empezar con un punto, terminar con un punto, tener más de 40 carácteres, ni contener carácteres especiales.`)
                return res.redirect('/tables')
            }
            ++sampleColumns
        }

        // ERROR HANDLER: Evitar subir una tabla con 1 columna
        if (sampleColumns < 2) {
            req.flash('errorMessage', `Archivo rechazado. El mínimo número de columnas es de 2.`)
            return res.redirect('/tables')
        }

        await createColl(connection, table)
        await insertDocs(connection, table, data[0])
        const log = new Log()
        log.saveLog(req.user._id, req.user.email, 'createTable', `Se creó la tabla "${table}"`, table)
        const newTable = new Table({ name: table })
        await newTable.save()
        req.flash('successMessage', `Se creó la tabla "${table}" exitosamente.`)
        res.redirect('/tables')
    } catch (error) {
        req.flash('errorMessage', `Hubo un error al subir la tabla. Intenta recreando el formato de la tabla desde cero. Detalles del error: ${error}`)
        return res.redirect('/tables')
    }
})

// POST /tables/delete/:table (Borrar tabla por nombre)
router.post('/tables/delete/:table', auth, async (req, res) => {
    try {
        const table = req.params.table

        if (table === 'users' || table === 'logs' || table === 'tables') {
            req.flash('errorMessage', `No se puede eliminar la tabla "${table}".`)
            return res.redirect('/tables')
        }

        const connection = await connect()

        if (req.body.confirmation_name === table) {
            await dropColl(connection, table)
            const log = new Log()
            log.saveLog(req.user._id, req.user.email, 'deleteTable', `Se eliminó la tabla "${table}"`, table)
            await Table.findOneAndDelete({ name: table })
            req.flash('successMessage', `Se eliminó la tabla "${table}" exitosamente.`)
            return res.redirect('/tables')
        } else {
            req.flash('errorMessage', 'El nombre que proporcionó no concuerda con el de la tabla que desea eliminar.')
            return res.redirect('/tables')
        }
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

module.exports = router