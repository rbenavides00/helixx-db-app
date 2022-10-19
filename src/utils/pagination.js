/*
* pagination.js
* 
* Archivo con función para generar un arreglo con la paginación según la página actual y
* el total de páginas generadas por la búsqueda de datos.
*/

const pagination = (c, m) => {
    var current = c,
        last = m,
        delta = 2,
        left = current - delta,
        right = current + delta + 1,
        range = [],
        paginationArray = [],
        l

    for (let i = 1; i <= last; i++) {
        if (i == 1 || i == last || i >= left && i < right) range.push(i)
    }

    for (let i of range) {
        if (l) {
            if (i - l === 2) {
                paginationArray.push(l + 1)
            } else if (i - l !== 1) {
                paginationArray.push('...')
            }
        }
        paginationArray.push(i)
        l = i
    }
    return paginationArray
}

module.exports = {
    pagination
}