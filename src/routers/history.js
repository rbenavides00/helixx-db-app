/*
* history.js
* 
* Archivo que almacena las rutas de Historial
*/

// Importación de módulos NPM o librerías nativas
const fs = require('fs')
const path = require('path')
const express = require('express')
const validator = require('validator')
// Importación de modelos
const Log = require('../models/logModel')
// Importación de funciones/definición de objetos
const router = express.Router()
const auth = require('../utils/isAuthenticated')
const { pagination } = require('../utils/pagination')
const { exportExcel } = require('../utils/excelConverter')

// Función para obtener los registros según el query y si se va a descargar
async function getLogs(query, download) {
    let page, sortOrder, limit, skip, logs, logsCount, pageArray
    const filters = {}
    const dateValidation = {
        format: 'YYYY-MM-DD',
        strictMode: true,
        delimiters: ['-']
    }
    var errorMessage = ''
    var queryString = ''
    page = query.page ? parseInt(query.page) : 1
    sortOrder = query.sortOrder ? parseInt(query.sortOrder) : -1

    // GET sin query
    if (Object.keys(query).length === 0 && query.constructor === Object) {
        if (!download) {
            limit = 10
            skip = (limit - (limit * 2)) + (page * limit)
            logs = await Log.find(filters, '-_id -user -updatedAt -__v').lean().limit(limit).skip(skip).sort({ createdAt: sortOrder })
        } else {
            logs = await Log.find(filters, '-_id -user -updatedAt -__v').lean().sort({ createdAt: sortOrder })
        }
        logsCount = await Log.countDocuments()
        // GET con Query
    } else {
        // ERROR HANDLER: Búsqueda de query inválida (Evitar limit menor o mayor a 100 y sortOrder diferente a 1 y -1)
        if (query.limit < 10 ||
            query.limit > 100 ||
            (sortOrder !== 1 && sortOrder !== -1)) {
            errorMessage = 'Formato de filtros inválido. Intente cambiar los filtros de búsqueda e intente de nuevo.'
        }

        limit = !query.limit ? 10 : query.limit
        if (query.user) filters.email = query.user.trim().toLowerCase()
        if (query.actionType) filters.actionType = query.actionType
        if (query.affectedObj) filters.affectedObj = query.affectedObj

        if (query.startDate && query.endDate) {
            // ERROR HANDLER: Búsqueda de query inválida (Evitar que cualquiera de las dos fechas sea inválida)
            if (!validator.isDate(query.startDate, dateValidation) ||
                !validator.isDate(query.endDate, dateValidation) ||
                (query.startDate.length > 10 || query.endDate.length > 10)) {
                errorMessage = 'Formato de filtros inválido. Intente cambiar los filtros de búsqueda e intente de nuevo.'
            }
            filters.createdAt = { $gte: query.startDate, $lte: query.endDate }
        } else {
            if (query.startDate) {
                // ERROR HANDLER: Búsqueda de query inválida (Evitar que startDate sea inválido)
                if (!validator.isDate(query.startDate, dateValidation) ||
                    query.startDate.length > 10) {
                    errorMessage = 'Formato de filtros inválido. Intente cambiar los filtros de búsqueda e intente de nuevo.'
                }
                filters.createdAt = { $gte: query.startDate }
            }
            if (query.endDate) {
                // ERROR HANDLER: Búsqueda de query inválida (Evitar que endDate sea inválido)
                if (!validator.isDate(query.endDate, dateValidation) ||
                    query.endDate.length > 10) {
                    errorMessage = 'Formato de filtros inválido. Intente cambiar los filtros de búsqueda e intente de nuevo.'
                }
                filters.createdAt = { $lte: query.endDate }
            }
        }
        if (errorMessage === '') {
            if (!download) {
                skip = (limit - (limit * 2)) + (page * limit)
                logs = await Log.find(filters, '-_id -user -updatedAt -__v').lean().limit(limit).skip(skip).sort({ createdAt: sortOrder })
            } else {
                logs = await Log.find(filters, '-_id -user -updatedAt -__v').lean().sort({ createdAt: sortOrder })
            }
            logsCount = await Log.countDocuments(filters)
        } else {
            logs = {}
            logsCount = 0
        }
        queryString = '-[Filtrado]'
    }
    pageArray = pagination(page, Math.ceil(logsCount / limit))
    if (page > parseInt(pageArray[pageArray.length - 1]))
        errorMessage = 'Formato de filtros inválido. Intente cambiar los filtros de búsqueda e intente de nuevo.'
    return { logs, logsCount, pageArray, errorMessage, queryString }
}

// GET /history
router.get('/history', auth, async (req, res) => {
    try {
        res.locals.query = new URLSearchParams(req.query)

        // ERROR HANDLER: Evitar mal formato de page y limit
        if ((req.query.page && isNaN(req.query.page)) ||
            (req.query.limit && isNaN(req.query.limit)) ||
            req.query.page <= 0) {
            req.flash('errorMessage', 'Formato de filtros inválido. Intente cambiar los filtros de búsqueda e intente de nuevo.')
            return res.redirect('/history')
        }

        const { logs, logsCount, pageArray, errorMessage } = await getLogs(req.query, false)

        if (errorMessage !== '') {
            req.flash('errorMessage', errorMessage)
            return res.redirect('/history')
        }

        const actionTypes = await Log.find().distinct('actionType')

        if (req.useragent.isMobile) {
            res.render('historyMobile', {
                title: 'Historial',
                actionTypes,
                logs,
                logsCount,
                pageArray,
                noMatch: logsCount === 0,
                isMobile: true
            })
        } else {
            res.render('history', {
                title: 'Historial',
                actionTypes,
                logs,
                logsCount,
                pageArray,
                noMatch: logsCount === 0,
                isMobile: false
            })
        }
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

// GET /history/download
router.get('/history/download', auth, async (req, res) => {
    try {
        res.locals.query = new URLSearchParams(req.query)

        const { logs, errorMessage, queryString } = await getLogs(req.query, true)

        if (errorMessage !== '') {
            req.flash('errorMessage', errorMessage)
            return res.redirect('/history')
        }

        const buff = await exportExcel('Historial', logs)
        const fileName = `helixx-db-logs${queryString}.xlsx`
        var fileContents = Buffer.from(buff, "base64")
        var savedFilePath = path.join(__dirname, '/../private/files/', fileName)

        fs.writeFile(savedFilePath, fileContents, (error) => {
            if (error) throw error
            res.download(savedFilePath, (error) => {
                if (error) throw error
                const log = new Log()
                log.saveLog(req.user._id, req.user.email, 'downloadLogs', `Se descargaron resultados de una búsqueda de Historial`, undefined)
                fs.unlink(savedFilePath, (error) => {
                    if (error) throw error
                })
            })
        })
    } catch (error) {
        res.status(500).render('error', { title: 'Error', error })
    }
})

// router.get('/test', async (req, res) => {
//     const today = new Date()
//     const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
//     // const oldestLog = await Log.findOne({ sort: { createdAt: -1 } })
//     const pipeline = [
//         {
//             $match: { createdAt: { $gte: firstDay } }
//         },
//         {
//             $sort: { createdAt: -1 }
//         },
//         {
//             $group: {
//                 _id: {
//                     $dateToString: { format: "%m/%d/%Y", date: "$createdAt" }
//                 },
//                 logs: { $push: '$$ROOT' }
//             }
//         }
//     ]
//     const logsArray = await Log.aggregate(pipeline)
//     const sortedArray = logsArray.sort((a, b) => {
//         return new Date(a._id) - new Date(b._id)
//     })
//     const logsCountArray = []

//     sortedArray.forEach((date) => {
//         logsCountArray.push({ date: date._id, logCount: date.logs.length })
//     })

//     res.send(sortedArray)
//     console.log(logsCountArray)
// })

module.exports = router