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

app.post('/api/'+channels.PLAID_REMOVE_LOGIN, async (req, res) => {
  const { access_token } = req.body;
  console.log('Removing plaid account login ');

  await remove_plaid_login(access_token);

  await db.transaction(async (trx) => {
    // Get the account info
    await trx
      .select('account_id')
      .from('plaid_account')
      .where({ access_token: access_token })
      .then(async (data) => {
        for (const item of data) {
          // Remove the plaid account from the database
          remove_plaid_account(item.account_id);

          // If there was a regular account, disconnect it from a plaid account
          remove_plaid_account_link(item.account_id);
        }
      });
  });
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

async function remove_plaid_account(account_id) {
  await db('plaid_account').delete().where({ account_id: account_id });
}

async function remove_plaid_account_link(account_id) {
  await db('account')
    .update({ plaid_id: null })
    .where({ plaid_id: account_id });
}

app.post('/api/'+channels.PLAID_GET_TRANSACTIONS, async (req, res) => {
  const { access_token, cursor } = req.body;
  console.log('Try getting plaid account transactions ');

  let added = [];
  let modified = [];
  let removed = [];
  let hasMore = true;

  while (hasMore) {
    console.log('Making the call ');
    let response = null;
    try {
      response = await client.transactionsSync({
        access_token: access_token,
        cursor: cursor,
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
    cursor = data.next_cursor;
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
        accountID = await lookup_plaid_account(account_str);
        accountArr.push({ name: account_str, id: accountID });
      }
    } else {
      accountID = await lookup_plaid_account(account_str);
      accountArr.push({ name: account_str, id: accountID });
    }

    let envID = await lookup_keyword(accountID, a.name, a.date);

    // Check if this is a duplicate
    let isDuplicate = await lookup_if_duplicate(
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
        access_token,
        matchingRemoved.transaction_id, 
        a.transaction_id,
        -1 * a.amount,
        a.date,
        a.name
      );
    } else if (isDuplicate !== 1) {
      await basic_insert_transaction_node(
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
        accountID = await lookup_plaid_account(account_str);
        accountArr.push({ name: account_str, id: accountID });
      }
    } else {
      accountID = await lookup_plaid_account(account_str);
      accountArr.push({ name: account_str, id: accountID });
    }

    let envID = await lookup_keyword(accountID, m.name, m.date);

    // Rather than modify it, just remove the old and the new
    await basic_remove_transaction_node(access_token, m.transaction_id);

    await basic_insert_transaction_node(
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
    .where('access_token', access_token)
    .update('cursor', cursor)
    .catch((err) => console.log('Error: ' + err));

  //event.sender.send(channels.UPLOAD_PROGRESS, 100);
});

// TODO: this can probably be consolidated with the above function
//       pulling out common tasks to a helper function.
app.post('/api/'+channels.PLAID_FORCE_TRANSACTIONS, async (req, res) => {
  const { access_token, start_date, end_date } = req.body;
  console.log('Try getting plaid account transactions ');

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
        accountID = await lookup_plaid_account(account_str);
        accountArr.push({ name: account_str, id: accountID });
      }
    } else {
      accountID = await lookup_plaid_account(account_str);
      accountArr.push({ name: account_str, id: accountID });
    }

    let envID = await lookup_keyword(accountID, a.name, a.date);

    // Check if this is a duplicate
    let isDuplicate = await lookup_if_duplicate(
      accountID,
      a.transaction_id,
      a.date,
      -1 * a.amount,
      a.name
    );

    if (isDuplicate !== 1) {
      await basic_insert_transaction_node(
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
  const { new_value, filtered_nodes } = req.body;
    console.log(channels.UPDATE_TX_ENV_LIST);
    for (let t of filtered_nodes) {
      await update_tx_env(t.txID, new_value);
    }
  }
);

app.post('/api/'+channels.DEL_TX_LIST, async (req, res) => {
  const { del_tx_list } = req.body;
  console.log(channels.DEL_TX_LIST);
  if (db) {
    console.log(del_tx_list);
    for (let t of del_tx_list) {
      if (t.isChecked) {
        console.log('deleting: ' + t.txID);
        await remove_transaction(t.txID);
      }
    }
  }
  console.log('Sending we are done.');
});

app.post('/api/'+channels.SPLIT_TX, async (req, res) => {
  const { txID, split_tx_list } = req.body;
  console.log(channels.SPLIT_TX, ' num split: ', split_tx_list?.length);
  if (db) {
    // Lets use a transaction for this
    await db
      .transaction(async (trx) => {
        // Get some info on the original
        await trx
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
          .then(async (data) => {
            if (data?.length) {
              // Delete the original
              await trx('transaction')
                .delete()
                .where({ id: txID })
                .then(async () => {
                  // Update the original budget
                  await trx
                    .raw(
                      `UPDATE "envelope" SET balance = balance - ` +
                        data[0].txAmt +
                        ` WHERE id = ` +
                        data[0].envelopeID
                    )
                    .then(async () => {
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
                          })
                          .then(async () => {
                            // Adjust that envelope balance
                            await trx.raw(
                              `UPDATE "envelope" SET balance = balance + ` +
                                item.txAmt +
                                ` WHERE id = ` +
                                item.txEnvID
                            );
                          });
                      }
                    });
                });
            }
          })
          .then(trx.commit);
      })
      .catch(function (error) {
        console.error(error);
      });
  }
});

app.post('/api/'+channels.ADD_ENVELOPE, async (req, res) => {
  const { categoryID } = req.body;
  console.log(channels.ADD_ENVELOPE, categoryID);

  await db('envelope')
    .insert({
      categoryID: categoryID,
      envelope: 'New Envelope',
      balance: 0,
      isActive: dbPath === 'cloud' ? true : 1,
    })
    .then()
    .catch((err) => {
      console.log('Error: ' + err);
    });
});

app.post('/api/'+channels.ADD_CATEGORY, async (req, res) => {
  const { name } = req.body;
  console.log(channels.ADD_CATEGORY, name);

  await db('category')
    .insert({ category: name })
    .then()
    .catch((err) => {
      console.log('Error: ' + err);
    });
});


// Helper functions used only by the server

async function set_or_update_budget_item(newEnvelopeID, newtxDate, newtxAmt) {
  return await db('transaction')
    .select('id', 'txAmt')
    .where('envelopeID', newEnvelopeID)
    .andWhere('txDate', newtxDate)
    .andWhere('isBudget', 1)
    .then(async function (rows) {
      if (rows.length === 0) {
        // no matching records found
        return await db('transaction')
          .insert({
            envelopeID: newEnvelopeID,
            txDate: newtxDate,
            isBudget: 1,
            txAmt: newtxAmt,
            isDuplicate: 0,
            isVisible: dbPath === 'cloud' ? true : 1,
          })
          .then(async () => {
            await db.raw(
              `UPDATE "envelope" SET balance = balance + ` +
                newtxAmt +
                ` WHERE id = ` +
                newEnvelopeID
            );
          })
          .catch((err) => {
            console.log('Error inserting budget: ' + err);
          });
      } else {
        // Already exist
        await db
          .raw(
            `UPDATE "envelope" SET balance = balance + ` +
              (newtxAmt - rows[0].txAmt) +
              ` WHERE id = ` +
              newEnvelopeID
          )
          .then(async () => {
            await db('transaction')
              .update({ txAmt: newtxAmt })
              .where('id', rows[0].id)
              .then(() => {
                console.log('Updated budget amt.');
              })
              .catch((err) => {
                console.log('Error updating budget: ' + err);
              });
          })
          .catch((err) => {
            console.log('Error updating budget: ' + err);
          });
      }
    })
    .catch((err) => {
      console.log('Error checking if budget exists: ' + err);
    });
}

async function update_tx_env(txID, envID) {
  await db
    .select('id', 'txAmt', 'envelopeID')
    .from('transaction')
    .where({ id: txID })
    .then(async (rows) => {
      if (rows?.length) {
        if (rows[0].envelopeID > 0) {
          await db
            .raw(
              `update 'envelope' set balance = balance - ` +
                rows[0].txAmt +
                ` where id = ` +
                rows[0].envelopeID
            )
            .then()
            .catch((err) => {
              console.log('Error: ' + err);
            });
        }

        await db
          .raw(
            `update 'envelope' set balance = balance + ` +
              rows[0].txAmt +
              ` where id = ` +
              envID
          )
          .then()
          .catch((err) => {
            console.log('Error: ' + err);
          });
      }
    })
    .catch((err) => {
      console.log('Error: ' + err);
    });

  await db('transaction')
    .where({ id: txID })
    .update({ envelopeID: envID })
    .then(() => {
      console.log('Changed tx envelope to: ' + envID);
    })
    .catch((err) => {
      console.log('Error: ' + err);
    });
}

async function adjust_balance(txID, add_or_remove) {
  await db
    .select('envelopeID', 'txAmt')
    .from('transaction')
    .where({ id: txID })
    .then(async (data) => {
      if (data?.length) {
        await update_env_balance(
          data[0].envelopeID,
          add_or_remove === 'add' ? data[0].txAmt : -1 * data[0].txAmt
        );
      }
    });
}

async function lookup_account(account) {
  let accountID = -1;

  // Lookup if we've already use this one
  if (account?.length) {
    await db
      .select('id', 'account', 'refNumber')
      .from('account')
      .orderBy('account')
      .where({ refNumber: account })
      .then(async (data) => {
        if (data?.length) {
          // If we have, use this ID
          accountID = data[0].id;
        } else {
          // If we haven't, lets store this one
          await db('account')
            .insert({ 
              account: 'New Account', 
              refNumber: account, 
              isActive: dbPath === 'cloud' ? true : 1 })
            .then((result) => {
              if (result?.length) {
                accountID = result[0];
              }
            })
            .catch((err) => {
              console.log('Error: ' + err);
            });
        }
      })
      .catch((err) => console.log(err));
  }

  return accountID;
}

async function lookup_plaid_account(account) {
  let accountID = -1;

  // Lookup if we've already use this one
  if (account?.length) {
    await db
      .select('id', 'account', 'refNumber')
      .from('account')
      .orderBy('account')
      .where({ plaid_id: account })
      .then(async (data) => {
        if (data?.length) {
          // If we have, use this ID
          accountID = data[0].id;
        } else {
          // If we haven't, lets store this one
          await db('account')
            .insert({
              account: 'New Account',
              refNumber: account,
              plaid_id: account,
              isActive: dbPath === 'cloud' ? true : 1,
            })
            .then((result) => {
              if (result?.length) {
                accountID = result[0];
              }
            })
            .catch((err) => {
              console.log('Error: ' + err);
            });
        }
      })
      .catch((err) => console.log(err));
  }

  return accountID;
}

async function lookup_envelope(envelope, defaultCategoryID) {
  let envelopeID = -1;

  // Lookup if we've already use this one
  if (envelope?.length) {
    await db
      .select('id', 'envelope')
      .from('envelope')
      .orderBy('id')
      .where({ envelope: envelope })
      .then(async (data) => {
        if (data?.length) {
          // If we have, use this ID
          envelopeID = data[0].id;
        } else {
          // If we haven't, lets store this one
          await db('envelope')
            .insert({
              envelope: envelope,
              categoryID: defaultCategoryID,
              balance: 0,
              isActive: dbPath === 'cloud' ? true : 1,
            })
            .then((result) => {
              if (result?.length) {
                envelopeID = result[0];
              }
            })
            .catch((err) => {
              console.log('Error: ' + err);
            });
        }
      })
      .catch((err) => console.log(err));
  }

  return envelopeID;
}

async function lookup_uncategorized() {
  let categoryID = -1;

  await db
    .select('id')
    .from('category')
    .where('category', 'Uncategorized')
    .then((rows) => {
      if (rows?.length > 0) {
        console.log('Uncategorized category ID is: ', rows[0].id);
        categoryID = rows[0].id;
      }
    })
    .catch((err) => console.log(err));

  return categoryID;
}

async function lookup_keyword(accountID, description, txDate) {
  let envID = -1;

  if (description?.length) {
    let query = db('keyword')
      .select('id', 'envelopeID')
      .whereRaw(`? LIKE description`, description);

    query = query.andWhere(function () {
      this.where('account', 'All').orWhere({
        account: db('account').select('account').where('id', accountID),
      });
    });

    await query.then((data) => {
      if (data?.length) {
        envID = data[0].envelopeID;

        // Let's record that we used this keyword
        db('keyword')
          .update({ last_used: txDate })
          .where('id', data[0].id)
          .catch((err) => console.log(err));
      }
    });
  }
  return envID;
}

async function lookup_if_duplicate(
  accountID,
  refNumber,
  txDate,
  txAmt,
  description
) {
  let isDuplicate = 0;

  // Check if it is a duplicate?
  if (refNumber?.length) {
    //console.log('Checking by refNumber');

    let query = db('transaction')
      .select('id')
      .andWhereRaw(`accountID = ?`, accountID)
      .andWhereRaw(`refNumber = ?`, refNumber);
      
      if (dbPath === 'cloud') {
        // PostgreSQL
        query = query.andWhereRaw(`?::date - "txDate" = 0`, [txDate]);
      } else {
        // SQLite
        query = query.andWhereRaw(`julianday(?) - julianday(txDate) = 0`, [txDate]);
      }

    await query.then((data) => {
        if (data?.length) {
          isDuplicate = 1;
        }
      });
  } else {
    //console.log('Checking by other stuff');
    let query = db('transaction')
      .select('id')
      .where({ txAmt: txAmt })
      .andWhereRaw(`accountID = ?`, accountID)
      .andWhere({ description: description });
      
      if (dbPath === 'cloud') {
        // PostgreSQL
        query = query.andWhereRaw(`?::date - "txDate" = 0`, [txDate]);
      } else {
        // SQLite
        query = query.andWhereRaw(`julianday(?) - julianday(txDate) = 0`, [txDate]);
      }

    await query.then((data) => {
        if (data?.length) {
          isDuplicate = 1;
        }
      });
  }

  return isDuplicate;
}

async function update_env_balance(envID, amt) {
  await db
    .raw(
      `UPDATE "envelope" SET balance = balance + ` +
        amt +
        ` WHERE id = ` +
        envID
    )
    .then();
}

async function update_transaction_id(
  access_token,
  old_transaction_id, 
  new_transaction_id,
  txAmt,
  txDate,
  description
) {
  let my_txDate = dayjs(new Date(txDate + 'T00:00:00')).format('YYYY-MM-DD');

  await db.select(
    'transaction.id as id'
  )
    .from('plaid_account')
    .join('account', 'account.plaid_id', 'plaid_account.account_id')
    .join('transaction', 'transaction.accountID', 'account.id')
    .where({ access_token: access_token })
    .andWhere('transaction.refNumber', '=', old_transaction_id)
    .then(async (data) => {
      if (data?.length) {
        console.log(
          'Updating transaction id: ',
          data[0].id,
          ' -> ',
          new_transaction_id
        );
        await db('transaction')
        .where({ id: data[0].id })
        .update({ 
          refNumber: new_transaction_id,
          txAmt: txAmt,
          txDate: my_txDate,
          description: description
        })
        .then(() =>
          {
            console.log('Successully updated former pending transaction refNumber. ');
          }
        )
        .catch((err) => {
          console.log('Error: ' + err);
        });
                
      } else {
        console.log(
          'We were supposed to be updating a transactions ref Number, but we couldnt find refNumber: ',
          refNumber,
          ' and access_token: ',
          access_token
        );
      }
    })
    .catch((err) => console.log(err));

  process.stdout.write('.');
  
};

async function basic_insert_transaction_node(
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
    isVisible: dbPath === 'cloud' ? true : 1,
  };

  // Insert the node
  await db('transaction').insert(myNode);

  // Update the envelope balance
  if (envID !== -1) {
    await update_env_balance(envID, txAmt);
  }

  process.stdout.write('.');
}

async function remove_transaction(txID) {
  await db
    .select('id', 'envelopeID', 'txAmt', 'isDuplicate', 'isVisible')
    .from('transaction')
    .where({ id: txID })
    .then(async (data) => {
      if (data?.length) {
        await db('transaction').delete().where({ id: data[0].id });
        if (data[0].isVisible && !data[0].isDuplicate) {
          await update_env_balance(data[0].envelopeID, -1 * data[0].txAmt);
        }
      }
    })
    .catch((err) => console.log(err));
}

async function basic_remove_transaction_node(access_token, refNumber) {
  db.select(
    'transaction.id as id',
    'transaction.envelopeID as envelopeID',
    'transaction.txAmt as txAmt'
  )
    .from('plaid_account')
    .join('account', 'account.plaid_id', 'plaid_account.account_id')
    .join('transaction', 'transaction.accountID', 'account.id')
    .where({ access_token: access_token })
    .andWhere('transaction.refNumber', '=', refNumber)
    .then(async (data) => {
      if (data?.length) {
        console.log(
          'Deleting transaction id: ',
          data[0].id,
          ' amt: ',
          data[0].txAmt,
          ' envID: ',
          data[0].envelopeID
        );
        await db('transaction').delete().where({ id: data[0].id });
        await update_env_balance(data[0].envelopeID, -1 * data[0].txAmt);
      } else {
        console.log(
          'No TX to delete, looking for refNumber: ',
          refNumber,
          ' and access_token: ',
          access_token
        );
      }
    })
    .catch((err) => console.log(err));

  process.stdout.write('.');
}

//console.log(channels.IMPORT_OFX, ofxString);
async function insert_transaction_node(
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
  let envID = await lookup_keyword(accountID, description, my_txDate);

  // Check if this is a duplicate
  isDuplicate = await lookup_if_duplicate(
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
    isVisible: dbPath === 'cloud' ? true : 1,
  };

  // Insert the node
  await db('transaction').insert(myNode);

  // Update the envelope balance
  if (envID !== -1 && isDuplicate !== 1) {
    await update_env_balance(envID, txAmt);
  }
}

const get_db_ver = async () => {
  //console.log('get_db_ver');
  let ver = null;
  if (db) {
    await db('version')
      .select('version')
      .then((data) => {
        ver = data[0].version;
      })
      .catch((err) => {
        console.log('Error getting DB version.');
      });
  }
  //console.log('returning version: ', ver);
  return ver;
};


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
