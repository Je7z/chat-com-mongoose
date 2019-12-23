
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const bodyparser = require('body-parser')
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy
const handlebars = require('express-handlebars');
const mongoose = require('mongoose');
const session = require('express-session')({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
})
const sharedsession = require('express-socket.io-session');
const flash = require('connect-flash');
//bodyParser
app.use(bodyparser.urlencoded({ extended: true }));
app.use(bodyparser.json());

//Handlebars
app.engine('handlebars', handlebars({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');

app.use(flash());








//Mongoose
mongoose.connect('mongodb://localhost/session')
const Schema = mongoose.Schema;

const UsuarioSchema = new Schema({

  nickname: {
    type: String,
    required: true,
  },
  senha: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  }

})

mongoose.model('usuarios', UsuarioSchema);
const Usuario = mongoose.model('usuarios');



// Attach session
app.use(session);

app.use(passport.initialize());
app.use(passport.session());

// passport/login.js



// Usuario.findOne({nickname: "Valkyrie"},(err, user) => {
//     console.log(user);
// } )




passport.serializeUser((user, done) => {
  done(null, user.id);
});



// app.get('', (req, res) => {
//     res.render('login');
// });

app.use((req, res, next) => {
  res.locals.msgFlash = req.flash();
  next();
})

// passport/login.js
passport.use(new LocalStrategy(
  { usernameField: "username", passwordField: "password" },
  function (username, password, done) {

    Usuario.findOne({ nickname: username }, function (err, user) {

      if (err) { return done(err); }
      if (!user) {

        return done(null, false);

      }
      if (!(password === user.senha)) { return done(null, false); }
      return done(null, user);
    });
  }
));

let showdown = false;

app.use((req,res,next) => {
  req.session.showdown = req.isAuthenticated();
  next();
})


app.use('/login', (req, res, next) => {
  if (req.body.username) {
    Usuario.findOne({ nickname: req.body.username }, function (err, user) {
      if (!user) { req.flash('bad-login', 'Usuario Não Existe') }
      if (user) {

        if (!(req.body.password === user.senha)) {
          req.flash('bad-password', 'Senha Invalida')
        }
      }

    })
  }
  next();
})

app.get('/chat', authenticationMiddleware(), (req, res) => {
  res.render('chat', { usuario: req.user.nickname })
})


function authenticationMiddleware() {
  return function (req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
    res.redirect('/login?fail=true')
  }
}

app.get('/welcome', (req, res) => {
  res.render('welcome', { usuario: req.user.nickname });
  //console.log(req.session.dalar)
  req.session.user = req.user.nickname;
})

app.post('/cadastrar', (req, res) => {



  checkIfExistsUser(req.body.email, (check) => {
    if (!check) {

      new Usuario({
        nickname: req.body.username,
        senha: req.body.password,
        email: req.body.email
      }).save().then(() => {
        req.flash('success_register', 'Usuario registrado com sucesso.');
        res.redirect('cadastro')
      });
    } else {
      req.flash('bad_register', 'Usuario já registrado.')
      res.redirect('cadastro')
    }
  });

})

function checkIfExistsUser(email, fun) {
  Usuario.findOne({ email: email }, (err, user) => {
    if (err) return handleError(err);
    if (user) {
      fun(email === user.email);
    } else {
      fun(false);
    }
  })
}

let show;

app.get('/cadastro', (req, res) => {
  res.render('cadastro');
})

app.get('/login', (req, res) => {
  res.render('login');

})

app.post('/login',
  passport.authenticate('local', { failureRedirect: '/login' }),
  function (req, res) {
    //req.session.showdown = req.isAuthenticated()

    res.redirect('/welcome');

  });

passport.deserializeUser((id, done) => {
  // console.log(`id: ${id}`);
  Usuario.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      console.log(`Error: ${error}`);
    });
});
// app.get('/', (req, res) => {
//     res.render('view');
// })





//Share session with io sockets
app.get('/', function (req, res) {
  res.render('login');
});

app.get('/logout', function (req, res) {
  req.logout();
  res.redirect('/login');
  
});

io.use(sharedsession(session));


io.on("connection", function (socket) {

  socket.emit('bemvindo', { msg: "Entrou na sala", usuario: socket.handshake.session.user });
  socket.broadcast.emit('bemvindo', { msg: "Entrou na sala", usuario: socket.handshake.session.user });

  socket.on('chat message', (mensagem) => {
    socket.broadcast.emit('chat message', { msg: mensagem, usuario: socket.handshake.session.user });
    socket.emit('chat message', { msg: mensagem, usuario: socket.handshake.session.user });
    console.log({ msg: mensagem, usuario: socket.handshake.session.user });
    console.log(socket.handshake.session.showdown);

  })


});

server.listen(8080);