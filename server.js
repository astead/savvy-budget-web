const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = 3001; // Use a different port than React
const knex = require('knex');
require('module-alias/register');
const { channels } = require('@shared/constants.js');

app.use(cors());
app.use(express.json());

let db = null;

const set_db = async () => {
  if (db) {
    console.log('db connection is already set to the same file. ignoring.');
    return;
  }
  if (db) {
    await db.destroy();
    db = null;
  }
  if (!db) {
    console.log('Setting knex DB connection to PG Supabase to: ', process.env.REACT_APP_SUPABASE_CONN_HOST);
    db = knex({
      client: 'pg',
      debug: true,
      log: {
        warn(message) {},
        error(message) {},
        deprecate(message) {},
        debug(message) {},
      },
      connection: {
        host: process.env.REACT_APP_SUPABASE_CONN_HOST,
        port: process.env.REACT_APP_SUPABASE_CONN_PORT,
        user: process.env.REACT_APP_SUPABASE_CONN_USER,
        password: process.env.REACT_APP_SUPABASE_CONN_PW,
        database: process.env.REACT_APP_SUPABASE_CONN_DB,
        //ssl: process.env.REACT_APP_SUPABASE_CONN_DB ? { rejectUnauthorized: false } : false,
        ssl: false,
      },
      useNullAsDefault: true,
    });

    db.raw("SELECT 1").then(() => {
        console.log("PostgreSQL connected");
    })
    .catch((e) => {
        console.log("PostgreSQL not connected");
        console.error(e);
    });
  }
};

set_db();

// Example endpoint
app.post('/api/'+channels.GET_CAT_ENV, (req, res) => {
  const { onlyActive } = req.body;
  console.log(channels.GET_CAT_ENV + " ENTER");
  if (db) {
    let query = db
      .select(
        'category.id as catID',
        'category.category',
        'envelope.id as envID',
        'envelope.envelope',
        'envelope.balance as currBalance',
        'envelope.isActive'
      )
      .from('category')
      .leftJoin('envelope', function () {
        this.on('category.id', '=', 'envelope.categoryID');
      })
      .orderBy('category.id');

    if (onlyActive === 1) {
      query.where('envelope.isActive', 1);
    }

    query
      .then((data) => {
        res.json(data);
      })
      .catch((err) => console.log(err));
  }  
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
