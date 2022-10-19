/*
* isAuthenticated.js
* 
* Archivo con middleware para autentificar un usuario. A diferencia de local-auth.js, esta función se
* encarga de redireccionar al usuario en caso de no ser autentificado.
*/

const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next()
    }
    req.flash('errorMessage', 'Tu acceso no ha sido autentificado. Favor de iniciar sesión e intentarlo de nuevo.')
    res.status(401).send('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/login"></head></html>')
}

module.exports = isAuthenticated