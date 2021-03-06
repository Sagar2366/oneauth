/**
 * Created by championswimmer on 08/03/17.
 */
require('newrelic')
const express = require('express')
    , bodyParser = require('body-parser')
    , session = require('express-session')
    , passport = require('./passport/passporthandler')
    , path = require('path')
    , exphbs = require('express-hbs')
    , expressGa = require('express-ga-middleware')
    , flash = require('express-flash')
    , Raven = require('raven')
    , debug = require('debug')('oneauth:server')

const config = require('../config')
    , secrets = config.SECRETS
    , {sessionStore, saveIp} = require('./middlewares/sessionstore')
    , {redirectToEditProfile} = require('./middlewares/profilevalidation')
    , loginrouter = require('./routers/login')
    , connectrouter = require('./routers/connect')
    , disconnectrouter = require('./routers/disconnect')
    , logoutrouter = require('./routers/logoutrouter')
    , signuprouter = require('./routers/signup')
    , verifyemailrouter = require('./routers/verifyemail')
    , apirouter = require('./routers/api')
    , oauthrouter = require('./routers/oauthrouter')
    , pagerouter = require('./routers/pages')
    , statusrouter = require('./routers/statusrouter')
    , {expresstracer, datadogRouter} = require('./utils/ddtracer')
    , {expressLogger} = require('./utils/logger')
    ,  { profilePhotoMiddleware } = require('./middlewares/profilephoto');
require('./utils/handlebars')

const app = express()

app.set('trust proxy', 'loopback, linklocal, uniquelocal')

// ============== START DATADOG
app.use(expresstracer)
// ================= END DATADOG
const redirectToHome = function (req, res, next) {

    if (req.path == '/') {
        return res.redirect('/users/me')
    }

    next()

}
const setuserContext = function (req, res, next) {
    if (req.authInfo) {
        if (req.authInfo.clientOnly) {
            return next()
        }
    }
    if (req.user) {
        if (req.authInfo)
        Raven.setContext({
            user: {
                username: req.user.dataValues.username,
                id: req.user.dataValues.id
            }

        })

    }
    next()
}
// ====================== START SENTRY
Raven.config(secrets.SENTRY_DSN).install()
app.use(Raven.requestHandler())
// ====================== END SENTRY

// ====================== Handlebars Config
app.engine('hbs', exphbs.express4({
    partialsDir: path.join(__dirname, '../views/partials'),
    layoutsDir: path.join(__dirname, '../views/layouts'),
    defaultLayout: 'views/layouts/main.hbs',
}))
app.set('views', path.join(__dirname, '../views'))
app.set("view engine", "hbs")
app.set('view cache', true)
// ====================== Handlebars Config


app.use('/status', statusrouter)
app.use(expressLogger)
app.use(express.static(path.join(__dirname, '../public_static')))
app.use(express.static(path.join(__dirname, '../submodules/motley/examples/public')))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
app.use(session({
    store: sessionStore,
    secret: secrets.EXPRESS_SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    name: 'oneauth',
    cookie: {
        domain: config.COOKIE_DOMAIN,
        maxAge: 86400000
    }
}))
app.use(saveIp)
app.use(flash())
app.use(passport.initialize())
app.use(passport.session())
app.use(setuserContext)
app.use(redirectToHome)
app.use(expressGa('UA-83327907-12'))
app.use(datadogRouter)
app.use('/api', apirouter)
app.use(profilePhotoMiddleware)
app.use('/oauth', oauthrouter)
app.use('/verifyemail', verifyemailrouter)
// app.use(csurf({cookie: false}))
app.use((req, res, next) => {
    res.locals.csrfToken = ""; // req.csrfToken() // Inject csrf to hbs views
    next()
})
app.use('/logout', logoutrouter)
app.use('/signup', signuprouter)
app.use('/login', loginrouter)
app.use(redirectToEditProfile);
app.use('/disconnect', disconnectrouter)
app.use('/connect', connectrouter)
app.use('/', pagerouter)
app.get('*', (req, res) => res.render('404'));

app.use(Raven.errorHandler())
app.use((err, req, res, next) => { res.status(500).render('exception', { message: err.message }) })

if(process.env.ONEAUTH_DEV === 'localhost'){
    Raven.captureException = (E) => console.error (E)
}

app.listen(process.env.PORT || 3838, function () {
    debug("Listening on " + config.SERVER_URL)
})
