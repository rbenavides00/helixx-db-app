/*
* index.js
* 
* Archivo que inicia la aplicación
*/
// Importación de funciones/definición de objetos
const app = require('./app')

const port = process.env.PORT || 3000

app.listen(port, () => {
    console.log(`Servidor iniciado en el puerto ${port}`)
})