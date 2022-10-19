/*
* excelConverter.js
* 
* Archivo responsable de exportar la información de la base de datos MongoDB a Excel.
*/

// Importación de módulos NPM o librerías nativas
const XLSX = require('xlsx')

// Función para exportar un Excel
const exportExcel = async (coll, docs) => {
    const workSheet = XLSX.utils.json_to_sheet(docs)
    const workBook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workBook, workSheet, coll)
    return XLSX.write(workBook, { bookType: 'xlsx', type: "buffer" })
}

module.exports = {
    exportExcel
}