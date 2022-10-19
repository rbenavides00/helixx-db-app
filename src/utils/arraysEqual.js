/*
* arraysEqual.js
* 
* Archivo con función para comparar dos arreglos y verificar si son idénticos o no
*/

const arraysEqual = (a, b) => {
    if (a === b) return true
    if (a == null || b == null) return false
    if (a.length !== b.length) return false

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false
    }
    return true
}

module.exports = {
    arraysEqual
}