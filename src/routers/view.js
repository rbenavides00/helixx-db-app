/*
* view.js
* 
* Archivo que almacena las rutas de Ver tabla
*/

// Importación de módulos NPM o librerías nativas
const fs = require('fs')
const path = require('path')
const express = require('express')
const mongo = require('mongodb')
// Importación de modelos
const Log = require('../models/logModel')
// Importación de funciones/definición de objetos
const router = express.Router()
const auth = require('../utils/isAuthenticated')
const connect = require('../db/database')
const { getColls, getCollFields, getDocs, getDocsCount, findDoc, findDocAndUpdate, findDocAndDelete, insertDoc, createIndex, insertColumn, deleteColumn } = require('../db/dbFunctions')
const { arraysEqual } = require('../utils/arraysEqual')
const { exportExcel } = require('../utils/excelConverter')
const { pagination } = require('../utils/pagination')

// GET /tables/view/:table (Ver tabla por nombre)
router.get('/tables/view/:table', auth, async (req, res) => {
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

        // ERROR HANDLER: Evitar mostrar la tabla Users y Logs
        if (table === 'users' || table === 'logs' || table === 'tables') {
            req.flash('errorMessage', `No puedes administrar la tabla "${table}". Puedes visualizar su información en su respectiva página.`)
            return res.redirect('/tables')
        }

        // ERROR HANDLER: Evitar mal formato de page y limit
        if ((req.query.page && isNaN(req.query.page)) ||
            (req.query.limit && isNaN(req.query.limit)) ||
            req.query.page <= 0) {
            req.flash('errorMessage', 'Formato de filtros inválido. Intente cambiar los filtros de búsqueda e intente de nuevo.')
            return res.redirect(`/tables/view/${table}`)
        }

        res.locals.query = new URLSearchParams(req.query)
        let page, limit, skip, docs, docsCount
        var columnsToKeep = []
        var filters = {}
        var sort = {}
        page = req.query.page ? parseInt(req.query.page) : 1

        const columns = await getCollFields(connection, table)

        // GET sin query
        if (Object.keys(req.query).length === 0 && req.query.constructor === Object) {
            limit = 10
            columnsToKeep = columns
            skip = (limit - (limit * 2)) + (page * limit)
            docs = await getDocs(connection, table, filters, {}, limit, skip, sort)
            docsCount = await getDocsCount(connection, table, filters)
            // GET con query
        } else {
            // ERROR HANDLER: Búsqueda de query inválida (Evitar limit menor o mayor a 100)
            if (req.query.limit < 10 ||
                req.query.limit > 100) {
                req.flash('errorMessage', 'Formato de filtros inválido. Intente cambiar los filtros de búsqueda e intente de nuevo.')
                return res.redirect(`/tables/view/${table}`)
            }
            if (req.query.search_id) {
                if (req.query.search_id.match(/^[0-9a-fA-F]{24}$/)) {
                    filters['_id'] = mongo.ObjectId(req.query.search_id)
                } else {
                    req.flash('errorMessage', `El valor que ingresó como ID no es válido.`)
                    return res.redirect(`/tables/view/${table}`)
                }
            }
            limit = !req.query.limit ? 10 : parseInt(req.query.limit)

            for (let i = 0; i < columns.length; i++) {
                if (req.query[`show_${columns[i]}`]) columnsToKeep.push(columns[i])
                if (req.query[`sort_${columns[i]}`]) {
                    if (parseInt(req.query[`sort_${columns[i]}`]) !== 1 && parseInt(req.query[`sort_${columns[i]}`]) !== -1) {
                        req.flash('errorMessage', 'Formato de filtros inválido. Intente cambiar los filtros de búsqueda e intente de nuevo.')
                        return res.redirect(`/tables/view/${table}`)
                    }
                    sort[columns[i]] = req.query[`sort_${columns[i]}`]
                }
                if (req.query[`search_${columns[i]}`])
                    filters[columns[i]] = !isNaN(req.query[`search_${columns[i]}`]) ?
                        { $in: [req.query[`search_${columns[i]}`], parseFloat(req.query[`search_${columns[i]}`])] } : // TRUE: Se busca un número en formato String o Float
                        req.query[`search_${columns[i]}`] // FALSE: Se busca un String
            }

            // ERROR HANDLER: Evitar mostrar 0 columnas de l tabla
            if (columnsToKeep.length < 2) {
                req.flash('errorMessage', 'El mínimo de columnas a buscar es de 2. Cambie los filtros de búsqueda e intente de nuevo.')
                return res.redirect(`/tables/view/${table}`)
            }

            if (req.query.search) {
                await createIndex(connection, table)
                filters = { $text: { $search: req.query.search } }
            }

            skip = (limit - (limit * 2)) + (page * limit)
            docs = await getDocs(connection, table, filters, {}, limit, skip, sort)
            docsCount = await getDocsCount(connection, table, filters)
        }

        const pageCount = Math.ceil(docsCount / limit)
        const pageArray = pagination(page, pageCount)

        if (page > parseInt(pageArray[pageArray.length - 1]) || docsCount === 0) {
            req.flash('errorMessage', 'No se encontraron resultados a su búsqueda. Cambie los filtros de búsqueda e intente de nuevo.')
            return res.redirect(`/tables/view/${table}`)
        }

        if (req.useragent.isMobile) {
            res.render('viewMobile', {
                title: `Ver tabla ${table.charAt(0).toUpperCase() + table.slice(1)}`,
                table,
                columns,
                columnsToKeep,
                docs,
                pageArray,
                firstAccess: Object.keys(req.query).length === 0 && req.query.constructor === Object,
                docsCount,
                isMobile: true
            })
        } else {
            res.render('view', {
                title: `Ver tabla ${table.charAt(0).toUpperCase() + table.slice(1)}`,
                table,
                columns,
                columnsToKeep,
                docs,
                pageArray,
                firstAccess: Object.keys(req.query).length === 0 && req.query.constructor === Object,
                docsCount,
                isMobile: false
            })
        }
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

// POST /tables/view/:table/download (Descargar resultados de búsqueda) 
router.get('/tables/view/:table/download', auth, async (req, res) => {
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

        // ERROR HANDLER: Evitar descargar la tabla Users y Logs
        if (table === 'users' || table === 'logs' || table === 'tables')
            req.flash('errorMessage', 'Acción denegada.')
            return res.redirect('/tables')

        let docs
        var filters = {}
        var sort = {}
        var queryString = ''

        const columns = await getCollFields(connection, table)

        // GET sin query
        if (Object.keys(req.query).length === 0 && req.query.constructor === Object) {
            docs = await getDocs(connection, table, filters, { _id: 0 }, 0, 0, sort)
            // GET con Query
        } else {
            // ERROR HANDLER: Búsqueda de query inválida (Evitar limit menor o mayor a 100)
            if (req.query.limit < 10 ||
                req.query.limit > 100) {
                req.flash('errorMessage', 'Formato de filtros inválido. Intente cambiar los filtros de búsqueda e intente de nuevo.')
                return res.redirect(`/tables/view/${table}`)
            }
            // ERROR HANDLER: Búsqueda de ID inválida
            if (req.query.search_id) {
                if (req.query.search_id.match(/^[0-9a-fA-F]{24}$/)) {
                    filters['_id'] = mongo.ObjectId(req.query.search_id)
                } else {
                    req.flash('errorMessage', `El valor que ingresó como ID no es válido.`)
                    return res.redirect(`/tables/view/${table}`)
                }
            }

            for (let i = 0; i < columns.length; i++) {
                if (req.query[`sort_${columns[i]}`]) {
                    // ERROR HANDLER: Evitar sort_Columna diferente de 1 y -1
                    if (parseInt(req.query[`sort_${columns[i]}`]) !== 1 &&
                        parseInt(req.query[`sort_${columns[i]}`]) !== -1) {
                        req.flash('errorMessage', 'Formato de filtros inválido. Intente cambiar los filtros de búsqueda e intente de nuevo.')
                        return res.redirect(`/tables/view/${table}`)
                    }
                    sort[columns[i]] = req.query[`sort_${columns[i]}`]
                }
                if (req.query[`search_${columns[i]}`])
                    filters[columns[i]] = !isNaN(req.query[`search_${columns[i]}`]) ?
                        // TRUE: Se busca un número en formato String o Float
                        { $in: [req.query[`search_${columns[i]}`], parseFloat(req.query[`search_${columns[i]}`])] } :
                        // FALSE: Se busca un String
                        req.query[`search_${columns[i]}`]
            }

            if (req.query.search) {
                await createIndex(connection, table)
                filters = { $text: { $search: req.query.search } }
            }

            if (req.query.search_id) filters['_id'] = mongo.ObjectId(req.query.search_id)
            docs = await getDocs(connection, table, filters, { _id: 0 }, 0, 0, sort)
            queryString = '-[Filtrado]'
        }

        const buff = await exportExcel(table, docs)
        const fileName = `helixx-db-${table}${queryString}.xlsx`
        var fileContents = Buffer.from(buff, "base64")
        var savedFilePath = path.join(__dirname, '/../private/files/', fileName)

        fs.writeFile(savedFilePath, fileContents, (error) => {
            if (error) throw error
            res.download(savedFilePath, (error) => {
                if (error) throw error
                const log = new Log()
                log.saveLog(req.user._id, req.user.email, 'downloadObjects', `Se descargaron resultados de una búsqueda de documentos de la tabla "${table}"`, undefined)
                fs.unlink(savedFilePath, (error) => {
                    if (error) throw error
                })
            })
        })
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

// POST /tables/view/:table/editObj/:id (Editar objeto por id)
router.post('/tables/view/:table/editObj/:id', auth, async (req, res) => {
    try {
        const table = req.params.table
        const id = new mongo.ObjectId(req.params.id)
        const updates = Object.fromEntries(Object.entries(req.body).filter(([_, v]) => v != ''))

        const connection = await connect()
        const columns = await getCollFields(connection, table)

        // Crea un arreglo de cada llave de las actualizaciones, además de que elimina las llaves que,
        // al usar trim(), generan un string vacío
        let updatesKeys = []
        for (const key in updates) {
            if (updates[key].trim() === '') {
                delete updates[key]
            } else {
                updatesKeys.push(key)
            }
        }

        // ERROR HANDLER: Los datos introducidos no concuerdan con el modelo del objeto a editar
        if (!updatesKeys.every(key => columns.includes(key))) {
            req.flash('errorMessage', 'Los valores no concuerdan con el modelo del objeto a editar.')
            return res.redirect(`/tables/view/${table}`)
        }

        // ERROR HANDLER: No se puede editar el objeto si no hay datos a editar
        if (Object.keys(updates).length === 0) {
            req.flash('errorMessage', 'No se leyeron datos a editar. El mínimo de datos a editar es de 1.')
            return res.redirect(`/tables/view/${table}`)
        }

        // Remueve el "whitespace" de cada nombre y reemplaza los números escritos en String y los convierte a Float
        // Además, crea un string de las actualizaciones realizadas
        let updatesString = ''
        for (const key in updates) {
            updates[key] = !isNaN(updates[key]) ? parseFloat(updates[key].trim()) : updates[key].trim()
            updatesString += `[${key}: ${updates[key]}]`
        }

        const doc = await findDoc(connection, table, { _id: id }, { _id: 0 })

        if (doc) {
            // Genera un String de los valores originales de los campos editados
            let originalValues = ''
            for (const keyDoc in doc) {
                for (const keyUpdate in updates) {
                    if (keyDoc === keyUpdate) originalValues += `[${keyDoc}: ${doc[keyDoc]}]`
                }
            }

            await findDocAndUpdate(connection, table, { _id: id }, updates)
            const log = new Log()
            log.saveLog(req.user._id, req.user.email, 'updateObject', `Se actualizaron los valores del objeto "${doc[Object.keys(doc)[1]]}" en la tabla "${table}": Nuevos valores: ${updatesString}. Valores originales: ${originalValues}`, id)
            req.flash('successMessage', `Se actualizaron los valores del objeto "${doc[Object.keys(doc)[1]]}" exitosamente.`)
            return res.redirect(`/tables/view/${table}`)
        } else {
            req.flash('errorMessage', 'Identificación no reconocida.')
            return res.redirect(`/tables/view/${table}`)
        }
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

// POST /tables/view/:table/deleteObj/:id (Borrar objeto por id)
router.post('/tables/view/:table/deleteObj/:id', auth, async (req, res) => {
    try {
        const table = req.params.table
        const id = new mongo.ObjectId(req.params.id)

        // ERROR HANDLER: Formulario incompleto
        if (!req.body.confirmation_name) {
            req.flash('errorMessage', 'Favor de llenar el formulario.')
            return res.redirect(`/tables/view/${table}`)
        }

        const connection = await connect()
        const doc = await findDoc(connection, table, { _id: id }, { _id: 0 })

        if (doc) {
            if (req.body.confirmation_name === doc[Object.keys(doc)[1]]) {
                await findDocAndDelete(connection, table, { _id: id })
                const log = new Log()
                log.saveLog(req.user._id, req.user.email, 'deleteObject', `Se eliminó el objeto "${doc[Object.keys(doc)[1]]}" de la tabla "${table}"`, doc._id)
                req.flash('successMessage', `El objeto ${doc[Object.keys(doc)[1]]} ha sido eliminado.`)
                return res.redirect(`/tables/view/${table}`)
            } else {
                req.flash('errorMessage', 'El nombre que proporcionó no concuerda con el del primer campo del objeto que desea eliminar.')
                return res.redirect(`/tables/view/${table}`)
            }
        } else {
            req.flash('errorMessage', 'Identificación no reconocida.')
            return res.redirect(`/tables/view/${table}`)
        }
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

// POST /tables/view/:table/insertObj (Insertar objeto en tabla)
router.post('/tables/view/:table/insertObj', auth, async (req, res) => {
    try {
        const table = req.params.table
        const data = req.body

        const connection = await connect()
        const columns = await getCollFields(connection, table)
        let dataArray = []

        for (const key in data) {
            dataArray.push(key)
        }

        // ERROR HANDLER: Los datos introducidos no concuerdan con el modelo del objeto a insertar
        if (!arraysEqual(columns, dataArray)) {
            req.flash('errorMessage', 'Favor de llenar el formulario adecuadamente.')
            return res.redirect(`/tables/view/${table}`)
        }

        // Remueve el "whitespace" de cada nombre y reemplaza los números escritos en String y los convierte a Float
        for (const key in req.body) {
            data[key] = !isNaN(req.body[key]) ? parseFloat(req.body[key].trim()) : req.body[key].trim()
        }

        await insertDoc(connection, table, data)
        const doc = await findDoc(connection, table, data)
        const log = new Log()
        log.saveLog(req.user._id, req.user.email, 'createObject', `Se creó el objeto "${data[Object.keys(data)[0]]}" en la tabla "${table}"`, doc._id)
        req.flash('successMessage', `Se creó el objeto "${data[Object.keys(data)[0]]}" exitosamente.`)
        return res.redirect(`/tables/view/${table}`)
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

//POST /tables/view/:table/insertColumn (Insertar columna)
router.post('/tables/view/:table/insertColumn', auth, async (req, res) => {
    try {
        const table = req.params.table

        // ERROR HANDLER: Formulario incompleto
        if (!req.body.field || !req.body.value) {
            req.flash('errorMessage', 'Favor de llenar el formulario.')
            return res.redirect(`/tables/view/${table}`)
        }

        const column = req.body.field.trim()
        const value = req.body.value.trim()
        var data = {}
        data[column] = value
        const dataString = `[${column}: ${value}]`

        // ERROR HANDLER: Nombre de columna inválido
        if (!column.match(/^[a-zñáéíóúüA-ZÑÁÉÍÓÚÜ0-9_.-]*$/) ||
            column.match('_id') ||
            column.startsWith('.') ||
            column.endsWith('.') ||
            column.length === 0 ||
            column.length > 40) {
            req.flash('errorMessage', 'Favor de coincidir el formato solicitado de nombre de la columna. El nombre de la columna no debe ser "_id", empezar con un punto, terminar con un punto, ni contener caracteres especiales.')
            return res.redirect(`/tables/view/${table}`)
        }

        const connection = await connect()
        const columns = await getCollFields(connection, table)

        // ERROR HANDLER: No se puede agregar una columna con un nombre ya existente
        if (columns.includes(column)) {
            req.flash('errorMessage', 'El nombre de la nueva columna que proporcionó ya existe. Cambie los valores e inténtelo de nuevo.')
            return res.redirect(`/tables/view/${table}`)
        }

        await insertColumn(connection, table, data)
        const log = new Log()
        log.saveLog(req.user._id, req.user.email, 'createColumn', `Se insertó la columna "${column}" en la tabla "${table}" con los valores: "${dataString}"`, table)
        req.flash('successMessage', `Se insertó la nueva columna "${column}" exitosamente.`)
        res.redirect(`/tables/view/${table}`)

    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

// POST /tables/view/:table/deleteColumn (Eliminar columna)
router.post('/tables/view/:table/deleteColumn', auth, async (req, res) => {
    try {
        const table = req.params.table

        // ERROR HANDLER: Formulario incompleto
        if (!req.body.column || !req.body.column_confirmation) {
            req.flash('errorMessage', 'Favor de llenar el formulario.')
            return res.redirect(`/tables/view/${table}`)
        }

        const column = req.body.column
        const column_confirmation = req.body.column_confirmation
        var data = {}
        data[`${column}`] = 1

        if (column !== column_confirmation) {
            req.flash('errorMessage', 'Los nombres de las columnas a borrar no coinciden. Inténtelo de nuevo.')
            return res.redirect(`/tables/view/${table}`)
        }

        const connection = await connect()
        const columns = await getCollFields(connection, table)

        // ERROR HANDLER: No se pueden borrar columnas si la tabla tiene 2 columnas o menos
        if (columns.length <= 2) {
            req.flash('errorMessage', 'No se pueden borrar más columnas. El mínimo de columnas es 2.')
            return res.redirect(`/tables/view/${table}`)
        }

        await deleteColumn(connection, table, data)
        const log = new Log()
        log.saveLog(req.user._id, req.user.email, 'deleteColumn', `Se eliminó la columna "${column}" de la tabla "${table}"`, table)
        req.flash('successMessage', `Se eliminó la columna "${column}" exitosamente.`)
        res.redirect(`/tables/view/${table}`)
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }

})

module.exports = router