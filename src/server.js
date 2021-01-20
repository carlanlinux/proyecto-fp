import express from 'express';
import bodyParser from 'body-parser';
import {MongoClient} from 'mongodb';
import * as path from "path";

//Levantar servidor le decimos que ejecute de nuevo el comando cuando detecte algún cambio:
// npx nodemon --exec npx babel-node src/server.js
// node start
//Ejecutar mongo poner: mongod


const app = express();

//--> Indicar la ruta de despliegue de la aplicación
app.use(express.static(path.join(__dirname, 'build')));

app.use(bodyParser.json());

//Creamos una función que gestiona la conexión con la base de datos y le pasamos como parámetro las operaciones a realizar
const withDB = async (operations, res) => {
    try {
        //Conectamos con la base de datos, hay que pasar siempre las opciones de newURLparser true
        const client = await MongoClient.connect('mongodb://localhost:27017', {poolSize: 10, bufferMaxEntries: 0, reconnectTries: 5000, useNewUrlParser: true});
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


})


//Rescatamos todos los artículos que tenemos en la colección
app.get('/api/usuarios', async (req, res) => {

    //Llamamos a la función de la base de datos y tenemos como parámetro la propia base de datos y la operación que
    // queremos realizar
    await withDB(async (db) => {
        //Buscamos en al base de datos el artículo que tenga ese nombre
        const infoArticulo = await db.collection('usuarios').find()
        //Le asignas el número del estado al constuir la respuesta.
        await res.status(200).json(infoArticulo);
    }, res);


})

//Obtener artículo
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

})

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
            '$set' : {
                comentarios: articleInfo.comentarios.concat({usuario, comentario}),
            },
        });
        const updatedArticleInfo = await db.collection('articulos').findOne({nombre: articleName});
        //enviamos la respuesta si ha ido bien (status 200) con los comentarios del artículo en cuestión
        await res.status(200).json(updatedArticleInfo);
    }, res);

});

/*app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});*/

//Aquí le decimos que lo que nos llegue de cualuqiera de las API REST pase por nuestra app
app.get('*', (req, res) =>{
    res.sendFile(path.join(__dirname + '/build/index.html'));
})

/* Testeo de API
app.get('/api/hola', (req, res) => res.send('Hola, la API funciona!'));

app.post('/api/hola/:nombre', (req, res) => res.send(`Hola, ${req.params.nombre}, la API funciona!`));
*/

app.listen(5000, () => console.log("Listening on port 5000"));

