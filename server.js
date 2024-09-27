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

// PLAID stuff
const {
  Configuration,
  PlaidApi,
  Products,
  PlaidEnvironments,
} = require('plaid');
const { LogExit } = require('concurrently');

const APP_PORT = process.env.APP_PORT || 8000;
let PLAID_CLIENT_ID = '';
let PLAID_SECRET = '';
let PLAID_ENV = '';

// PLAID_PRODUCTS is a comma-separated list of products to use when initializing
// Link. Note that this list must contain 'assets' in order for the app to be
// able to create and retrieve asset reports.
const PLAID_PRODUCTS = [Products.Transactions];

// PLAID_COUNTRY_CODES is a comma-separated list of countries for which users
// will be able to select institutions from.
const PLAID_COUNTRY_CODES = (process.env.PLAID_COUNTRY_CODES || 'US').split(
  ','
);

// Initialize the Plaid client
// Find your API keys in the Dashboard (https://dashboard.plaid.com/account/keys)

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
      'Plaid-Version': '2020-09-14',
    },
  },
});

// Used for most PLAID operations
const client = new PlaidApi(configuration);

// Used to create the link token
const configs = {
  user: {
    // This should correspond to a unique id for the current user.
    client_user_id: '2',
  },
  client_name: 'Savvy Budget',
  products: PLAID_PRODUCTS,
  country_codes: PLAID_COUNTRY_CODES,
  language: 'en',
  redirect_uri: 'https://localhost:3000',
};

app.post('/api/'+channels.PLAID_SET_ACCESS_TOKEN, async (req, res) => {
  const { public_token, metadata } = req.body;
  console.log('Try getting plaid access token');

  try {
    const response = await client.itemPublicTokenExchange({
      public_token: public_token,
    });

    // These values should be saved to a persistent database and
    // associated with the currently signed-in user
    const access_token = response.data.access_token;
    const itemID = response.data.item_id;
    console.log('itemPublicTokenExchange return:', response.data);

    metadata.accounts.forEach((account, index) => {
      db('account')
        .insert({
          account:
            metadata.institution.name +
            '-' +
            account.name +
            '-' +
            account.mask,
          refNumber:
            metadata.institution.name +
            '-' +
            account.name +
            '-' +
            account.mask,
          plaid_id: account.id,
          isActive: dbPath === 'cloud' ? true : 1,
        })
        .then(() => {
          db('plaid_account')
            .insert({
              institution: metadata.institution.name,
              account_id: account.id,
              mask: account.mask,
              account_name: account.name,
              account_subtype: account.subtype,
              account_type: account.type,
              verification_status: account.verification_status,
              item_id: itemID,
              access_token: access_token,
              cursor: null,
            })
            .then(() => {
              console.log('Added PLAID account ');
            })
            .catch((err) => console.log('Error: ' + err));
        })
        .catch((err) => console.log('Error: ' + err));
    });
  } catch (error) {
    // handle error
    console.log('Error: ', error);
  }
});


app.post('/api/'+channels.PLAID_GET_KEYS, (req, res) => {
  console.log(channels.PLAID_GET_KEYS);
  if (db) {
    db.select('client_id', 'secret', 'environment', 'token', 'token_expiration')
      .from('plaid')
      .then((data) => {
        PLAID_CLIENT_ID = data[0].client_id.trim();
        PLAID_SECRET = data[0].secret.trim();
        PLAID_ENV = data[0].environment.trim();

        client.configuration.baseOptions.headers['PLAID-CLIENT-ID'] =
          PLAID_CLIENT_ID;
        client.configuration.baseOptions.headers['PLAID-SECRET'] = PLAID_SECRET;
        client.configuration.basePath = PlaidEnvironments[PLAID_ENV];

        if (data[0].token) {
          client.linkTokenCreate(configs);
        }

        res.json(data);
      })
      .catch((err) => console.log(err));
  }
});

app.post('/api/'+channels.PLAID_GET_TOKEN, async (req, res) => {
  console.log('Try getting PLAID link token');
  if (PLAID_CLIENT_ID?.length) {
    try {
      const createTokenResponse = await client.linkTokenCreate(configs);

      if (db) {
        db('plaid')
          .update('token', createTokenResponse.data.link_token)
          .update('token_expiration', createTokenResponse.data.expiration)
          .then()
          .catch((err) => console.log(err));
      }

      res.json(createTokenResponse.data);
    } catch (error) {
      console.log(error);
      // handle error
      console.log('Error: ', error.response.data.error_message);

      res.json(error.response.data);
    }
  } else {
    res.json(null);
  }
});



// Get the categories and envelopes
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
