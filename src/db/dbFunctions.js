/*
* dbFunctions.js
* 
* Archivo de funciones relacionadas a base de datos usando MongoClient
*/

const db = process.env.MONGODB_DB

module.exports = {
    getColls: async function (conn) {
        return await conn.db(db).listCollections().toArray()
    },
    getCollFields: async function (conn, coll) {
        var fields = Object.keys(await conn.db(db).collection(coll).findOne({}))
        fields = fields.filter((field) => field !== '_id')
        return fields
    },
    dropColl: async function (conn, coll) {
        return await conn.db(db).collection(coll).drop()
    },
    createColl: async function (conn, coll) {
        return await conn.db(db).createCollection(coll)
    },
    findDoc: async function (conn, coll, filters, projection) {
        return await conn.db(db).collection(coll).findOne(filters, projection)
    },
    findDocAndUpdate: async function (conn, coll, filters, updates) {
        return await conn.db(db).collection(coll).findOneAndUpdate(filters, { $set: updates })
    },
    findDocAndDelete: async function (conn, coll, filters) {
        return await conn.db(db).collection(coll).findOneAndDelete(filters)
    },
    getDocs: async function (conn, coll, filters, projection, limit, skip, sort) {
        return await conn.db(db).collection(coll).find(filters).project(projection).limit(limit).skip(skip).sort(sort).toArray()
    },
    getDocsCount: async function (conn, coll, filters) {
        return await conn.db(db).collection(coll).countDocuments(filters)
    },
    insertDoc: async function (conn, coll, data) {
        return await conn.db(db).collection(coll).insertOne(data)
    },
    insertDocs: async function (conn, coll, data) {
        return await conn.db(db).collection(coll).insertMany(data)
    },
    createIndex: async function (conn, coll) {
        return await conn.db(db).collection(coll).createIndex({ "$**": "text" }, { name: "TextIndex" })
    },
    insertColumn: async function (conn, coll, data) {
        return await conn.db(db).collection(coll).updateMany({}, { $set: data })
    },
    deleteColumn: async function (conn, coll, data) {
        return await conn.db(db).collection(coll).updateMany({}, { $unset: data })
    },
    getDbStats: async function (conn) {
        return await conn.db(db).stats()
    }
}