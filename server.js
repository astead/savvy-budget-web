const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = 3001; // Use a different port than React
const knex = require('knex');
require('module-alias/register');
const { channels } = require('@shared/constants.js');
const dayjs = require('dayjs');

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

app.post('/api/'+channels.PLAID_UPDATE_LOGIN, async (req, res) => {
  const { access_token } = req.body;
  console.log('Switching to update mode');
  if (PLAID_CLIENT_ID?.length) {
    try {
      const linkTokenResponse = await client.linkTokenCreate({
        ...configs,
        access_token: access_token,
      });

      // Use the link_token to initialize Link
      //console.log(linkTokenResponse);
      res.json({
        link_token: linkTokenResponse.data.link_token,
        error: '',
      });
    } catch (error) {
      console.log(error);
      res.json({
        link_token: '',
        error: error,
      });
    }
  } else {
    res.json({
      link_token: '',
      error: 'PLAID_CLIENT_ID not set.',
    });
  }
});

app.post('/api/'+channels.PLAID_SET_KEYS, async (req, res) => {
  const { client_id, secret, environment } = req.body;
  console.log(channels.PLAID_SET_KEYS);

  PLAID_CLIENT_ID = client_id.trim();
  PLAID_SECRET = secret.trim();
  PLAID_ENV = environment.trim();

  client.configuration.baseOptions.headers['PLAID-CLIENT-ID'] =
    PLAID_CLIENT_ID;
  client.configuration.baseOptions.headers['PLAID-SECRET'] = PLAID_SECRET;
  client.configuration.basePath = PlaidEnvironments[PLAID_ENV];

  if (db) {
    db.select('client_id')
      .from('plaid')
      .then((rows) => {
        if (rows?.length) {
          db('plaid')
            .update('client_id', client_id)
            .update('secret', secret)
            .update('environment', environment)
            .update('token', '')
            .then()
            .catch((err) => console.log(err));
        } else {
          db('plaid')
            .insert({
              client_id: client_id,
              secret: secret,
              environment: environment,
            })
            .then()
            .catch((err) => console.log(err));
        }
      })
      .catch((err) => console.log(err));
  }
});

app.post('/api/'+channels.PLAID_GET_ACCOUNTS, async (req, res) => {
  console.log(channels.PLAID_GET_ACCOUNTS);
  if (db) {
    const find_date = dayjs(new Date()).format('YYYY-MM-DD');
    let query = db
      .select(
        'plaid_account.id',
        'plaid_account.institution',
        'plaid_account.account_id',
        'plaid_account.mask',
        'plaid_account.account_name',
        'plaid_account.account_subtype',
        'plaid_account.account_type',
        'plaid_account.verification_status',
        'plaid_account.item_id',
        'plaid_account.access_token',
        'plaid_account.cursor'
      )
      .max({ lastTx: 'txDate' })
      .from('plaid_account')
      .join('account', 'plaid_account.account_id', 'account.plaid_id')
      .leftJoin('transaction', function () {
        this.on('account.id', '=', 'transaction.accountID')
          .on('transaction.isBudget', '=', 0)
          .on('transaction.isDuplicate', '=', 0);
          // PostgreSQL specific
          this.on(db.raw(`?::date - "txDate" >= 0`, [find_date]));
          this.on(db.raw(`"transaction"."isVisible" = true`));
      })
      .orderBy('institution', 'public_token')
      .groupBy(
        'plaid_account.id',
        'plaid_account.institution',
        'plaid_account.account_id',
        'plaid_account.mask',
        'plaid_account.account_name',
        'plaid_account.account_subtype',
        'plaid_account.account_type',
        'plaid_account.verification_status',
        'plaid_account.item_id',
        'plaid_account.access_token',
        'plaid_account.cursor'
      );
    query
      .then((data) => {
        res.json(data);
      })
      .catch((err) => console.log(err));
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
