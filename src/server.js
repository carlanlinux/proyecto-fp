import express from 'express';
import bodyParser from 'body-parser';
import {MongoClient} from 'mongodb';
import * as path from "path";
import crypto from "crypto";

//Levantar servidor le decimos que ejecute de nuevo el comando cuando detecte algún cambio:
// npx nodemon --exec npx babel-node src/server.js
// node start
//Ejecutar mongo poner: mongod


const app = express();
const cors = require('cors');

//--> Indicar la ruta de despliegue de la aplicación
app.use(express.static(path.join(__dirname, 'build')));
app.use(bodyParser.json());
app.use(cors());

//Creamos una función que gestiona la conexión con la base de datos y le pasamos como parámetro las operaciones a realizar
const withDB = async (operations, res) => {
    try {
        //Conectamos con la base de datos, hay que pasar siempre las opciones de newURLparser true
        const client = await MongoClient.connect('mongodb://localhost:27017', {
            poolSize: 10,
            bufferMaxEntries: 0,
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        //Creamos un objeto base de datos con el nombre de la base de datos que necesitamos
        const db = client.db('cms-blog');

        //Ejecutamos las operaciones que nos pasan por parámetros pasando la base de datos.
        await operations(db);

        //Cerramos la conexión con la base de datos.
        await client.close();
    } catch (e) {
        //Mandamos el mensaje de error
        await res.status(500).json({message: "Error al conectar con la base de datos", e:e.toString()});
    }
}


/* TESTEO de endpoints
app.get("/hello", (req, res) => res.send("Hello!"));
app.get("/hello/:name", (req, res) => res.send(`Hello ${req.params.name}`))
app.post("/hello", (req, res) => res.send(`Hello ${req.body.name}`));
*/

//API endpoint para votar artículos, incluímos la palabra async
app.post('/api/articulos/:name/votar', async (req, res) => {
    const articleName = req.params.name;
    withDB( async (db) => {
        //Sacamos los datos de la info del artículo que se pasa en la URL buscandolo en la colección pasándole el nombre
        // del artículo en objeto tal como está en la bd
        const articleInfo = await db.collection('articulos').findOne({nombre: articleName});
        //Hacemo sun update e la base de datos para sumarle 1 a los votos qeu tiene ese artículo
        await db.collection('articulos').updateOne({nombre: articleName}, {
            '$set': {
                votos: articleInfo.votos + 1
            },
        });
        //Sacamos la información actuializada de la base de datos para mandarla en la respuesta
        const updatedArticleInfo = await db.collection('articulos').findOne({nombre: articleName});
        //Enviamos la respuesta en formato JSON con los datos actualizados.
        await res.status(200).json(updatedArticleInfo);
    }, res)
});

//Rescatamos todos los artículos que tenemos en la colección
app.get('/api/obtenerArticulos', async (req, res) => {

    //Llamamos a la función de la base de datos y tenemos como parámetro la propia base de datos y la operación que
    // queremos realizar
    await withDB(async (db) => {
        const arrayAux = [];
        //Buscamos en al base de datos el artículo que tenga ese nombre
        let cursor = await db.collection('articulos').find();
        while (await cursor.hasNext()) {
            const articulo = await cursor.next();
            arrayAux.push(articulo);
        }

        //Le asignas el número del estado al constuir la respuesta.
        await res.status(200).json(arrayAux);
    }, res);

//Devolver los 5 artículos más recientes creados
    app.get('/api/obtenerArticulosReducido', async (req, res) => {

        //Llamamos a la función de la base de datos y tenemos como parámetro la propia base de datos y la operación que
        // queremos realizar
        await withDB(async (db) => {
            const arrayAux = [];
            //Buscamos en al base de datos el artículo que tenga ese nombre
            let cursor = await db.collection('articulos').find().limit(4).sort({fechaCreacion: -1});
            while (await cursor.hasNext()) {
                const articulo = await cursor.next();
                arrayAux.push(articulo);
            }

            //Le asignas el número del estado al constuir la respuesta.
            await res.status(200).json(arrayAux);
        }, res);


    });


});


//API ENDPOINT OBTENER TODOS LOS USUARIOS
app.get('/api/obtenenerTodosUsuarios', async (req, res) => {

    //Llamamos a la función de la base de datos y tenemos como parámetro la propia base de datos y la operación que
    // queremos realizar
    await withDB(async (db) => {
        const arrayAux = [];
        //Buscamos en al base de datos los uaurios que tengan ese nombre
        let cursor = await db.collection('users').find();
        while (await cursor.hasNext()) {
            const usuario = await cursor.next();
            arrayAux.push(usuario);
        }

        //Le asignas el número del estado al constuir la respuesta.
        await res.status(200).json(arrayAux);
    }, res);

});


//API ENDPOINT Obtener artículo
app.get('/api/articulo/:nombre', async (req, res) => {

    //Llamamos a la función de la base de datos y tenemos como parámetro la propia base de datos y la operación que
    // queremos realizar
    withDB(async (db) => {
        const nombreArticulo = req.params.nombre;
        //Buscamos en al base de datos el artículo que tenga ese nombre
        const infoArticulo = await db.collection('articulos').findOne({nombre: nombreArticulo});
        //Le asignas el número del estado al constuir la respuesta.
        await res.status(200).json(infoArticulo);
    }, res);

});

//API ENDPOINT COMENTAR ARTICULOS
app.post('/api/articulos/:name/comentar', async (req, res) => {
    //Recogemos el valor del cuerpo de la request y lo asginamos el primero a la constante username y el segundo a text
    const {usuario, comentario} = req.body;
    //Recogemos el nombre del artículo de la request, los parámetros y el nombre (:name)
    const articleName = req.params.name;

    withDB( async (db) => {
        //Vamos al array que tiene la info de los artículos, entramos en el índe que sea el nombre del artículo, nos vamos a los
        // comentarios y le hacemos un push al array un nuevo objeto que contenga nombre de usuario y el texto
        const articleInfo = await db.collection('articulos').findOne({nombre: articleName});
        await db.collection('articulos').updateOne({nombre : articleName}, {
            '$set': {
                comentarios: articleInfo.comentarios.concat({usuario, comentario}),
            },
        });
        const updatedArticleInfo = await db.collection('articulos').findOne({nombre: articleName});
        //enviamos la respuesta si ha ido bien (status 200) con los comentarios del artículo en cuestión
        await res.status(200).json(updatedArticleInfo);
    }, res);

});


app.post('/api/articulos/nuevoArticulo', async (req, res) => {
    //Recogemos el valor del cuerpo de la request y lo asginamos el primero a la constante username y el segundo a text
    const {nombre, texto, titulo, fechaCreacion, autor} = req.body;
    //Recogemos el nombre del artículo de la request, los parámetros y el nombre (:name)
    console.log(req.body);

    withDB(async (db) => {
        //Vamos al array que tiene la info de los artículos, entramos en el índe que sea el nombre del artículo, nos vamos a los
        // comentarios y le hacemos un push al array un nuevo objeto que contenga nombre de usuario y el texto
        await db.collection('articulos').insertOne({
            nombre: nombre,
            titulo: titulo,
            texto: texto,
            autor: autor,
            fechaCreacion: fechaCreacion,
            votos: 0,
            comentarios: []
        },);
        const updatedArticleInfo = await db.collection('articulos').findOne({nombre: nombre});
        //enviamos la respuesta si ha ido bien (status 200) con los comentarios del artículo en cuestión
        await res.status(200).json(updatedArticleInfo);
    }, res);

});


//API ENDPOINT BORRAR POST
app.post('/api/borrarPost', async (req, res) => {

    //Recogemos el valor del cuerpo de la request y lo asginamos el primero a la constante username y el segundo a text
    const {nombreArticulo} = req.body;
    //Recogemos el nombre del artículo de la request, los parámetros y el nombre (:name)

    withDB(async (db) => {
        //Buscarmos el usuario para ver si existe
        const articulo = await db.collection('articulos').deleteOne(nombreArticulo);
        if (!articulo) {
            return res.status(400).json({
                type: "Error",
                msg: "Artículo no encontrado"
            })
        } else {
            return res.status(200).json({
                type: "Exito",
                msg: "Artículo borrado correctamente"
            })
        }
    }, res)
});


/*app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});*/


//ENDPOINT PARA BORRAR post

/* Testeo de API
app.get('/api/hola', (req, res) => res.send('Hola, la API funciona!'));

app.post('/api/hola/:nombre', (req, res) => res.send(`Hola, ${req.params.nombre}, la API funciona!`));
*/

/***** GESTION DE USUARIOS LOGIN Y GENERACION DE HASH *****/

//Generar salt aleatoria, cogerá un número como parámetro que definirá el tamaño de la salt. Se le añade un validador par
// que tenga que ser mayor que 15 para mejorar seguridad
const generarSalt = rondas => {
    if (rondas >= 15) {
        throw new Error(`${rondas} is greater than 15,Must be less that 15`);
    }
    if (typeof rondas !== 'number') {
        throw new Error('rounds param must be a number');
    }
    if (rondas == null) {
        rondas = 12;
    }
    return crypto.randomBytes(Math.ceil(rondas / 2)).toString('hex').slice(0, rondas);
};


/*
Hacemos un algorimo de hasheo que se encargue tanto del hasing como de la lógica para la salt. Para ello usamos:

**crypto.createHmac(algorithm, key[, options])**, Crea y devuelve un objeto Hmac que lo usa al algortimo y la clave.
Se usará también el  sha512 algorithm. El segurndo parametro será la clave, y será donde pasemos la salt

*/

const hashear = (password, salt) => {
    let hash = crypto.createHmac('sha512', salt);
    hash.update(password);
    let value = hash.digest('hex');
    return {
        salt: salt,
        hashedpassword: value
    };
};

/*
Creamos la función hash, que llamará a la función hasheadora. Aquí ser haran las validaciones para segurarnos que la sal
es un string y que la contraseña es texto plano. Ambas se pasan en el parámetro
*/

const hash = (password, salt) => {
    if (password == null || salt == null) {
        throw new Error('Must Provide Password and salt values');
    }
    if (typeof password !== 'string' || typeof salt !== 'string') {
        throw new Error('password must be a string and salt must either be a salt string or a number of rounds');
    }
    return hashear(password, salt);
};

/*
Función para comprar las contraseñas. Usa el algorimo de hashear y luego comprueba si machea con el hash guardado en base de datos.
El input es la contraseña como parámetro y el hash.
 This will actually use the same algorithm to hash the password entered and then test whether
Se hacen algunas validaciones para asegurarnos que tenemos todo

*/
const comparar = (password, hash) => {

    if (password == null || hash == null) {
        throw new Error('password and hash is required to compare');
    }
    if (typeof password !== 'string' || typeof hash !== 'object') {
        throw new Error('password must be a String and hash must be an Object');
    }
    let passwordData = hashear(password, hash.salt);
    if (passwordData.hashedpassword === hash.hashedpassword) {
        return true;
    }
    return false
};



//API Endpoint para registrar nuevo usuario
app.post('/api/nuevoUsuario', async (req, res) => {
    let salt = generarSalt(10);

    withDB(async (db) => {
        const user = {
                nombreUsuario: req.body.nombre,
                email: req.body.email,
                password: await hash(req.body.password, salt),
            }
        ;
        //Buscamos en al base de datos el artículo que tenga ese nombre
        const respuesta = await db.collection('users').save(user);
        //Le asignas el número del estado al constuir la respuesta.
        await res.status(200).json({
            status: "Success",
            data: respuesta
        });
    }, res);

});


//ENDPOINT PARA LOGIN de usuario
app.post('/api/login', async (req, res) => {

    //Recogemos el valor del cuerpo de la request y lo asginamos el primero a la constante username y el segundo a text
    const {email, password} = req.body;
    //Recogemos el nombre del artículo de la request, los parámetros y el nombre (:name)

    withDB(async (db) => {
        //Buscarmos el usuario para ver si existe
        const usuario = await db.collection('users').findOne({"email": email});

        if (!usuario) {
            return res.status(400).json({
                type: "Usuario no encontrado",
                msg: "Login incorrecto"
            })
        }

        let comprobarPass = await comparar(password, usuario.password);
        if (comprobarPass) {
            res.status(200).json(usuario.nombreUsuario);
        } else {
            return res.status(401).json({
                type: "Contraseña incorrecta",
                msg: "Login incorrecto"
            })
        }

    }, res);

});

//ENDPOINT PARA BORRAR de usuario
app.post('/api/borrarUsuario', async (req, res) => {

    //Recogemos el valor del cuerpo de la request y lo asginamos el primero a la constante username y el segundo a text
    console.log(req.body);
    const {email} = req.body;
    console.log(email)
    //Recogemos el nombre del artículo de la request, los parámetros y el nombre (:name)

    withDB(async (db) => {
        //Buscarmos el usuario para ver si existe
        const usuario = await db.collection('users').deleteOne({"email": email});
        if (!usuario) {
            return res.status(400).json({
                type: "Error",
                msg: "Usuario no encontrado"
            })
        } else {
            return res.status(200).json({
                type: "Exito",
                msg: "Usuario borrado correctamente"
            })
        }
    }, res);

});


app.listen(5000, () => console.log("Listening on port 5000"));

