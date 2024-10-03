const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config();
const fs = require('fs');
const port = 3001; // Use a different port than React
const knex = require('knex');
require('module-alias/register');
const { auth0data, channels } = require('@shared/constants.js');
const dayjs = require('dayjs');
const { auth, requiredScopes } = require('express-oauth2-jwt-bearer');



// Authorization middleware. When used, the Access Token must
// exist and be verified against the Auth0 JSON Web Key Set.
const checkJwt = auth({
  audience: auth0data.audience,
  issuerBaseURL: auth0data.issuerBaseURL,
  tokenSigningAlg: auth0data.tokenSigningAlg,
});

app.use(express.json());
app.use(cors({ origin: auth0data.origin }));
app.use(checkJwt);
app.use((req, res, next) => {
  //console.log('Authorization Header:', req.headers.authorization);
  const token = req.headers.authorization.split(' ')[1];
  const decodedToken = jwt.decode(token);
  req.auth0Id = decodedToken.sub; // Auth0 user ID
  next();
});

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
        ssl: process.env.REACT_APP_SUPABASE_CONN_CERT ? 
          { rejectUnauthorized: false, 
            cert: fs.readFileSync(process.env.REACT_APP_SUPABASE_CONN_CERT).toString() } : 
          false,
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

const getUserId = async (auth0Id) => {
  const user = await db('users').where({ auth0_id: auth0Id }).first();
  if (!user) {
    throw new Error('User not found');
  }
  return user.id;
};

app.post('/api/'+channels.AUTH0_CHECK_CREATE_USER, async (req, res) => {
  const { user } = req.body;
  console.log('AUTH0_CHECK_CREATE_USER ENTER');
  const token = req.headers.authorization.split(' ')[1];
  const decodedToken = jwt.decode(token);
  const auth0Id = decodedToken.sub;

  try {
    
    await db('users')
    .select('id')
    .where('auth0_id', auth0Id)
    .then(async function (rows) {
      if (rows.length === 0) {
        // no matching records found
        return await db('users')
          .insert({
            auth0_id: auth0Id,
            email: user.email,
            name: user.name,
          })
          .then(async () => {
            // Create default DB data
            const userId = await getUserId(auth0Id);
            await db('category').insert({ category: 'Uncategorized', user_id: userId }).then();
            await db('category').insert({ category: 'Income', user_id: userId }).then();

            res.status(201).json({ message: 'User created successfully' });
          })
          .catch((err) => {
            console.log('Error creating user: ' + err);
          });
      } else {
        // Already exists
        res.status(200).json({ message: 'User already exists' });
      }
    })
    .catch((err) => {
      console.log('Error checking if user exists: ' + err);
    });

  } catch (error) {
    console.error('Error checking or creating user:', error);
    res.status(500).json({ message: 'Error checking or creating user' });
  }
});

// PLAID stuff
const {
  Configuration,
  PlaidApi,
  Products,
  PlaidEnvironments,
} = require('plaid');
const { LogExit } = require('concurrently');

const APP_PORT = process.env.APP_PORT || 8000;
let PLAID_CLIENT_ID = process.env.REACT_APP_PLAID_CLIENT_ID;
let PLAID_SECRET = process.env.REACT_APP_PLAID_SECRET;
let PLAID_ENV = process.env.REACT_APP_PLAID_ENV;

// PLAID_PRODUCTS is a comma-separated list of products to use when initializing
// Link. Note that this list must contain 'assets' in order for the app to be
// able to create and retrieve asset reports.
const PLAID_PRODUCTS = [Products.Transactions];

// PLAID_COUNTRY_CODES is a comma-separated list of countries for which users
// will be able to select institutions from.
const PLAID_COUNTRY_CODES = (process.env.REACT_APP_PLAID_COUNTRY_CODES || 'US').split(',');

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
let plaid_link_token = null;
let plaid_link_token_exp = null;

// Used to create the link token
const configs = {
  user: {
    // This should correspond to a unique id for the current user.
    // This should get entered in a call to plaid_setup_client
    // before being used.
    client_user_id: '',
  },
  client_name: 'Savvy Budget',
  products: PLAID_PRODUCTS,
  country_codes: PLAID_COUNTRY_CODES,
  language: 'en',
  redirect_uri: 'https://localhost:3000',
};

// This should be on the server only
const plaid_setup_client = async (userId) => {
  console.log("plaid_setup_client ENTER");
  
  // This should correspond to a unique id for the current user.
  configs.user.client_user_id = userId.toString();

  console.log("plaid_setup_client EXIT");
};

const plaid_get_link_token = async () => {
  console.log('plaid_get_link_token ENTER');
  const createTokenResponse = await client.linkTokenCreate(configs);

  plaid_link_token = createTokenResponse.data.link_token;
  plaid_link_token_exp = createTokenResponse.data.expiration;

  console.log("plaid_link_token : " + plaid_link_token);
  console.log("plaid_link_token_exp : " + plaid_link_token_exp);

  console.log('plaid_get_link_token EXIT');
};

app.post('/api/'+channels.PLAID_GET_TOKEN, async (req, res) => {
  console.log('PLAID_GET_TOKEN ENTER');

  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  const userId = await getUserId(auth0Id);

  if (PLAID_CLIENT_ID?.length) {
    try {
      
      await plaid_setup_client(userId);
      await plaid_get_link_token();
      
      console.log("PLAID_GET_TOKEN returning:");
      console.log({ link_token: plaid_link_token, expiration: plaid_link_token_exp });
      
      res.json({ link_token: plaid_link_token, expiration: plaid_link_token_exp });
    } catch (error) {
      console.log(error);
      // handle error
      console.log('Error: ', error.response.data.error_message);
      console.log('Error: ', error.message);

      res.json(error.response.data);
    }
  } else {
    console.log("PLAID_CLIENT_ID is null, or length is 0?: " + PLAID_CLIENT_ID);
    res.json(null);
  }
});

app.post('/api/'+channels.PLAID_SET_ACCESS_TOKEN, async (req, res) => {
  console.log('Try getting plaid access token');

  const { public_token, metadata } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const response = await client.itemPublicTokenExchange({
      public_token: public_token,
    });

    const userId = await getUserId(auth0Id);

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
          isActive: true,
          user_id: userId,
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
              user_id: userId,
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

app.post('/api/'+channels.PLAID_GET_ACCOUNTS, async (req, res) => {
  console.log(channels.PLAID_GET_ACCOUNTS);
  
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);
  
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
          .andOn('transaction.isBudget', '=', 0)
          .andOn('transaction.isDuplicate', '=', 0)
          .andOn('account.user_id', '=', db.raw(`?`, [userId]))
          .andOn('transaction.user_id', '=', db.raw(`?`, [userId]));
          // PostgreSQL specific
          this.on(db.raw(`?::date - "txDate" >= 0`, [find_date]));
          this.on(db.raw(`"transaction"."isVisible" = true`));
      })
      .where({ 'plaid_account.user_id': userId })
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

    const data = await query;
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.PLAID_REMOVE_LOGIN, async (req, res) => {
  console.log('Removing plaid account login ');

  const { access_token } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    await remove_plaid_login(access_token);

    await db.transaction(async (trx) => {
      // Get the account info
      const data = await trx
        .select('account_id')
        .from('plaid_account')
        .where({ access_token: access_token, user_id: userId });

      for (const item of data) {
        // Remove the plaid account from the database
        await remove_plaid_account(trx, userId, item.account_id);

        // If there was a regular account, disconnect it from a plaid account
        await remove_plaid_account_link(trx, userId, item.account_id);
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

async function remove_plaid_login(access_token) {
  let response = null;
  try {
    response = await client.itemRemove({
      access_token: access_token,
    });
  } catch (e) {
    console.log('Error: ', e.response.data.error_message);
    return;
  }
  console.log('Response: ' + response);
}

async function remove_plaid_account(trx, userId, account_id) {
  await trx('plaid_account')
    .delete()
    .where({ account_id: account_id, user_id: userId });
}

async function remove_plaid_account_link(trx, userId, account_id) {
  await trx('account')
    .update({ plaid_id: null })
    .where({ plaid_id: account_id, user_id: userId });
}

// TODO: refactor this a bit better with try / catch, and combine with function below
// maybe pull out components to separate functions?
app.post('/api/'+channels.PLAID_GET_TRANSACTIONS, async (req, res) => {
  console.log(channels.PLAID_GET_TRANSACTIONS);

  const { access_token, cursor } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  const userId = await getUserId(auth0Id);

  let added = [];
  let modified = [];
  let removed = [];
  let hasMore = true;
  let cursor_iter = cursor;

  while (hasMore) {
    console.log('Making the call ');
    let response = null;
    try {
      response = await client.transactionsSync({
        access_token: access_token,
        cursor: cursor_iter,
      });
    } catch (e) {
      console.log('Error: ', e.response.data.error_message);
      //event.sender.send(channels.UPLOAD_PROGRESS, 100);
      res.json(e.response.data);
      return;
    }
    console.log('Response: ' + response);
    const data = response.data;
    console.log(' Response: ', data);

    // Add this page of results
    added = added.concat(data.added);
    modified = modified.concat(data.modified);
    removed = removed.concat(data.removed);
    hasMore = data.has_more;

    // Update cursor to the next cursor
    cursor_iter = data.next_cursor;
  }

  console.log('Done getting the data, now processing');

  //let total_records = added.length + modified.length + removed.length;
  //let cur_record = 0;

  // Apply added
  const accountArr = [];
  for (const [i, a] of added.entries()) {
    let account_str = a.account_id;
    let accountID = '';
    if (accountArr?.length) {
      const found = accountArr.find((e) => e.name === account_str);
      if (found) {
        accountID = found.id;
      } else {
        accountID = await lookup_plaid_account(userId, account_str);
        accountArr.push({ name: account_str, id: accountID });
      }
    } else {
      accountID = await lookup_plaid_account(userId, account_str);
      accountArr.push({ name: account_str, id: accountID });
    }

    let envID = await lookup_keyword(userId, accountID, a.name, a.date);

    // Check if this is a duplicate
    let isDuplicate = await lookup_if_duplicate(
      userId,
      accountID,
      a.transaction_id,
      a.date,
      -1 * a.amount,
      a.name
    );

    // Check for matching removed transaction
    let matchingRemoved = removed.find(r => 
      r.transaction_id === a.pending_transaction_id
    );

    if (matchingRemoved) {
      // Update the existing transaction's transaction_id
      await update_transaction_id(
        userId,
        access_token,
        matchingRemoved.transaction_id, 
        a.transaction_id,
        -1 * a.amount,
        a.date,
        a.name
      );
    } else if (isDuplicate !== 1) {
      await basic_insert_transaction_node(
        userId,
        accountID,
        -1 * a.amount,
        a.date,
        a.name,
        a.transaction_id,
        envID
      );
    }

    /*
    cur_record++;
    event.sender.send(
      channels.UPLOAD_PROGRESS,
      (cur_record * 100) / total_records
    );
    */
  }

  // Apply removed
  for (const [i, r] of removed.entries()) {
    await basic_remove_transaction_node(access_token, r.transaction_id);

    /*
    cur_record++;
    event.sender.send(
      channels.UPLOAD_PROGRESS,
      (cur_record * 100) / total_records
    );
    */
  }

  // Apply modified
  for (const [i, m] of modified.entries()) {
    let account_str = m.account_id;
    let accountID = '';
    if (accountArr?.length) {
      const found = accountArr.find((e) => e.name === account_str);
      if (found) {
        accountID = found.id;
      } else {
        accountID = await lookup_plaid_account(userId, account_str);
        accountArr.push({ name: account_str, id: accountID });
      }
    } else {
      accountID = await lookup_plaid_account(userId, account_str);
      accountArr.push({ name: account_str, id: accountID });
    }

    let envID = await lookup_keyword(userId, accountID, m.name, m.date);

    // Rather than modify it, just remove the old and the new
    await basic_remove_transaction_node(access_token, m.transaction_id);

    await basic_insert_transaction_node(
      userId,
      accountID,
      -1 * m.amount,
      m.date,
      m.name,
      m.transaction_id,
      envID
    );

    /*
    cur_record++;
    event.sender.send(
      channels.UPLOAD_PROGRESS,
      (cur_record * 100) / total_records
    );
    */
  }

  // Update cursor
  db('plaid_account')
    .where({ access_token: access_token, user_id: userId })
    .update({ cursor: cursor_iter })
    .catch((err) => console.log('Error: ' + err));

  //event.sender.send(channels.UPLOAD_PROGRESS, 100);
});

// TODO: this can probably be consolidated with the above function
//       pulling out common tasks to a helper function.
app.post('/api/'+channels.PLAID_FORCE_TRANSACTIONS, async (req, res) => {
  console.log('Try getting plaid account transactions ');

  const { access_token, start_date, end_date } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  const userId = await getUserId(auth0Id);

  let added = [];

  console.log('Making the call ');
  let response = null;
  try {
    response = await client.transactionsGet({
      access_token: access_token,
      start_date: start_date,
      end_date: end_date,
    });
  } catch (e) {
    console.log('Error: ', e.response.data.error_message);
    res.json(e.response.data);
    return;
  }
  let transactions = response.data.transactions;
  const total_transactions = response.data.total_transactions;

  // Add this page of results
  added = added.concat(transactions);

  while (transactions.length < total_transactions) {
    const paginatedRequest = {
      access_token: access_token,
      start_date: start_date,
      end_date: end_date,
      options: {
        offset: transactions.length,
      },
    };

    const paginatedResponse = await client.transactionsGet(paginatedRequest);
    added = added.concat(paginatedResponse.data.transactions);
  }

  console.log(added);
  console.log(
    'Done getting the data, now processing: ',
    added.length,
    ' transaction(s)'
  );

  //let total_records = added.length;
  //let cur_record = 0;

  // Apply added
  const accountArr = [];
  for (const [i, a] of added.entries()) {
    let account_str = a.account_id;
    let accountID = '';
    if (accountArr?.length) {
      const found = accountArr.find((e) => e.name === account_str);
      if (found) {
        accountID = found.id;
      } else {
        accountID = await lookup_plaid_account(userId, account_str);
        accountArr.push({ name: account_str, id: accountID });
      }
    } else {
      accountID = await lookup_plaid_account(userId, account_str);
      accountArr.push({ name: account_str, id: accountID });
    }

    let envID = await lookup_keyword(userId, accountID, a.name, a.date);

    // Check if this is a duplicate
    let isDuplicate = await lookup_if_duplicate(
      userId,
      accountID,
      a.transaction_id,
      a.date,
      -1 * a.amount,
      a.name
    );

    if (isDuplicate !== 1) {
      await basic_insert_transaction_node(
        userId,
        accountID,
        -1 * a.amount,
        a.date,
        a.name,
        a.transaction_id,
        envID
      );
    }

    /*
    cur_record++;
    event.sender.send(
      channels.UPLOAD_PROGRESS,
      (cur_record * 100) / total_records
    );
    */
  }

  //event.sender.send(channels.UPLOAD_PROGRESS, 100);
});

app.post('/api/'+channels.UPDATE_TX_ENV_LIST, async (req, res) => {
  console.log(channels.UPDATE_TX_ENV_LIST);

  const { new_value, filtered_nodes } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    for (let t of filtered_nodes) {
      await update_tx_env(userId, t.txID, new_value);
    }
  
    res.status(200).send('Updated transaction envelope list successfully.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.DEL_TX_LIST, async (req, res) => {
  console.log(channels.DEL_TX_LIST);
  
  const { del_tx_list } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    for (let t of del_tx_list) {
      if (t.isChecked) {
        console.log('deleting: ' + t.txID);
        await remove_transaction(userId, t.txID);
      }
    }

    res.status(200).send('Deleted transaction list successfully.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.SPLIT_TX, async (req, res) => {
  console.log(channels.SPLIT_TX);

  const { txID, split_tx_list } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    // Lets use a transaction for this
    await db.transaction(async (trx) => {
      // Get some info on the original
      const data = await trx
        .select(
          'id',
          'envelopeID',
          'txAmt',
          'accountID',
          'refNumber',
          'origTxID',
          'isVisible',
          'isDuplicate'
        )
        .from('transaction')
        .where({ id: txID })
        .andWhere({ user_id: userId });

      if (data?.length) {
        // Delete the original
        await trx('transaction')
          .delete()
          .where({ id: txID })
          .andWhere({'user_id': userId});
          
        // Update the original budget
        await trx('envelope')
          .where({ id: data[0].envelopeID, user_id: userId })
          .update({
            balance: db.raw('balance - ?', [data[0].txAmt])
          });

        // Loop through each new split
        for (let item of split_tx_list) {
          // Insert the new transaction
          await trx('transaction')
            .insert({
              envelopeID: item.txEnvID,
              txAmt: item.txAmt,
              txDate: item.txDate,
              description: item.txDesc,
              refNumber: data[0].refNumber,
              isBudget: 0,
              origTxID: data[0].origTxID
                ? data[0].origTxID
                : txID,
              isDuplicate: data[0].isDuplicate,
              isSplit: 1,
              accountID: data[0].accountID,
              isVisible: data[0].isVisible,
              user_id: userId,
            });

          // Adjust that envelope balance
          await trx('envelope')
            .where({ id: item.txEnvID, user_id: userId })
            .update({
              balance: db.raw('balance + ?', [item.txAmt])
            });
        }
      }
    });

    res.status(200).send('Split transaction successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.ADD_ENVELOPE, async (req, res) => {
  console.log(channels.ADD_ENVELOPE);

  const { categoryID } = req.body;
  const auth0Id = req.auth0Id; // Extracted user ID

  try {
    const userId = await getUserId(auth0Id);

    await db('envelope')
      .insert({
        user_id: userId,
        categoryID: categoryID,
        envelope: 'New Envelope',
        balance: 0,
        isActive: true,
        user_id: userId,
      }); 

    res.status(200).send('Added envelope successfully');

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.ADD_CATEGORY, async (req, res) => {
  console.log(channels.ADD_CATEGORY);

  const { name } = req.body;
  const auth0Id = req.auth0Id; // Extracted user ID

  try {
    const userId = await getUserId(auth0Id);

    await db('category')
      .insert({
        category: name,
        user_id: userId,
      });
     
    res.status(200).send('Added category successfully');

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.DEL_CATEGORY, async (req, res) => {
  console.log(channels.DEL_CATEGORY);

  const { id } = req.body;
  const auth0Id = req.auth0Id; // Extracted user ID

  try {
    const userId = await getUserId(auth0Id);

    // Move any sub-envelopes to Uncategorized
    const uncategorizedID = await lookup_uncategorized(userId);

    await db.transaction(async (trx) => {
      await trx('envelope')
        .where({ categoryID: id, user_id: userId })
        .update({ categoryID: uncategorizedID });

      await trx('category')
        .where({ id: id, user_id: userId })
        .del();
    });
     
    res.status(200).send('Deleted category successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.DEL_ENVELOPE, async (req, res) => {
  console.log(channels.DEL_ENVELOPE);

  const { id } = req.body;
  const auth0Id = req.auth0Id; // Extracted user ID

  try {
    const userId = await getUserId(auth0Id);

    await db.transaction(async (trx) => {
      await trx('transaction')
        .where({ envelopeID: id, user_id: userId })
        .update({ envelopeID: -1 });

      await trx('keyword')
        .where({ envelopeID: id, user_id: userId })
        .delete();
      
      await trx('envelope')
        .where({ id: id, user_id: userId })
        .delete();
    });
      
    res.status(200).send('Deleted envelope successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.HIDE_ENVELOPE, async (req, res) => {
  console.log(channels.HIDE_ENVELOPE);

  const { id } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    await db('envelope')
      .where({ id: id, user_id: userId })
      .update({ isActive: false });

    res.status(200).send('Hid envelope successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.REN_CATEGORY, async (req, res) => {
  console.log(channels.REN_CATEGORY);

  const { id, name } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    await db('category')
      .where({ id: id, user_id: userId })
      .update({ category: name });
  
    res.status(200).send('Renamed category to ' + name + ' successfully');
    
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.REN_ENVELOPE, async (req, res) => {
  console.log(channels.REN_ENVELOPE);

  const { id, name } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    await db('envelope')
      .where({ id: id, user_id: userId })
      .update({ envelope: name });

    res.status(200).send('Renamed envelope to ' + name + ' successfully');

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.MOV_ENVELOPE, async (req, res) => {
  console.log(channels.MOV_ENVELOPE);

  const { id, newCatID } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    await db('envelope')
      .where({ id: id, user_id: userId })
      .update({ categoryID: newCatID });

    res.status(200).send('Moved envelope to ' + newCatID + ' successfully');

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.COPY_BUDGET, async (req, res) => {
  console.log(channels.COPY_BUDGET);

  const { newtxDate, budget_values } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  const userId = await getUserId(auth0Id);

  for (let item of budget_values) {
    await set_or_update_budget_item(userId, item.envID, newtxDate, item.value);
  }
});

app.post('/api/'+channels.UPDATE_BUDGET, async (req, res) => {
  console.log(channels.UPDATE_BUDGET);

  const { newEnvelopeID, newtxDate, newtxAmt } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  const userId = await getUserId(auth0Id);

  await set_or_update_budget_item(userId, newEnvelopeID, newtxDate, newtxAmt);
});

app.post('/api/'+channels.UPDATE_BALANCE, async (req, res) => {
  console.log(channels.UPDATE_BALANCE);

  const { id, newAmt } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    await db('envelope')
      .update({ balance: newAmt })
      .where({ id: id, user_id: userId });

    res.status(200).send('Balance updated successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.MOVE_BALANCE, async (req, res) => {
  console.log(channels.MOVE_BALANCE);

  const { transferAmt, fromID, toID } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  // TODO: Check to make sure moving balances works after changing this
  try {
    const userId = await getUserId(auth0Id);

    await db.transaction(async (trx) => {
      await trx('envelope')
        .where({ id: fromID, user_id: userId })
        .update({
          balance: db.raw('balance - ?', [transferAmt])
        });

      await trx('envelope')
        .where({ id: toID, user_id: userId })
        .update({
          balance: db.raw('balance + ?', [transferAmt])
        });
    });

    res.status(200).send('Balance transferred successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// Get the categories and envelopes
app.post('/api/'+channels.GET_CAT_ENV, async (req, res) => {
  console.log(channels.GET_CAT_ENV);

  const { onlyActive } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);
    
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
        this.on('category.id', '=', 'envelope.categoryID')
          .andOn('envelope.user_id', '=', db.raw(`?`, [userId]));
      })
      .where({ 'category.user_id': userId})
      .orderBy('category.id');

    if (onlyActive === 1) {
      query.where('envelope.isActive', 1);
    }

    const data = await query;
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.GET_BUDGET_ENV, async (req, res) => {
  console.log(channels.GET_BUDGET_ENV);

  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    if (db) {
      const data = await db
        .select(
          'category.id as catID',
          'category.category',
          'envelope.id as envID',
          'envelope.envelope',
          'envelope.balance as currBalance'
        )
        .from('envelope')
        .leftJoin('category', function () {
          this.on('category.id', '=', 'envelope.categoryID')
            .andOn('category.user_id', '=', db.raw(`?`, [userId]))
        })
        .where({ 'envelope.isActive': true, 'envelope.user_id': userId })
        .orderBy('category.id');
      
      res.json(data);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.GET_PREV_BUDGET, async (req, res) => {
  console.log(channels.GET_PREV_BUDGET);

  const { find_date } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    const data = await db
      .select('envelopeID', 'txAmt')
      .from('transaction')
      .orderBy('envelopeID')
      .where({ isBudget: 1, txDate: find_date, user_id: userId });

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.GET_CUR_BUDGET, async (req, res) => {
  console.log(channels.GET_CUR_BUDGET);

  const { find_date } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    const data = await db
      .select('envelopeID', 'txAmt')
      .from('transaction')
      .orderBy('envelopeID')
      .where({ isBudget: 1, txDate: find_date, user_id: userId });

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.GET_PREV_ACTUAL, async (req, res) => {
  console.log(channels.GET_PREV_ACTUAL);

  const { find_date } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    const month = dayjs(new Date(find_date)).format('MM');
    const year = dayjs(new Date(find_date)).format('YYYY');

    let query = db.select('envelopeID')
      .sum({ totalAmt: 'txAmt' })
      .from('transaction')
      .orderBy('envelopeID')
      .where({ isBudget: 0, isDuplicate: 0, isVisible: true, user_id: userId })
      .groupBy('envelopeID');
      
    // PostgreSQL specific
    query = query
      .andWhereRaw(`EXTRACT(MONTH FROM "txDate") = ?`, [month])
      .andWhereRaw(`EXTRACT(YEAR FROM "txDate") = ?`, [year]);
  
    const data = await query;
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.GET_CUR_ACTUAL, async (req, res) => {
  console.log(channels.GET_CUR_ACTUAL);

  const { find_date } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    const month = dayjs(new Date(find_date)).format('MM');
    const year = dayjs(new Date(find_date)).format('YYYY');

    let query = db.select('envelopeID')
      .sum({ totalAmt: 'txAmt' })
      .from('transaction')
      .where({ isBudget: 0, isDuplicate: 0, isVisible: true, user_id: userId })
      .groupBy('envelopeID')
      .orderBy('envelopeID');

    // PostgreSQL specific
    query = query
      .andWhereRaw(`EXTRACT(MONTH FROM "txDate") = ?`, [month])
      .andWhereRaw(`EXTRACT(YEAR FROM "txDate") = ?`, [year]);

    const data = await query;
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.GET_CURR_BALANCE, async (req, res) => {
  console.log(channels.GET_CURR_BALANCE);
  
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    const data = await db.select('id', 'balance')
      .from('envelope')
      .where({ user_id: userId })
      .orderBy('id');

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  } 
});

app.post('/api/'+channels.GET_MONTHLY_AVG, async (req, res) => {
  console.log(channels.GET_MONTHLY_AVG);

  const { find_date } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    let query = db
      .select('envelopeID')
      .sum({ totalAmt: 'txAmt' })
      .min({ firstDate: 'txDate' })
      .from('transaction')
      .orderBy('envelopeID')
      .where({ isBudget: 0, isDuplicate: 0, isVisible: true, user_id: userId })
      .groupBy('envelopeID');

    // PostgreSQL specific
    query = query
      .andWhereRaw(`?::date - "txDate" < 365`, [find_date])
      .andWhereRaw(`?::date - "txDate" > 0`, [find_date]);
  
    const data = await query;
    res.json(data);
  
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  } 
});

app.post('/api/'+channels.GET_TX_DATA, async (req, res) => {
  console.log(channels.GET_TX_DATA);

  const {
    filterStartDate,
    filterEndDate,
    filterCatID,
    filterEnvID,
    filterAccID,
    filterDesc,
    filterAmount,
  } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    let query = db
      .select(
        'transaction.id as txID',
        'envelope.categoryID as catID',
        'transaction.envelopeID as envID',
        'category.category as category',
        'envelope.envelope as envelope',
        'transaction.accountID as accountID',
        'account.account as account',
        'transaction.txDate as txDate',
        'transaction.txAmt as txAmt',
        'transaction.description as description',
        'keyword.envelopeID as keywordEnvID',
        'transaction.isDuplicate as isDuplicate',
        'transaction.isVisible as isVisible',
        'transaction.isSplit as isSplit'
      )
      .from('transaction')
      .leftJoin('envelope', function () {
        this.on('envelope.id', '=', 'transaction.envelopeID')
          .andOn('envelope.user_id', '=', db.raw(`?`, [userId]))
      })
      .leftJoin('category', function () {
        this.on('category.id', '=', 'envelope.categoryID')
          .andOn('category.user_id', '=', db.raw(`?`, [userId]))
      })
      .leftJoin('account', function () {
        this.on('account.id', '=', 'transaction.accountID')
        .andOn('account.user_id', '=', db.raw(`?`, [userId]))
      })
      .leftJoin('keyword', function () {
        //this.on('keyword.description', '=', 'transaction.description');
        /*
        TODO: This is pulling in multiple instances on multiple keyword matches
        Right now that could happen on a keyword rename.
        Keyword insert is disabled if a keyword already matches.
        */
        this.on(
          'transaction.description',
          'like',
          'keyword.description'
        )
        .andOn(function () {
          this
            .onVal('keyword.account', '=', 'All')
            .orOn('keyword.account','account.account');
        })
        .andOn('keyword.user_id', '=', db.raw(`?`, [userId]))
      })
      .where({ isBudget: 0, 'transaction.user_id': userId })
      .orderBy('transaction.txDate', 'desc');

    if (parseInt(filterEnvID) > -2) {
      query = query.andWhere({ 'transaction.envelopeID': filterEnvID });
    } else {
      if (parseInt(filterEnvID) > -3) {
        query = query.andWhere(function () {
          this.where({ 'transaction.envelopeID': -1 })
          .orWhere({ 'envelope.isActive': false });
        });
      }
    }
    if (parseInt(filterCatID) > -1) {
      query = query.andWhere({'envelope.categoryID': filterCatID });
    }
    if (filterAccID !== -1 && filterAccID !== '-1' && filterAccID !== 'All') {
      query = query.andWhere({'account.account': filterAccID });
    }
    if (filterDesc?.length) {
      filterDesc = '%' + filterDesc + '%';
      query = query.andWhereRaw(
        `"transaction"."description" LIKE ?`,
        [filterDesc]
      );
    }
    if (filterStartDate) {
      // PostgreSQL specific
      query = query.andWhereRaw(`"transaction"."txDate" >= ?::date`, [filterStartDate]);
    }
    if (filterEndDate) {
      // PostgreSQL specific
      query = query.andWhereRaw(`"transaction"."txDate" <= ?::date`, [filterEndDate]);
    }
    if (filterAmount?.length) {
      query = query.andWhereRaw(
        `"transaction"."txAmt" = ?`,
        [parseFloat(filterAmount)]
      );
    }

    const data = await query;
    res.json(data);
  
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.ADD_TX, async (req, res) => {
  console.log(channels.ADD_TX);

  const { data } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    // Prepare the data node
    const myNode = {
      envelopeID: data.txEnvID,
      txAmt: data.txAmt,
      txDate: data.txDate,
      description: data.txDesc,
      refNumber: '',
      isBudget: 0,
      origTxID: 0,
      isDuplicate: 0,
      isSplit: 0,
      accountID: data.txAccID,
      isVisible: true,
      user_id: userId,
    };

    // Insert the node
    await db.transaction(async (trx) => {
      await trx('transaction').insert(myNode);

      // Update the envelope balance
      await update_env_balance(trx, userId, data.txEnvID, data.txAmt);
    });

    res.status(200).send('Added transaction successfully.');

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.GET_ENV_LIST, async (req, res) => {
  console.log(channels.GET_ENV_LIST);

  const { onlyActive } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);
    
    let query = db
      .select(
        'envelope.id as envID',
        'category.category as category',
        'envelope.envelope as envelope'
      )
      .from('envelope')
      .leftJoin('category', function () {
        this
          .on('category.id', '=', 'envelope.categoryID')
          .andOn('category.user_id', '=',db.raw(`?`, [userId]));
      })
      .where({ 'envelope.user_id': userId })
      .orderBy('category.category', 'envelope.envelope');

    if (onlyActive === 1) {
      query.where('envelope.isActive', true);
    }

    const data = await query;
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.UPDATE_TX_ENV, async (req, res) => {
  console.log(channels.UPDATE_TX_ENV);

  const { txID, envID } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);
    await update_tx_env(userId, txID, envID);

    res.status(200).send('Updated transaction envelope successfully.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.UPDATE_TX_DESC, async (req, res) => {
  console.log(channels.UPDATE_TX_DESC);

  const { txID, new_value } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    await db('transaction')
      .where({ id: txID, user_id: userId })
      .update({ description: new_value });

    res.status(200).send('Updated transaction description successfully.');

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.UPDATE_TX_DATE, async (req, res) => {
  console.log(channels.UPDATE_TX_DATE);

  const { txID, new_value } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    await db('transaction')
      .where({ id: txID, user_id: userId })
      .update({ txDate: new_value });

    res.status(200).send('Updated transaction date successfully.');

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.SAVE_KEYWORD, async (req, res) => {
  console.log(channels.SAVE_KEYWORD);

  const { acc, envID, description } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    await db.transaction(async (trx) => {
      await trx('keyword')
        .delete()
        .where({ description: description, user_id: userId });
      
      const node = {
        account: acc,
        envelopeID: envID,
        description: description,
        user_id: userId,
      };

      await trx('keyword').insert(node);
    });

    res.status(200).send('Keyword saved successfully');

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.SET_DUPLICATE, async (req, res) => {
  console.log(channels.SET_DUPLICATE);

  const { txID, isDuplicate } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    await db('transaction')
      .update({ isDuplicate: isDuplicate })
      .where({ id: txID, user_id: userId });

    // Need to adjust envelope balance
    await adjust_balance(txID, isDuplicate ? 'rem' : 'add');

    res.status(200).send('Set as duplicate successfully.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.SET_VISIBILITY, async (req, res) => {
  console.log(channels.SET_VISIBILITY);

  const { txID, isVisible } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    await db('transaction')
      .update({ isVisible: isVisible })
      .where({ id: txID, user_id: userId });

    // Need to adjust envelope balance
    await adjust_balance(txID, isVisible ? 'add' : 'rem');

    res.status(200).send('Set visibility successfully.');

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.GET_KEYWORDS, async (req, res) => {
  console.log(channels.GET_KEYWORDS);
  
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);
  
    const data = await db('keyword')
      .select(
        'keyword.id',
        'keyword.envelopeID',
        'description',
        'category',
        'envelope',
        'account',
        'last_used'
      )
      .leftJoin('envelope', function () {
        this.on('keyword.envelopeID', '=', 'envelope.id')
        .andOn('envelope.user_id', '=' ,db.raw(`?`, [userId]));

      })
      .leftJoin('category', function () {
        this.on('category.id', '=', 'envelope.categoryID')
        .andOn('category.user_id', '=', db.raw(`?`, [userId]));
      })
      .where({ 'keyword.user_id': userId });

      res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.GET_ACCOUNT_NAMES, async (req, res) => {
  console.log(channels.GET_ACCOUNT_NAMES);

  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    const data = await db('account')
      .select('account')
      .where({ user_id: userId })
      .orderBy('account')
      .groupBy('account');
    
    res.json(data);
  
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.GET_ACCOUNTS, async (req, res) => {
  console.log(channels.GET_ACCOUNTS);

  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    const find_date = dayjs(new Date()).format('YYYY-MM-DD');

    let query = db('account')
      .select('account.id', 'account.refNumber', 'account', 'isActive')
      .max({ lastTx: 'txDate' })
      .count({ numTx: 'txDate' })
      .leftJoin('transaction', function () {
        this
          .on('account.id', '=', 'transaction.accountID')
          .andOn('transaction.user_id', '=', db.raw(`?`, [userId]))
          .andOn('transaction.isBudget', '=', 0)
          .andOn('transaction.isDuplicate', '=', 0);
        
          // PostgreSQL specific
        this.andOn(db.raw(`?::date - "txDate" >= 0`, [find_date]));
        this.andOn(db.raw(`"transaction"."isVisible" = true`));
      })
      .where({ 'account.user_id': userId})
      .orderBy('account.id')
      .groupBy('account.id', 'account.refNumber', 'account', 'isActive');
    
    const data = await query;
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.UPDATE_KEYWORD_ENV, async (req, res) => {
  console.log(channels.GET_KEYWORDS);

  const { id, new_value } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    await db('keyword')
      .update({ envelopeID: new_value })
      .where({ id: id, user_id: userId });

    res.status(200).send('Updated keyword envelope successfully');

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.UPDATE_KEYWORD_ACC, async (req, res) => {
  console.log(channels.UPDATE_KEYWORD_ACC);

  const { id, new_value } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);
    
    await db('keyword')
      .update({ account: new_value })
      .where({ id: id, user_id: userId });

    res.status(200).send('Updated keyword account successfully');

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.SET_ALL_KEYWORD, async (req, res) => {
  console.log(channels.SET_ALL_KEYWORD);

  const { id, force } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    await db.transaction(async (trx) => {
      const data = await trx('keyword')
        .select('envelopeID', 'description', 'account')
        .where({ id: id, user_id: userId })
      
      if (data.length > 0) {
        let query = trx('transaction')
          .update({ envelopeID: data[0].envelopeID })
          .whereRaw(`"description" LIKE ?`, [data[0].description])
          .andWhere({ user_id: userId });

        if (data[0].account !== 'All') {
          const accountID = await trx('account')
            .select('id')
            .where({ 'account': data[0].account, user_id: userId })
            .first();

          if (accountID) {
            query = query.andWhere({ accountID: accountID.id });
          }
        }

        if (force === 0) {
          query = query.andWhere({ envelopeID: -1 });
        }

        await query;
      }
    });

    res.status(200).send('Set all keywords successfully');

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.DEL_KEYWORD, async (req, res) => {
  console.log(channels.DEL_KEYWORD);

  const { id } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    await db('keyword')
      .delete()
      .where({ id: id, user_id: userId });

    res.status(200).send('Deleted keyword successfully');

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.UPDATE_KEYWORD, async (req, res) => {
  console.log(channels.UPDATE_KEYWORD);

  const { id, new_value } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    await db('keyword')
      .update({ description: new_value })
      .where({ id: id, user_id: userId });

    res.status(200).send('Updated keyword successfully');
  
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.UPDATE_ACCOUNT, async (req, res) => {
  console.log(channels.UPDATE_ACCOUNT);

  const { id, new_value } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    await db('account')
      .update({ account: new_value })
      .where({ id: id, user_id: userId });

    res.status(200).send('Updated account successfully');
  
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.VIS_ACCOUNT, async (req, res) => {
  console.log(channels.VIS_ACCOUNT);

  const { id, value } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    await db('account')
    .update({ isActive: value })
    .where({ id: id, user_id: userId });

    res.status(200).send('Updated account visibility successfully');
  
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.DEL_ACCOUNT, async (req, res) => {
  console.log(channels.DEL_ACCOUNT);

  const { id } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    await db.transaction(async (trx) => {
      // Get the account info
      const data = await trx
        .select('id', 'account', 'refNumber', 'plaid_id')
        .from('account')
        .where({ id: id, user_id: userId });
        
      if (data?.length) {
        // Delete the original
        await trx('account')
          .delete()
          .where({ id: id, user_id: userId });
          
        // TODO: Not sure if we want to delete the plaid account
        // We would be leaving the account login
        // If we delete the account login as well, it would remove the login
        // for all accounts of this institution.
        // Seems like it would be best to disconnect
        // the plaid account from this account, and
        // let the user remove the plaid portion from the configPlaid page.
        //if (data[0].plaid_id?.length) {
        // delete the plaid account if it exists
        //await trx('plaid_account')
        //  .delete()
        //  .where({ account_id: data[0].plaid_id });
        //}
      }        
    });
    
    res.status(200).send('Deleted account successfully');
  
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.GET_ENV_CHART_DATA, async (req, res) => {
  console.log(channels.GET_ENV_CHART_DATA);

  const { filterEnvID, filterTimeFrameID } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    const find_date = dayjs(new Date()).format('YYYY-MM-DD');

    const filterType = filterEnvID.substr(0, 3);
    const envID = filterEnvID.substr(3);

    let query = db('transaction')
      .select({
        month: db.raw(`TO_CHAR("txDate", 'YYYY/MM')`),
        isBudget: 'isBudget',
      })
      .sum({ totalAmt: 'txAmt' })
      .where({ isDuplicate: 0, isVisible: true, 'transaction.user_id': userId })
      .groupBy('month', 'isBudget')
      .orderBy('month');

    // PostgreSQL specific
    query = query.andWhereRaw(`?::date - "txDate" < ?`, [
        find_date,
        365 * filterTimeFrameID,
      ])
      .andWhereRaw(`?::date - "txDate" > 0`, [find_date]);
    
    if (filterType === 'env' && parseInt(envID) > -2) {
      query = query.andWhere({ 'envelopeID': envID });
    }

    if (filterType === 'env' && parseInt(envID) === -2) {
      query = query
        .leftJoin('envelope', function () {
          this
            .on('envelope.id', '=', 'transaction.envelopeID')
            .andOn('envelope.user_id', '=', db.raw(`?`, [userId]));
        })
        .leftJoin('category', function () {
          this
            .on('category.id', '=', 'envelope.categoryID')
            .andOn('category.user_id', '=', db.raw(`?`, [userId]));
        })
        .andWhereNot({ category: 'Income' });
    }

    if (filterType === 'cat') {
      query = query
        .leftJoin('envelope', function () {
          this
            .on('envelope.id', '=', 'transaction.envelopeID')
            .andOn('envelope.user_id', '=', db.raw(`?`, [userId]));
        })
        .leftJoin('category', function () {
          this
            .on('category.id', '=', 'envelope.categoryID')
            .andOn('category.user_id', '=', db.raw(`?`, [userId]));
        })
        .andWhere({ categoryID: envID });
    }

    const data = await query;
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});





app.post('/api/'+channels.IMPORT_OFX, async (req, res) => {
  console.log(channels.IMPORT_OFX);
  
  const { ofxString } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID

  try {
    const userId = await getUserId(auth0Id);

    let accountID = '';
    let accountID_str = '';
    let ver = '';

    // Find the financial institution ID
    const tmpStr = ofxString;
    if (tmpStr.includes('<ACCTID>')) {
      const i = tmpStr.indexOf('<ACCTID>') + 8;
      const j = tmpStr.indexOf('\n', i);
      const k = tmpStr.indexOf('</ACCTID>', i);

      accountID_str = tmpStr
        .substr(i, ((j < k && j !== -1) || k === -1 ? j : k) - i)
        .trim();
    }
    accountID = await lookup_account(userId, accountID_str);

    // What version of OFX is this?
    // Seems like the OFX library only supports 102,
    //  maybe all the 100's.
    const tmpStr2 = ofxString;
    if (tmpStr2.includes('VERSION')) {
      const i = tmpStr.indexOf('VERSION') + 7;
      const j = tmpStr.indexOf('SECURITY', i);
      ver = tmpStr
        .substr(i, j - i)
        .replace(/"/g, '')
        .replace(/:/g, '')
        .replace(/=/g, '')
        .trim();
    }

    if (ver[0] === '1') {
      const ofx = new Ofx(ofxString);
      const trans = await ofx.getBankTransferList();
      //let total_records = trans.length;

      trans.forEach(async (tx, i) => {
        insert_transaction_node(
          accountID,
          tx.TRNAMT,
          tx.DTPOSTED.date,
          tx.NAME,
          tx.FITID
        );
        //event.sender.send(channels.UPLOAD_PROGRESS, (i * 100) / total_records);
      });
    }
    if (ver[0] === '2') {
      const xml = new XMLParser().parse(ofxString);
      const trans = await xml.OFX.CREDITCARDMSGSRSV1.CCSTMTTRNRS.CCSTMTRS
        .BANKTRANLIST.STMTTRN;
      let total_records = trans.length;

      trans.forEach(async (tx, i) => {
        insert_transaction_node(
          accountID,
          tx.TRNAMT,
          tx.DTPOSTED.substr(0, 4) +
            '-' +
            tx.DTPOSTED.substr(4, 2) +
            '-' +
            tx.DTPOSTED.substr(6, 2),
          tx.NAME,
          tx.FITID
        );
        //event.sender.send(channels.UPLOAD_PROGRESS, (i * 100) / total_records);
      });
    }
    //event.sender.send(channels.UPLOAD_PROGRESS, 100);
    res.status(200).send('Imported OFX completed successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/'+channels.IMPORT_CSV, async (req, res) => {
  console.log(channels.IMPORT_CSV);

  const { account_string, ofxString } = req.body;
  const auth0Id = req.auth0Id; // Extracted Auth0 ID
  
  try {
    const userId = await getUserId(auth0Id);

    let accountID = '';
    let totalNodes = 0;

    // Find the financial institution ID
    console.log('Account string: ', account_string);

    const nodes = ofxString.split('\n');

    if (account_string.toLowerCase().startsWith('sofi-')) {
      accountID = await lookup_account(userId, account_string);
      totalNodes = nodes.length;
      for (const [i, tx] of nodes.entries()) {
        if (i > 0 && tx.trim().length > 0) {
          const tx_values = tx.split(',');

          await insert_transaction_node(
            accountID,
            tx_values[3],
            tx_values[0],
            tx_values[1],
            ''
          );
          //event.sender.send(channels.UPLOAD_PROGRESS, (i * 100) / totalNodes);
        }
      }
    }
    if (account_string.toLowerCase() === 'venmo') {
      accountID = await lookup_account(userId, account_string);
      totalNodes = nodes.length;
      for (const [i, tx] of nodes.entries()) {
        if (i > 3 && tx[0] === ',') {
          const tx_values = tx.split(',');

          if (tx_values?.length && tx_values[1]?.length) {
            let refNumber = tx_values[1];
            let txDate = tx_values[2].substr(0, 10);
            let description = tx_values[5];
            let j = 5;
            if (description[0] === '"') {
              while (!tx_values[j].endsWith('"')) {
                j++;
                description += ',' + tx_values[j];
              }
              description = description.replace(/\"/g, '');
            }
            let txFrom = tx_values[j + 1];
            let txTo = tx_values[j + 2];
            let txAmt_str = tx_values[j + 3]
              .replace(/\"/g, '')
              .replace(/\+/g, '')
              .replace(/\$/g, '')
              .replace(/\ /g, '')
              .trim();
            let txAmt = parseFloat(txAmt_str);

            description = (txAmt > 0 ? txFrom : txTo) + ' : ' + description;

            insert_transaction_node(
              accountID,
              txAmt,
              txDate,
              description,
              refNumber
            );
            //event.sender.send(channels.UPLOAD_PROGRESS, (i * 100) / totalNodes);
          }
        }
      }
    }
    if (account_string.toLowerCase() === 'paypal') {
      accountID = await lookup_account(userId, account_string);
      totalNodes = nodes.length;
      for (const [i, tx] of nodes.entries()) {
        if (i > 0) {
          const tx_values = tx.split(',');

          if (tx_values?.length) {
            let j = 0;
            let item_iter = 0;
            let txDate = '';
            let description = '';
            let description2 = '';
            let txAmt = '';
            let refNum = '';
            while (j < tx_values?.length) {
              let item_str = tx_values[j];
              if (item_str[0] === '"') {
                while (j < tx_values?.length - 1 && !item_str.endsWith('"')) {
                  j++;
                  item_str += ',' + tx_values[j];
                }
                item_str = item_str.replace(/\"/g, '');
              }

              switch (item_iter) {
                case 0:
                  txDate = item_str.trim();
                  break;
                case 3:
                  description = item_str.trim();
                  break;
                case 4:
                  description2 = item_str.trim();
                  break;
                case 7:
                  txAmt = item_str.trim().replace(/,/g, '');
                  break;
                case 12:
                  refNum = item_str.trim();
                  break;
                default:
              }

              j++;
              item_iter++;
            }

            if (!description?.length && description2?.length) {
              description = description2;
            }

            await insert_transaction_node(
              accountID,
              txAmt,
              txDate,
              description,
              refNum
            );
            //event.sender.send(channels.UPLOAD_PROGRESS, (i * 100) / totalNodes);
          }
        }
      }
    }
    if (account_string.toLowerCase() === 'mint') {
      const accountArr = [];
      const envelopeArr = [];
      const uncategorizedID = await lookup_uncategorized(userId);

      totalNodes = nodes.length;
      for (const [i, tx] of nodes.entries()) {
        if (tx?.length) {
          const tx_values = tx.split(',');

          if (tx_values?.length) {
            // Date
            let txDate = dayjs(
              new Date(tx_values[0].replace(/\"/g, '').trim())
            ).format('YYYY-MM-DD');

            if (txDate !== 'Invalid date') {
              // Description
              let j = 1;
              let description = tx_values[j];
              if (description?.startsWith('"')) {
                while (!tx_values[j]?.endsWith('"')) {
                  j++;
                  description += ',' + tx_values[j];
                }
                description = description.replace(/\"/g, '');
              }

              // Original Description
              // We don't do anything with this, but need to account
              // for commas.
              j += 1;
              if (tx_values[j]?.startsWith('"')) {
                while (!tx_values[j]?.endsWith('"')) {
                  j++;
                }
              }

              // Amount
              j += 1;
              let txAmt = tx_values[j];
              if (txAmt?.startsWith('"')) {
                while (!tx_values[j]?.endsWith('"')) {
                  j++;
                  txAmt += tx_values[j];
                }
                txAmt = parseFloat(txAmt.replace(/\"/g, ''));
              }

              // Transaction type (debit or credit)
              j += 1;
              if (tx_values[j] && tx_values[j].replace(/\"/g, '') === 'debit') {
                txAmt = txAmt * -1;
              }

              // Category/envelope
              j += 1;
              let envelope_str = tx_values[j];
              if (envelope_str?.startsWith('"')) {
                while (!tx_values[j]?.endsWith('"')) {
                  j++;
                  envelope_str += ',' + tx_values[j];
                }
                envelope_str = envelope_str.replace(/\"/g, '').trim();
              }
              let envelopeID = '';
              if (envelopeArr?.length) {
                const found = envelopeArr.find((e) => e.name === envelope_str);
                if (found) {
                  envelopeID = found.id;
                } else {
                  envelopeID = await lookup_envelope(
                    userId, envelope_str, uncategorizedID
                  );
                  envelopeArr.push({ name: envelope_str, id: envelopeID });
                }
              } else {
                envelopeID = await lookup_envelope(
                  userId, envelope_str, uncategorizedID
                );
                envelopeArr.push({ name: envelope_str, id: envelopeID });
              }

              // Account
              j += 1;
              let account_str = tx_values[j];
              if (account_str?.startsWith('"')) {
                while (!tx_values[j]?.endsWith('"')) {
                  j++;
                  account_str += ',' + tx_values[j];
                }
                account_str = account_str.replace(/\"/g, '').trim();
              }
              let accountID = '';
              if (accountArr?.length) {
                const found = accountArr.find((e) => e.name === account_str);
                if (found) {
                  accountID = found.id;
                } else {
                  accountID = await lookup_account(userId, account_str);
                  accountArr.push({ name: account_str, id: accountID });
                }
              } else {
                accountID = await lookup_account(userId, account_str);
                accountArr.push({ name: account_str, id: accountID });
              }

              await basic_insert_transaction_node(
                userId,
                accountID,
                txAmt,
                txDate,
                description,
                '',
                envelopeID
              );
            }
            //event.sender.send(channels.UPLOAD_PROGRESS, (i * 100) / totalNodes);
          }
        }
      }
    }
    if (account_string.toLowerCase() === 'mint tab') {
      const accountArr = [];

      for (const [i, tx] of nodes.entries()) {
        const tx_values = tx.trim().split('\t');

        if (tx?.length && tx_values?.length) {
          let envID = tx_values[0].trim();
          let txAmt = tx_values[1].trim();
          let txDate = tx_values[2].trim();
          let description = tx_values[3].trim();
          let account_str = tx_values[4].trim();

          let accountID = '';
          if (accountArr?.length) {
            const found = accountArr.find((e) => e.name === account_str);
            if (found) {
              accountID = found.id;
            } else {
              accountID = await lookup_account(userId, account_str);
              accountArr.push({ name: account_str, id: accountID });
            }
          } else {
            accountID = await lookup_account(userId, account_str);
            accountArr.push({ name: account_str, id: accountID });
          }

          await basic_insert_transaction_node(
            userId,
            accountID,
            txAmt,
            txDate,
            description,
            '',
            envID
          );
        }
      }
      console.log('');
    }
    //event.sender.send(channels.UPLOAD_PROGRESS, 100);
    res.status(200).send('Imported CSV completed successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});



// Helper functions used only by the server

async function set_or_update_budget_item(userId, newEnvelopeID, newtxDate, newtxAmt) {
  try {
    await db.transaction(async (trx) => {
      const rows = await trx('transaction')
        .select('id', 'txAmt')
        .where({ envelopeID: newEnvelopeID, txDate: newtxDate, isBudget: 1, user_id: userId });
  
      if (rows.length === 0) {
        // no matching records found
        await trx('transaction')
          .insert({
            envelopeID: newEnvelopeID,
            txDate: newtxDate,
            isBudget: 1,
            txAmt: newtxAmt,
            isDuplicate: 0,
            isVisible: true,
            user_id: userId,
          });
        
        await trx('envelope')
          .where({ id: newEnvelopeID, user_id: userId })
          .update({
            balance: db.raw('balance + ?', [newtxAmt])
          });
          
      } else {
        // Already exist
        const oldTxAmt = rows[0].txAmt;

        await trx('envelope')
          .where({ id: newEnvelopeID, user_id: userId })
          .update({
            balance: db.raw('balance + ?', [newtxAmt - oldTxAmt])
          });

        await trx('transaction')
          .where({ id: rows[0].id, user_id: userId })
          .update({ txAmt: newtxAmt });

        console.log('Updated budget amt.');
      }
    });
    console.log('Budget item set or updated successfully');
  } catch (err) {
    console.error('Error setting or updating budget item:', err);
  }
}

async function update_tx_env(userId, txID, envID) {
  try {
    await db.transaction(async (trx) => {
      const rows = await trx('transaction')
        .select('id', 'txAmt', 'envelopeID')
        .where({ id: txID, user_id: userId });

      if (rows.length > 0) {
        const { envelopeID, txAmt } = rows[0];

        if (envelopeID > 0) {
          await trx('envelope')
          .where({ id: envelopeID, user_id: userId })
          .update({
            balance: db.raw('"balance" - ?', [txAmt])
          });
        }

        await trx('envelope')
        .where({ id: envID, user_id: userId })
        .update({
          balance: db.raw('"balance" + ?', [txAmt])
        });

        await trx('transaction')
          .where({ id: txID, user_id: userId })
          .update({ envelopeID: envID });
  
        console.log('Updated transaction envelope successfully.');
      } else {
        console.log('Transaction not found.');
      }
    });
  } catch (err) {
    console.error('Error changing transaction envelope:', err);
  }
}

async function adjust_balance(userId, txID, add_or_remove) {
  try {
    await db.transaction(async (trx) => {
      const rows = trx('transaction')
        .select('envelopeID', 'txAmt')
        .where({ id: txID, user_id: userId });

      if (rows.length > 0) {
        const { envelopeID, txAmt } = rows[0];

        await update_env_balance(
          trx, userId, envelopeID,
          add_or_remove === 'add' ? txAmt : -1 * txAmt
        );
      }
    });
  } catch (err) {
    console.error('Error adjusting the balance: ', err);
  }
}

async function lookup_account(userId, account) {
  // Initialize accountID to -1 to indicate no account found
  let accountID = -1;

  // Early return if account is empty or undefined
  if (!account?.length) {
    console.log('No account provided');
    return accountID;
  }
  
  try {
    await db.transaction(async (trx) => {
      // Check if the account already exists
      const data = await trx('account')
        .select('id', 'account', 'refNumber')
        .orderBy('account')
        .where({ refNumber: account, user_id: userId });

      if (data?.length) {
        // If the account exists, use the existing ID
        accountID = data[0].id;
        console.log('Account found: ', accountID);
      } else {
        // If the account does not exist, insert a new one
        const result = await trx('account')
          .insert({
            account: 'New Account',
            refNumber: account,
            isActive: true,
            user_id: userId,
          })
          .returning('id');

        if (result?.length) {
          accountID = result[0];
          console.log('New account created: ', accountID);
        }
      }
    });
  } catch (err) {
    console.error('Error looking up or creating account:', err);
  }

  return accountID;
}

async function lookup_plaid_account(userId, account) {
  console.log("lookup_plaid_account");

  // Initialize accountID to -1 to indicate no account found
  let accountID = -1;

  // Early return if account is empty or undefined
  if (!account?.length) {
    console.log('No account provided');
    return accountID;
  }

  // Lookup if we've already use this one
  try {
    await db.transaction(async (trx) => {
      // Check if the account already exists
      const data = await trx('account')
        .select('id', 'account', 'refNumber')
        .orderBy('account')
        .where({ plaid_id: account, user_id: userId });
      
        if (data?.length) {
          // If the account exists, use the existing ID
          accountID = data[0].id;
          console.log('Account found: ', accountID);
        } else {
          
          // If the account does not exist, insert a new one
          const result = await trx('account')
            .insert({
              account: 'New Account',
              refNumber: account,
              plaid_id: account,
              isActive: true,
              user_id: userId,
            })
            .returning('id');

          if (result?.length) {
            accountID = result[0];
            console.log('New account created: ', accountID);
          }
        }
    });
  } catch (err) {
    console.error('Error looking up or creating plaid account:', err);
  }

  return accountID;
}

async function lookup_envelope(userId, envelope, defaultCategoryID) {
  // Initialize envelopeID to -1 to indicate no envelope found
  let envelopeID = -1;

  // Early return if envelope is empty or undefined
  if (!envelope?.length) {
    console.log('No envelope provided');
    return envelopeID;
  }

  // Lookup if we've already use this one
  try {
    await db.transaction(async (trx) => {
      // Check if the account already exists
      const data = await trx('envelope')
        .select('id', 'envelope')
        .orderBy('id')
        .where({ envelope: envelope, user_id: userId });

        if (data?.length) {
          // If the envelope exists, use the existing ID
          envelopeID = data[0].id;
          console.log('Envelope found: ', envelopeID);
        } else {
          // If the account does not exist, insert a new one
          const result = await trx('envelope')
            .insert({
              envelope: envelope,
              categoryID: defaultCategoryID,
              balance: 0,
              isActive: true,
              user_id: userId,
            })
            .returning('id');

          if (result?.length) {
            envelopeID = result[0];
            console.log('New envelope created: ', envelopeID);
          }
        }
      });
    } catch (err) {
      console.error('Error looking up or creating envelope:', err);
    }
  
    return envelopeID;
}

async function lookup_uncategorized(userId) {
  try {
    const rows = await db('category')
      .select('id')
      .where({ category: 'Uncategorized', user_id: userId });
    
    if (rows?.length > 0) {
      console.log('Uncategorized category ID is: ', rows[0].id);
      return rows[0].id;
    } else {
      console.log('Uncategorized category not found.');
      return -1;
    }
  } catch (err) {
    console.error('Error looking up uncategorized category ID:', err);
    return -1;
  }
}

async function lookup_keyword(userId, accountID, description, txDate) {
  // Initialize envelopeID to -1 to indicate no envelope found
  let envID = -1;
  
  // Early return if description is empty or undefined
  if (!description?.length) {
    console.log('No description provided');
    return envID;
  }

  try {
    await db.transaction(async (trx) => {
      let query = trx('keyword')
        .select('id', 'envelopeID')
        .whereRaw(`? LIKE "description"`, [description])
        .andWhere({ user_id: userId });

      query = query.andWhere(function () {
        this.where('account', 'All')
          .orWhere({ 
            account: trx('account')
              .select('account')
              .where({ id: accountID, user_id: userId }),
          });
      });

      const data = await query;
      if (data?.length) {
        const { id, envelopeID } = data[0];
        envID = envelopeID;

        // Let's record that we used this keyword
        await trx('keyword')
          .update({ last_used: txDate })
          .where({ id: id, user_id: userId });
      }
    });
  
  } catch (err) {
    console.error('Error looking up keyword:', err);
  }

  return envID;
}

async function lookup_if_duplicate(
  userId, 
  accountID,
  refNumber,
  txDate,
  txAmt,
  description
) {
  let isDuplicate = 0;

  // Early return if refNumber is empty or undefined
  if (!refNumber?.length && !description?.length) {
    console.log('No refNumber or description provided');
    return isDuplicate;
  }

  try {
    let query = db('transaction')
      .select('id')
      .where({ user_id: userId, accountID: accountID });

    // PostgreSQL specific
    query = query.andWhereRaw(`?::date - "txDate" = 0`, [txDate]);
    
    if (refNumber?.length) {
      query = query.andWhere({ refNumber: refNumber });
    } else {
      query = query.andWhere({ txAmt: txAmt, description: description });
    }
    
    const data = await query;
    if (data?.length) {
      isDuplicate = 1;
    }
    
  } catch (err) {
    console.error('Error checking for duplicate transaction:', err);
  }

  return isDuplicate;
}

async function update_env_balance(trx, userId, envID, amt) {
  try {
    await trx('envelope')
    .where({ id: envID, user_id: userId })
    .update({
      balance: db.raw('balance + ?', [amt])
    });
  } catch (err) {
    console.error('Error updating envelope balance: ', err);
  }
}

async function update_transaction_id(
  userId,
  access_token,
  old_transaction_id, 
  new_transaction_id,
  txAmt,
  txDate,
  description
) {
  try {
    let my_txDate = dayjs(new Date(txDate + 'T00:00:00')).format('YYYY-MM-DD');

    await db.transaction(async (trx) => {
      const rows = trx('plaid_account')
        .select('transaction.id as id')
        .join('account', function() {
          this.on('account.plaid_id', '=', 'plaid_account.account_id')
              .andOn('account.user_id', '=', db.raw('?', [userId]));
        })
        .join('transaction', function() {
          this.on('transaction.accountID', '=', 'account.id')
              .andOn('transaction.user_id', '=', db.raw('?', [userId]));
        })
        .where({ 
          access_token: access_token, 
          'transaction.refNumber': old_transaction_id, 
          'plaid_account.user_id': userId
        });
      
      if (rows?.length) {
        const { id } = rows[0];

        console.log(`Updating transaction id: ${id} -> ${new_transaction_id}`);
        await trx('transaction')
          .where({ id: id })
          .update({ 
            refNumber: new_transaction_id,
            txAmt: txAmt,
            txDate: my_txDate,
            description: description
          });
        console.log('Successully updated former pending transaction refNumber. ');
                
      } else {
        console.log(`We were supposed to be updating a transaction's refNumber, but we couldn't find refNumber: ${old_transaction_id} and access_token: ${access_token}`);
      }
    });
  } catch (err) {
    console.log('Error trying to update transaction id: ', err)
  }
  process.stdout.write('.');
};

async function basic_insert_transaction_node(
  userId,
  accountID,
  txAmt,
  txDate,
  description,
  refNumber,
  envID
) {
  let my_txDate = dayjs(new Date(txDate + 'T00:00:00')).format('YYYY-MM-DD');

  // Prepare the data node
  const myNode = {
    envelopeID: envID,
    txAmt: txAmt,
    txDate: my_txDate,
    description: description,
    refNumber: refNumber,
    isBudget: 0,
    origTxID: 0,
    isDuplicate: 0,
    isSplit: 0,
    accountID: accountID,
    isVisible: true,
    user_id: userId,
  };

  await db.transaction(async (trx) => {
    // Insert the node
    await trx('transaction').insert(myNode);

    // Update the envelope balance
    if (envID !== -1) {
      await update_env_balance(trx, userId, envID, txAmt);
    }
  });

  process.stdout.write('.');
}

async function remove_transaction(userId, txID) {
  try {
    await db.transaction(async (trx) => {
      const data = await trx('transaction')
        .select('envelopeID', 'txAmt', 'isDuplicate', 'isVisible')
        .where({ id: txID, user_id: userId });
      
      if (data?.length) {
        const { envelopeID, txAmt, isDuplicate, isVisible } = data[0];

        if (isVisible && !isDuplicate) {
          await update_env_balance(trx, userId, envelopeID, -1 * txAmt);
        }

        await trx('transaction')
          .delete()
          .where({ id: txID, user_id: userId });
      }
    });
  } catch (err) {
    console.error('Error removing transaction:', err);
  }
}

async function basic_remove_transaction_node(userId, access_token, refNumber) {
  try {
    await db.transaction(async (trx) => {
      const rows = await trx('plaid_account')
        .select(
          'transaction.id as id',
          'transaction.envelopeID as envelopeID',
          'transaction.txAmt as txAmt',
        )
        .join('account', function() {
          this.on('account.plaid_id', '=', 'plaid_account.account_id')
              .andOn('account.user_id', '=', db.raw('?', [userId]));
        })
        .join('transaction', function() {
          this.on('transaction.accountID', '=', 'account.id')
              .andOn('transaction.user_id', '=', db.raw('?', [userId]));
        })
        .where({ 
          access_token: access_token, 
          'plaid_account.user_id': userId,
          'transaction.refNumber': refNumber
        });

      if (rows?.length) {
        const { id, envelopeID, txAmt } = rows[0];

        console.log(
          `Deleting transaction id: ${id}, amt: ${txAmt}, envID: ${envelopeID}`
        );
        await trx('transaction')
          .delete()
          .where({ id: id, user_id: userId });
        await update_env_balance(trx, userId, envelopeID, -1 * txAmt);
      } else {
        console.log(
          `No TX to delete, looking for refNumber: ${refNumber} and access_token: ${access_token}`
        );
      }
    });
  } catch (err) {
    console.error('Error removing transaction node: ', err);
  }
  process.stdout.write('.');
}

async function insert_transaction_node(
  userId, 
  accountID,
  txAmt,
  txDate,
  description,
  refNumber
) {
  let isDuplicate = 0;

  let my_txDate = dayjs(new Date(txDate + 'T00:00:00')).format('YYYY-MM-DD');
  if (my_txDate === 'Invalid Date') {
    return;
  }
  if (txAmt === null || txAmt === '') {
    return;
  }

  // Check if this matches a keyword
  let envID = await lookup_keyword(userId, accountID, description, my_txDate);

  // Check if this is a duplicate
  isDuplicate = await lookup_if_duplicate(
    userId,
    accountID,
    refNumber,
    my_txDate,
    txAmt,
    description
  );

  // Prepare the data node
  const myNode = {
    envelopeID: envID,
    txAmt: txAmt,
    txDate: my_txDate,
    description: description,
    refNumber: refNumber,
    isBudget: 0,
    origTxID: 0,
    isDuplicate: isDuplicate,
    isSplit: 0,
    accountID: accountID,
    isVisible: true,
    user_id: userId,
  };

  try {
    await db.transaction(async (trx) => {
      // Insert the node
      await trx('transaction').insert(myNode);

      // Update the envelope balance
      if (envID !== -1 && isDuplicate !== 1) {
        await update_env_balance(trx, userId, envID, txAmt);
      }
    });
  } catch (err) {
    console.error('Error inserting transaction node: ', err);
  }
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
