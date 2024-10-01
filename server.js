const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const fs = require('fs');
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
    client_user_id: '2',
  },
  client_name: 'Savvy Budget',
  products: PLAID_PRODUCTS,
  country_codes: PLAID_COUNTRY_CODES,
  language: 'en',
  redirect_uri: 'https://localhost:3000',
};

// This should be on the server only
const plaid_setup_client = async () => {
  console.log("plaid_setup_client ENTER");
  
  // This should correspond to a unique id for the current user.
  configs.user.client_user_id = '2';

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
  if (PLAID_CLIENT_ID?.length) {
    try {
      
      await plaid_setup_client();
      await plaid_get_link_token();
      
      console.log("PLAID_GET_TOKEN returning:");
      console.log({ link_token: plaid_link_token, expiration: plaid_link_token_exp });
      
      res.json({ link_token: plaid_link_token, expiration: plaid_link_token_exp });
    } catch (error) {
      console.log(error);
      // handle error
      console.log('Error: ', error.response.data.error_message);

      res.json(error.response.data);
    }
  } else {
    console.log("PLAID_CLIENT_ID is null, or length is 0?: " + PLAID_CLIENT_ID);
    res.json(null);
  }
});

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
          isActive: true,
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
    .update('cursor', cursor_iter)
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
                      `UPDATE "envelope" SET "balance" = "balance" - ` +
                        data[0].txAmt +
                        ` WHERE "id" = ` +
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
                              `UPDATE "envelope" SET "balance" = "balance" + ` +
                                item.txAmt +
                                ` WHERE "id" = ` +
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
      isActive: true,
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

app.post('/api/'+channels.DEL_CATEGORY, async (req, res) => {
  const { id } = req.body;
  console.log(channels.DEL_CATEGORY, id);

  // Move any sub-envelopes to Uncategorized
  const uncategorizedID = await lookup_uncategorized();

  await db('envelope')
    .where('categoryID', id)
    .update('categoryID', uncategorizedID)
    .then(async () => {
      await db('category')
        .where({ id: id })
        .del()
        .then()
        .catch((err) => console.log('Error: ' + err));
    })
    .catch((err) => console.log('Error: ' + err));
});

app.post('/api/'+channels.DEL_ENVELOPE, async (req, res) => {
  const { id } = req.body;
  console.log(channels.DEL_ENVELOPE, id);

  await db('envelope')
    .where({ id: id })
    .delete()
    .then()
    .catch((err) => {
      console.log('Error: ' + err);
    });

  await db('transaction')
    .where({ envelopeID: id })
    .update({ envelopeID: -1 })
    .then()
    .catch((err) => {
      console.log('Error: ' + err);
    });

  await db('keyword')
    .where({ envelopeID: id })
    .delete()
    .then()
    .catch((err) => {
      console.log('Error: ' + err);
    });
});

app.post('/api/'+channels.HIDE_ENVELOPE, async (req, res) => {
  const { id } = req.body;
  console.log(channels.HIDE_ENVELOPE, id);

  await db('envelope')
    .where({ id: id })
    .update({ isActive: false })
    .then()
    .catch((err) => {
      console.log('Error: ' + err);
    });
});

app.post('/api/'+channels.REN_CATEGORY, async (req, res) => {
  const { id, name } = req.body;
  console.log(channels.REN_CATEGORY, id, name);

  await db('category')
    .where({ id: id })
    .update({ category: name })
    .then(() => {
      console.log('Renamed category: ' + name);
    })
    .catch((err) => {
      console.log('Error: ' + err);
    });
});

app.post('/api/'+channels.REN_ENVELOPE, async (req, res) => {
  const { id, name } = req.body;
  console.log(channels.REN_ENVELOPE, id, name);

  db('envelope')
    .where({ id: id })
    .update({ envelope: name })
    .then(() => {
      console.log('Renamed envelope: ' + name);
    })
    .catch((err) => {
      console.log('Error: ' + err);
    });
});

app.post('/api/'+channels.MOV_ENVELOPE, async (req, res) => {
  const { id, newCatID } = req.body;
  console.log(channels.MOV_ENVELOPE, id, newCatID);

  db('envelope')
    .where({ id: id })
    .update({ categoryID: newCatID })
    .then(() => {
      console.log('Moved envelope to: ' + newCatID);
    })
    .catch((err) => {
      console.log('Error: ' + err);
    });
});

app.post('/api/'+channels.COPY_BUDGET, async (req, res) => {
  const { newtxDate, budget_values } = req.body;
  console.log(channels.COPY_BUDGET, newtxDate, budget_values);
  for (let item of budget_values) {
    await set_or_update_budget_item(item.envID, newtxDate, item.value);
  }
});

app.post('/api/'+channels.UPDATE_BUDGET, async (req, res) => {
  const { newEnvelopeID, newtxDate, newtxAmt } = req.body;
  console.log(channels.UPDATE_BUDGET, newEnvelopeID, newtxDate, newtxAmt);
  await set_or_update_budget_item(newEnvelopeID, newtxDate, newtxAmt);
});

app.post('/api/'+channels.UPDATE_BALANCE, async (req, res) => {
  const { id, newAmt } = req.body;
  console.log(channels.UPDATE_BALANCE, id, newAmt);

  db('envelope')
    .update({ balance: newAmt })
    .where({ id: id })
    .then()
    .catch((err) => {
      console.log('Error updating balance: ' + err);
    });
});

app.post('/api/'+channels.MOVE_BALANCE, async (req, res) => {
  const { transferAmt, fromID, toID } = req.body;
  console.log(channels.MOVE_BALANCE, transferAmt, fromID, toID);

  db.raw(
    `update "envelope" set "balance" = "balance" - ` +
      transferAmt +
      ` where "id" = ` +
      fromID
  ).then();

  db.raw(
    `update "envelope" set "balance" = "balance" + ` +
      transferAmt +
      ` where "id" = ` +
      toID
  ).then();
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

app.post('/api/'+channels.GET_BUDGET_ENV, (req, res) => {
  console.log(channels.GET_BUDGET_ENV);
  if (db) {
    db.select(
      'category.id as catID',
      'category.category',
      'envelope.id as envID',
      'envelope.envelope',
      'envelope.balance as currBalance'
    )
      .from('envelope')
      .leftJoin('category', function () {
        this.on('category.id', '=', 'envelope.categoryID');
      })
      .where('envelope.isActive', true)
      .orderBy('category.id')
      .then((data) => {
        res.json(data);
      })
      .catch((err) => console.log(err));
  }
});

app.post('/api/'+channels.GET_PREV_BUDGET, (req, res) => {
  const { find_date } = req.body;
  console.log(channels.GET_PREV_BUDGET);
  db.select('envelopeID', 'txAmt')
    .from('transaction')
    .orderBy('envelopeID')
    .where({ isBudget: 1 })
    .andWhere({ txDate: find_date })
    .then((data) => {
      res.json(data);
    })
    .catch((err) => console.log(err));
});

app.post('/api/'+channels.GET_CUR_BUDGET, (req, res) => {
  const { find_date } = req.body;
  console.log(channels.GET_CUR_BUDGET, find_date);
  db.select('envelopeID', 'txAmt')
    .from('transaction')
    .orderBy('envelopeID')
    .where({ isBudget: 1 })
    .andWhere({ txDate: find_date })
    .then((data) => {
      res.json(data);
    })
    .catch((err) => console.log(err));
});

app.post('/api/'+channels.GET_PREV_ACTUAL, (req, res) => {
  const { find_date } = req.body;
  console.log(channels.GET_PREV_ACTUAL);

  const month = dayjs(new Date(find_date)).format('MM');
  const year = dayjs(new Date(find_date)).format('YYYY');

  let query = db.select('envelopeID')
    .sum({ totalAmt: 'txAmt' })
    .from('transaction')
    .orderBy('envelopeID')
    .where({ isBudget: 0 })
    .andWhere({ isDuplicate: 0 })
    .andWhere({ isVisible: true })
    .groupBy('envelopeID');
    
  // PostgreSQL specific
  query = query
    .andWhereRaw(`EXTRACT(MONTH FROM "txDate") = ?`, [month])
    .andWhereRaw(`EXTRACT(YEAR FROM "txDate") = ?`, [year]);
  
  query.then((data) => {
    res.json(data);
  }).catch((err) => console.log(err));
});

app.post('/api/'+channels.GET_CUR_ACTUAL, (req, res) => {
  const { find_date } = req.body;
  console.log(channels.GET_CUR_ACTUAL);

  const month = dayjs(new Date(find_date)).format('MM');
  const year = dayjs(new Date(find_date)).format('YYYY');

  let query = db.select('envelopeID')
    .sum({ totalAmt: 'txAmt' })
    .from('transaction')
    .where({ isBudget: 0 })
    .andWhere({ isDuplicate: 0 })
    .andWhere({ isVisible: true })
    .groupBy('envelopeID')
    .orderBy('envelopeID');

  // PostgreSQL specific
  query = query
    .andWhereRaw(`EXTRACT(MONTH FROM "txDate") = ?`, [month])
    .andWhereRaw(`EXTRACT(YEAR FROM "txDate") = ?`, [year]);
  
  query.then((data) => {
    res.json(data);
  }).catch((err) => console.log(err));
});

app.post('/api/'+channels.GET_CURR_BALANCE, (req, res) => {
  console.log(channels.GET_CURR_BALANCE);

  db.select('id', 'balance')
    .from('envelope')
    .orderBy('id')
    .then((data) => {
      res.json(data);
    })
    .catch((err) => console.log(err));
});

app.post('/api/'+channels.GET_MONTHLY_AVG, (req, res) => {
  const { find_date } = req.body;
  console.log(channels.GET_MONTHLY_AVG);

  let query = db.select('envelopeID')
    .sum({ totalAmt: 'txAmt' })
    .min({ firstDate: 'txDate' })
    .from('transaction')
    .orderBy('envelopeID')
    .where({ isBudget: 0 })
    .andWhere({ isDuplicate: 0 })
    .andWhere({ isVisible: true })
    .groupBy('envelopeID');

  // PostgreSQL specific
  query = query.andWhereRaw(`?::date - "txDate" < 365`, [find_date])
    .andWhereRaw(`?::date - "txDate" > 0`, [find_date]);
  
  query.then((data) => {
    res.json(data);
  })
  .catch((err) => console.log(err));
});

app.post('/api/'+channels.GET_TX_DATA, (req, res) => {
  const {
    filterStartDate,
    filterEndDate,
    filterCatID,
    filterEnvID,
    filterAccID,
    filterDesc,
    filterAmount,
  } = req.body;
  console.log(
    channels.GET_TX_DATA,
    filterStartDate,
    filterEndDate,
    filterCatID,
    filterEnvID,
    filterAccID,
    filterDesc,
    filterAmount
  );

  if (db) {
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
        this.on('envelope.id', '=', 'transaction.envelopeID');
      })
      .leftJoin('category', function () {
        this.on('category.id', '=', 'envelope.categoryID');
      })
      .leftJoin('account', function () {
        this.on('account.id', '=', 'transaction.accountID');
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
        ).andOn(function () {
          this.onVal('keyword.account', '=', 'All').orOn(
            'keyword.account',
            'account.account'
          );
        });
      })
      .where({ isBudget: 0 })
      .orderBy('transaction.txDate', 'desc');

    if (parseInt(filterEnvID) > -2) {
      query = query.andWhere('transaction.envelopeID', filterEnvID);
    } else {
      if (parseInt(filterEnvID) > -3) {
        query = query.andWhere(function () {
          this.where('transaction.envelopeID', -1)
          .orWhere('envelope.isActive', false);
        });
      }
    }
    if (parseInt(filterCatID) > -1) {
      query = query.andWhere('envelope.categoryID', filterCatID);
    }
    if (filterAccID !== -1 && filterAccID !== '-1' && filterAccID !== 'All') {
      query = query.andWhere('account.account', filterAccID);
    }
    if (filterDesc?.length) {
      filterDesc = '%' + filterDesc + '%';
      query = query.andWhereRaw(
        `"transaction"."description" LIKE ?`,
        filterDesc
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
        parseFloat(filterAmount)
      );
    }

    query
      .then((data) => {
        res.json(data);
      })
      .catch((err) => console.log(err));
  }
});

app.post('/api/'+channels.ADD_TX, async (req, res) => {
  const { data } = req.body;
  console.log(channels.ADD_TX);

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
  };

  // Insert the node
  await db('transaction').insert(myNode);

  // Update the envelope balance
  await update_env_balance(data.txEnvID, data.txAmt);
});

app.post('/api/'+channels.GET_ENV_LIST, async (req, res) => {
  const { onlyActive } = req.body;
  console.log(channels.GET_ENV_LIST);

  if (db) {
    let query = db
      .select(
        'envelope.id as envID',
        'category.category as category',
        'envelope.envelope as envelope'
      )
      .from('envelope')
      .leftJoin('category', function () {
        this.on('category.id', '=', 'envelope.categoryID');
      })
      .orderBy('category.category', 'envelope.envelope');

    if (onlyActive === 1) {
      query.where('envelope.isActive', true);
    }

    query
      .then((data) => {
        res.json(data);
      })
      .catch((err) => console.log(err));
  }
});

app.post('/api/'+channels.UPDATE_TX_ENV, async (req, res) => {
  const { txID, envID } = req.body;
  console.log(channels.UPDATE_TX_ENV, txID, envID);
  await update_tx_env(txID, envID);
});

app.post('/api/'+channels.UPDATE_TX_DESC, async (req, res) => {
  const { txID, new_value } = req.body;
  console.log(channels.UPDATE_TX_DESC, txID, new_value);

  db('transaction')
    .where({ id: txID })
    .update({ description: new_value })
    .then()
    .catch((err) => {
      console.log('Error: ' + err);
    });
});

app.post('/api/'+channels.UPDATE_TX_DATE, async (req, res) => {
  const { txID, new_value } = req.body;
  console.log(channels.UPDATE_TX_DATE, txID, new_value);

  db('transaction')
    .where({ id: txID })
    .update({ txDate: new_value })
    .then()
    .catch((err) => {
      console.log('Error: ' + err);
    });
});

app.post('/api/'+channels.SAVE_KEYWORD, async (req, res) => {
  const { acc, envID, description } = req.body;
  console.log(channels.SAVE_KEYWORD, acc, envID, description);

  db.from('keyword')
    .delete()
    .where({ description: description })
    .then(() => {
      const node = {
        account: acc,
        envelopeID: envID,
        description: description,
      };

      db('keyword')
        .insert(node)
        .then()
        .catch((err) => {
          console.log('Error: ' + err);
        });
    })
    .catch((err) => {
      console.log('Error: ' + err);
    });
});

app.post('/api/'+channels.SET_DUPLICATE, async (req, res) => {
  const { txID, isDuplicate } = req.body;
  console.log(channels.SET_DUPLICATE, txID, isDuplicate);

  await db('transaction')
    .update({ isDuplicate: isDuplicate })
    .where({ id: txID })
    .catch((err) => {
      console.log('Error: ' + err);
    });

  // Need to adjust envelope balance
  await adjust_balance(txID, isDuplicate ? 'rem' : 'add');
});

app.post('/api/'+channels.SET_VISIBILITY, async (req, res) => {
  const { txID, isVisible } = req.body;
  console.log(channels.SET_VISIBILITY, txID, isVisible);

  await db('transaction')
    .update({ isVisible: isVisible })
    .where({ id: txID })
    .catch((err) => {
      console.log('Error: ' + err);
    });

  // Need to adjust envelope balance
  await adjust_balance(txID, isVisible ? 'add' : 'rem');
});

app.post('/api/'+channels.GET_KEYWORDS, async (req, res) => {
  console.log(channels.GET_KEYWORDS);
  if (db) {
    db.select(
      'keyword.id',
      'keyword.envelopeID',
      'description',
      'category',
      'envelope',
      'account',
      'last_used'
    )
      .from('keyword')
      .leftJoin('envelope', function () {
        this.on('keyword.envelopeID', '=', 'envelope.id');
      })
      .leftJoin('category', function () {
        this.on('category.id', '=', 'envelope.categoryID');
      })
      .then((data) => {
        res.json(data);
      })
      .catch((err) => console.log(err));
  }
});

app.post('/api/'+channels.GET_ACCOUNT_NAMES, async (req, res) => {
  console.log(channels.GET_ACCOUNT_NAMES);
  if (db) {
    db.select('account')
      .from('account')
      .orderBy('account')
      .groupBy('account')
      .then((data) => {
        res.json(data);
      })
      .catch((err) => console.log(err));
  }
});

app.post('/api/'+channels.GET_ACCOUNTS, async (req, res) => {
  console.log(channels.GET_ACCOUNTS);
  if (db) {
    const find_date = dayjs(new Date()).format('YYYY-MM-DD');
    let query = db.select('account.id', 'account.refNumber', 'account', 'isActive')
      .max({ lastTx: 'txDate' })
      .count({ numTx: 'txDate' })
      .from('account')
      .leftJoin('transaction', function () {
        this.on('account.id', '=', 'transaction.accountID')
          .on('transaction.isBudget', '=', 0)
          .on('transaction.isDuplicate', '=', 0);
        // PostgreSQL specific
        this.on(db.raw(`?::date - "txDate" >= 0`, [find_date]));
        this.on(db.raw(`"transaction"."isVisible" = true`));
      })
      .orderBy('account.id')
      .groupBy('account.id', 'account.refNumber', 'account', 'isActive');
    query.then((data) => {
      res.json(data);
    }).catch((err) => console.log(err));
  }
});

app.post('/api/'+channels.UPDATE_KEYWORD_ENV, async (req, res) => {
  const { id, new_value } = req.body;
  console.log(channels.GET_KEYWORDS, { id, new_value });
  db('keyword')
    .update({ envelopeID: new_value })
    .where({ id: id })
    .catch((err) => console.log(err));
});

app.post('/api/'+channels.UPDATE_KEYWORD_ACC, async (req, res) => {
  const { id, new_value } = req.body;
  console.log(channels.UPDATE_KEYWORD_ACC, { id, new_value });
  db('keyword')
    .update({ account: new_value })
    .where({ id: id })
    .catch((err) => console.log(err));
});

app.post('/api/'+channels.SET_ALL_KEYWORD, async (req, res) => {
  const { id, force } = req.body;
  console.log(channels.SET_ALL_KEYWORD, { id });

  db.select('envelopeID', 'description', 'account')
    .from('keyword')
    .where({ id: id })
    .then((data) => {
      let query = db('transaction')
        .update({ envelopeID: data[0].envelopeID })
        .whereRaw(`"description" LIKE ?`, data[0].description);

      if (data[0].account !== 'All') {
        query = query.andWhere({
          accountID: db('account')
            .select('id')
            .where('account', data[0].account),
        });
      }

      if (force === 0) {
        query = query.andWhere({ envelopeID: -1 });
      }
      query.then();
    })
    .catch((err) => console.log(err));
});

app.post('/api/'+channels.DEL_KEYWORD, async (req, res) => {
  const { id } = req.body;
  console.log(channels.DEL_KEYWORD, { id });

  await db('keyword')
    .delete()
    .where({ id: id })
    .catch((err) => console.log(err));
});

app.post('/api/'+channels.UPDATE_KEYWORD, async (req, res) => {
  const { id, new_value } = req.body;
  console.log(channels.UPDATE_KEYWORD, { id, new_value });
  db('keyword')
    .update({ description: new_value })
    .where({ id: id })
    .catch((err) => console.log(err));
});

app.post('/api/'+channels.UPDATE_ACCOUNT, (req, res) => {
  const { id, new_value } = req.body;
  console.log(channels.UPDATE_ACCOUNT, { id, new_value });
  db('account')
    .update({ account: new_value })
    .where({ id: id })
    .catch((err) => console.log(err));
});

app.post('/api/'+channels.VIS_ACCOUNT, async (req, res) => {
  const { id, value } = req.body;
  console.log(channels.VIS_ACCOUNT, { id, value });
  await db('account')
    .update({ isActive: value })
    .where({ id: id })
    .catch((err) => console.log(err));
});

app.post('/api/'+channels.DEL_ACCOUNT, async (req, res) => {
  const { id } = req.body;
  console.log(channels.DEL_ACCOUNT, { id });

  await db.transaction(async (trx) => {
    // Get the account info
    await trx
      .select('id', 'account', 'refNumber', 'plaid_id')
      .from('account')
      .where({ id: id })
      .then(async (data) => {
        if (data?.length) {
          // Delete the original
          await trx('account')
            .delete()
            .where({ id: id })
            .then(async () => {
              // Not sure if we want to delete the plaid account
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
            });
        }
      });
  });
});

app.post('/api/'+channels.GET_ENV_CHART_DATA, async (req, res) => {
  const { filterEnvID, filterTimeFrameID } = req.body;
  console.log(channels.GET_ENV_CHART_DATA, filterEnvID);

  const find_date = dayjs(new Date()).format('YYYY-MM-DD');

  const filterType = filterEnvID.substr(0, 3);
  const envID = filterEnvID.substr(3);

  let query = db('transaction')
    .select({
      month: db.raw(`TO_CHAR("txDate", 'YYYY/MM')`),
      isBudget: 'isBudget',
    })
    .sum({ totalAmt: 'txAmt' })
    .where({ isDuplicate: 0 })
    .andWhere({ isVisible: true })
    .groupBy('month', 'isBudget')
    .orderBy('month');

  // PostgreSQL specific
  query = query.andWhereRaw(`?::date - "txDate" < ?`, [
      find_date,
      365 * filterTimeFrameID,
    ])
    .andWhereRaw(`?::date - "txDate" > 0`, [find_date]);
  
  if (filterType === 'env' && parseInt(envID) > -2) {
    query = query.where('envelopeID', envID);
  }

  if (filterType === 'env' && parseInt(envID) === -2) {
    query = query
      .leftJoin('envelope', function () {
        this.on('envelope.id', '=', 'transaction.envelopeID');
      })
      .leftJoin('category', function () {
        this.on('category.id', '=', 'envelope.categoryID');
      })
      .andWhereNot({ category: 'Income' });
  }

  if (filterType === 'cat') {
    query = query
      .leftJoin('envelope', function () {
        this.on('envelope.id', '=', 'transaction.envelopeID');
      })
      .leftJoin('category', function () {
        this.on('category.id', '=', 'envelope.categoryID');
      })
      .andWhere({ categoryID: envID });
  }

  query.then((data) => {
    res.json(data);
  }).catch((err) => console.log(err));
});





app.post('/api/'+channels.IMPORT_OFX, async (req, res) => {
  const { ofxString } = req.body;
  //console.log(channels.IMPORT_OFX, ofxString);

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
  accountID = await lookup_account(accountID_str);

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
});

app.post('/api/'+channels.IMPORT_CSV, async (req, res) => {
  const { account_string, ofxString } = req.body;
  let accountID = '';
  let totalNodes = 0;

  // Find the financial institution ID
  console.log('Account string: ', account_string);

  const nodes = ofxString.split('\n');

  if (account_string.toLowerCase().startsWith('sofi-')) {
    accountID = await lookup_account(account_string);
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
    accountID = await lookup_account(account_string);
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
    accountID = await lookup_account(account_string);
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
    const uncategorizedID = await lookup_uncategorized();

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
                  envelope_str,
                  uncategorizedID
                );
                envelopeArr.push({ name: envelope_str, id: envelopeID });
              }
            } else {
              envelopeID = await lookup_envelope(
                envelope_str,
                uncategorizedID
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
                accountID = await lookup_account(account_str);
                accountArr.push({ name: account_str, id: accountID });
              }
            } else {
              accountID = await lookup_account(account_str);
              accountArr.push({ name: account_str, id: accountID });
            }

            await basic_insert_transaction_node(
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
            accountID = await lookup_account(account_str);
            accountArr.push({ name: account_str, id: accountID });
          }
        } else {
          accountID = await lookup_account(account_str);
          accountArr.push({ name: account_str, id: accountID });
        }

        await basic_insert_transaction_node(
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
            isVisible: true,
          })
          .then(async () => {
            await db.raw(
              `UPDATE "envelope" SET "balance" = "balance" + ` +
                newtxAmt +
                ` WHERE "id" = ` +
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
            `UPDATE "envelope" SET "balance" = "balance" + ` +
              (newtxAmt - rows[0].txAmt) +
              ` WHERE "id" = ` +
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
              `update "envelope" set "balance" = "balance" - ` +
                rows[0].txAmt +
                ` where "id" = ` +
                rows[0].envelopeID
            )
            .then()
            .catch((err) => {
              console.log('Error: ' + err);
            });
        }

        await db
          .raw(
            `update "envelope" set "balance" = "balance" + ` +
              rows[0].txAmt +
              ` where "id" = ` +
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
              isActive: true })
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
              isActive: true,
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
              isActive: true,
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
      .whereRaw(`? LIKE "description"`, description);

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
      .andWhereRaw(`"accountID" = ?`, accountID)
      .andWhereRaw(`"refNumber" = ?`, refNumber);
      
    // PostgreSQL specific
    query = query.andWhereRaw(`?::date - "txDate" = 0`, [txDate]);
    
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
      .andWhereRaw(`"accountID" = ?`, accountID)
      .andWhere({ description: description });
    // PostgreSQL specific
    query = query.andWhereRaw(`?::date - "txDate" = 0`, [txDate]);
      
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
      `UPDATE "envelope" SET "balance" = "balance" + ` +
        amt +
        ` WHERE "id" = ` +
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
    isVisible: true,
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
    isVisible: true,
  };

  // Insert the node
  await db('transaction').insert(myNode);

  // Update the envelope balance
  if (envID !== -1 && isDuplicate !== 1) {
    await update_env_balance(envID, txAmt);
  }
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
