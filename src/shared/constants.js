module.exports = {
  auth0data: {
    domain: 'dev-uzuzwxmdtzhadla7.us.auth0.com',
    clientId: 'OhD9wIJL5VTPQLLN8mINVJgzjfE2BKtt',
    origin: process.env.REACT_APP_AUTH0_ORIGIN,
    audience: process.env.REACT_APP_AUTH0_AUDIENCE,
    issuerBaseURL: 'https://dev-uzuzwxmdtzhadla7.us.auth0.com/',
    tokenSigningAlg: 'RS256',
    redirectURL: process.env.REACT_APP_AUTH0_REDIRECT_URL,
  },
  baseUrl: process.env.REACT_APP_API_BASE_URL,
  channels: {
    GET_CAT_ENV: 'get_categories_and_envelopes', // if a category has no envelopes, this will include it
    GET_ENV_CAT: 'get_envelopes_and_categories', // if a category has no envelopes, this will not include it
    GET_ENV_LIST: 'get_envelope_list',
    
    GET_BUDGET_ENV: 'get_budget_envelopes',
    GET_PREV_BUDGET: 'get_prev_budget',
    GET_CUR_BUDGET: 'get_cur_budget',
    GET_PREV_ACTUAL: 'get_prev_actual',
    GET_CUR_ACTUAL: 'get_cur_actual',
    GET_CURR_BALANCE: 'get_curr_balance',
    GET_MONTHLY_AVG: 'get_monthly_avg',
    
    GET_TX_DATA: 'get_tx_data',
    DEL_TX_LIST: 'del_tx_list',
    UPDATE_TX_ENV_LIST: 'update_tx_env_list',
    ADD_TX: 'add_transaction',
    UPDATE_TX_ENV: 'update_tx_envelope',
    SPLIT_TX: 'split_tx',
    UPDATE_TX_DESC: 'update_tx_description',
    UPDATE_TX_DATE: 'update_tx_date',
    EXPORT_TX: 'export_tx',
    EXPORT_PROGRESS: 'export_progress',

    REN_CATEGORY: 'ren_category',
    DEL_CATEGORY: 'del_category',
    ADD_CATEGORY: 'add_category',
    ADD_ENVELOPE: 'add_envelope',
    REN_ENVELOPE: 'ren_envelope',
    DEL_ENVELOPE: 'del_envelope',
    HIDE_ENVELOPE: 'del_envelope',
    MOV_ENVELOPE: 'move_envelope',

    UPDATE_BUDGET: 'update_budget',
    UPDATE_BALANCE: 'update_balance',
    MOVE_BALANCE: 'move_balance',
    COPY_BUDGET: 'copy_budget',
    
    SAVE_KEYWORD: 'save_keyword',

    SET_DUPLICATE: 'set_duplicate',
    
    SET_VISIBILITY: 'set_visibility',
    
    IMPORT_OFX: 'import_ofx',
    IMPORT_CSV: 'import_csv',
    UPLOAD_PROGRESS: 'upload_progress',

    GET_KEYWORDS: 'get_keywords',
    UPDATE_KEYWORD_ENV: 'update_keyword_envelope',
    UPDATE_KEYWORD_ACC: 'update_keyword_account',
    DEL_KEYWORD: 'del_keyword',
    SET_ALL_KEYWORD: 'set_all_keyword',
    UPDATE_KEYWORD: 'update_keyword',

    ADD_ACCOUNT: 'add_account',
    GET_ACCOUNTS: 'get_accounts',
    GET_ACCOUNT_NAMES: 'get_account_names',
    UPDATE_ACCOUNT: 'update_account',
    DEL_ACCOUNT: 'del_account',
    VIS_ACCOUNT: 'vis_account',

    GET_ENV_CHART_DATA: 'get_env_chart_data',

    PLAID_GET_TOKEN: 'plaid_get_token',
    PLAID_SET_ACCESS_TOKEN: 'plaid_set_access_token',
    PLAID_GET_TRANSACTIONS: 'plaid_get_transactions',
    PLAID_FORCE_TRANSACTIONS: 'plaid_force_transactions',
    PLAID_GET_ACCOUNTS: 'plaid_get_accounts',
    PLAID_UPDATE_LOGIN: 'plaid_update_login',
    PLAID_REMOVE_LOGIN: 'plaid_remove_login',

    AUTH0_CHECK_CREATE_USER: 'auth0_check_or_create_user',
    AUTH0_GET_TOKENS: 'auth0_get_tokens',

    PROGRESS: 'progress',
  },
};
