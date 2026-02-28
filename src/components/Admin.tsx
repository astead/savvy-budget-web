import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { Header } from './header.tsx';
import { baseUrl, channels } from '../shared/constants.js';
import { useAuthToken } from '../context/AuthTokenContext.tsx';

const ADMIN_BIT   = 128;
const LINKED_BIT  = 1;

interface AdminUser {
  id: number;
  email: string;
  name: string;
  subscriptionLevel: number;
  plaidAccountCount: number;
  linkedPlaidCount: number;
  activeTokenCount: number;
}

interface AdminPlaidAccount {
  id: number;
  user_id: number;
  user_email: string;
  institution_name: string;
  full_account_name: string;
  item_id: string;
  isActive: boolean;
  isLinked: boolean;
  hasAccessToken: boolean;
  isOrphaned: boolean;
}

interface ConfirmState {
  open: boolean;
  account: AdminPlaidAccount | null;
}

function subscriptionLabel(level: number): string {
  if (level === 0) return 'Free';
  const parts: string[] = [];
  if (level & LINKED_BIT) parts.push('Linked Accounts');
  if (level & ADMIN_BIT)  parts.push('Admin');
  const remaining = level & ~(LINKED_BIT | ADMIN_BIT);
  if (remaining) parts.push(`+${remaining}`);
  return parts.join(', ');
}

export const Admin: React.FC = () => {
  const { config } = useAuthToken();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plaidAccounts, setPlaidAccounts] = useState<AdminPlaidAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orphanedOnly, setOrphanedOnly] = useState(false);

  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, account: null });
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);

  const load = async () => {
    if (!config) return;
    setLoading(true);
    setError(null);
    try {
      const [usersRes, accountsRes] = await Promise.all([
        axios.post(baseUrl + channels.ADMIN_GET_USERS, null, config),
        axios.post(baseUrl + channels.ADMIN_GET_PLAID_ACCOUNTS, null, config),
      ]);
      setUsers(usersRes.data);
      setPlaidAccounts(accountsRes.data);
    } catch (err: any) {
      setError(err?.response?.status === 403
        ? 'Access denied. Admin privileges required.'
        : 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const handleUnlinkClick = (account: AdminPlaidAccount) => {
    setUnlinkError(null);
    setConfirm({ open: true, account });
  };

  const handleUnlinkConfirm = async () => {
    const account = confirm.account!;
    setConfirm({ open: false, account: null });
    setUnlinkingId(account.id);
    setUnlinkError(null);
    try {
      await axios.post(
        baseUrl + channels.ADMIN_REMOVE_PLAID_ACCOUNT,
        { userId: account.user_id, accountId: account.id },
        config!
      );
      // Refresh just the Plaid accounts list
      const accountsRes = await axios.post(baseUrl + channels.ADMIN_GET_PLAID_ACCOUNTS, null, config!);
      setPlaidAccounts(accountsRes.data);
      // Also refresh user list (token counts change)
      const usersRes = await axios.post(baseUrl + channels.ADMIN_GET_USERS, null, config!);
      setUsers(usersRes.data);
    } catch (err: any) {
      setUnlinkError(`Failed to unlink "${account.full_account_name}": ${err?.response?.data ?? err?.message}`);
    } finally {
      setUnlinkingId(null);
    }
  };

  const displayedAccounts = orphanedOnly
    ? plaidAccounts.filter(a => a.isOrphaned)
    : plaidAccounts;

  const orphanCount = plaidAccounts.filter(a => a.isOrphaned).length;

  if (loading) {
    return (
      <div className="App">
        <header className="App-header"><Header currTab="Admin" /></header>
        <div className="mainContent"><p>Loading admin data…</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App">
        <header className="App-header"><Header currTab="Admin" /></header>
        <div className="mainContent"><p style={{ color: '#dd8888' }}>{error}</p></div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <Header currTab="Admin" />
      </header>

      <div className="mainContent">
        {/* ── Users ─────────────────────────────────────────── */}
        <h2 style={{ marginBottom: '8px' }}>Users ({users.length})</h2>
        <table className="Table" cellSpacing={0} cellPadding={0} style={{ marginBottom: '32px' }}>
          <thead>
            <tr className="Table THR">
              <th className="Table THR THRC">ID</th>
              <th className="Table THR THRC">Email</th>
              <th className="Table THR THRC">Name</th>
              <th className="Table THR THRC">Subscription</th>
              <th className="Table THR THRC">Plaid Rows</th>
              <th className="Table THR THRC">Linked</th>
              <th className="Table THR THRC">Active Tokens</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="TR">
                <td className="Table TC">{u.id}</td>
                <td className="Table TC Left">{u.email}</td>
                <td className="Table TC Left">{u.name}</td>
                <td className="Table TC">{subscriptionLabel(u.subscriptionLevel)}</td>
                <td className="Table TC">{u.plaidAccountCount}</td>
                <td className="Table TC">{u.linkedPlaidCount}</td>
                <td className="Table TC"
                  style={{ backgroundColor: Number(u.activeTokenCount) > 0 ? 'transparent' : undefined }}>
                  {Number(u.activeTokenCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Plaid Accounts ─────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <h2 style={{ margin: 0 }}>
            Plaid Accounts ({plaidAccounts.length})
            {orphanCount > 0 && (
              <span style={{ marginLeft: '8px', color: '#dd8888', fontSize: '0.85em' }}>
                ⚠ {orphanCount} orphaned
              </span>
            )}
          </h2>
          <label style={{ fontSize: '0.9em', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={orphanedOnly}
              onChange={e => setOrphanedOnly(e.target.checked)}
              style={{ marginRight: '4px' }}
            />
            Show orphaned only
          </label>
          <button onClick={load} style={{ fontSize: '0.85em' }}>↻ Refresh</button>
        </div>

        {unlinkError && (
          <p style={{ color: '#dd8888', marginBottom: '8px' }}>{unlinkError}</p>
        )}

        <table className="Table" cellSpacing={0} cellPadding={0}>
          <thead>
            <tr className="Table THR">
              <th className="Table THR THRC">ID</th>
              <th className="Table THR THRC">Owner</th>
              <th className="Table THR THRC">Institution</th>
              <th className="Table THR THRC">Account</th>
              <th className="Table THR THRC">Item ID</th>
              <th className="Table THR THRC">Active</th>
              <th className="Table THR THRC">Linked</th>
              <th className="Table THR THRC">Has Token</th>
              <th className="Table THR THRC">Orphaned</th>
              <th className="Table THR THRC">Action</th>
            </tr>
          </thead>
          <tbody>
            {displayedAccounts.map(a => (
              <tr
                key={a.id}
                className="TR"
                style={{ backgroundColor: a.isOrphaned ? '#3a1a1a' : undefined }}
              >
                <td className="Table TC">{a.id}</td>
                <td className="Table TC Left" style={{ fontSize: '0.85em' }}>{a.user_email}</td>
                <td className="Table TC Left">{a.institution_name}</td>
                <td className="Table TC Left">{a.full_account_name}</td>
                <td className="Table TC" style={{ fontSize: '0.75em', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.item_id}
                </td>
                <td className="Table TC">{a.isActive ? '✓' : '—'}</td>
                <td className="Table TC">{a.isLinked ? '✓' : '—'}</td>
                <td className="Table TC"
                  style={{ color: a.hasAccessToken ? '#88dd88' : '#888' }}>
                  {a.hasAccessToken ? '✓' : '—'}
                </td>
                <td className="Table TC"
                  style={{ color: a.isOrphaned ? '#dd8888' : '#888', fontWeight: a.isOrphaned ? 'bold' : undefined }}>
                  {a.isOrphaned ? '⚠ Yes' : '—'}
                </td>
                <td className="Table TC">
                  {a.hasAccessToken ? (
                    <button
                      onClick={() => handleUnlinkClick(a)}
                      disabled={unlinkingId === a.id}
                      style={{
                        fontSize: '0.8em',
                        backgroundColor: '#8b2525',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        padding: '2px 8px',
                        cursor: unlinkingId === a.id ? 'wait' : 'pointer',
                        opacity: unlinkingId === a.id ? 0.6 : 1,
                      }}
                    >
                      {unlinkingId === a.id ? 'Unlinking…' : 'Unlink'}
                    </button>
                  ) : (
                    <span style={{ color: '#666', fontSize: '0.8em' }}>Already removed</span>
                  )}
                </td>
              </tr>
            ))}
            {displayedAccounts.length === 0 && (
              <tr>
                <td colSpan={10} className="Table TC" style={{ padding: '16px', color: '#888' }}>
                  {orphanedOnly ? 'No orphaned accounts found.' : 'No Plaid accounts found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Confirmation dialog ─────────────────────────────── */}
      <Dialog open={confirm.open} onClose={() => setConfirm({ open: false, account: null })}>
        <DialogTitle>Unlink Plaid Account?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will call Plaid's <code>/item/remove</code> API to permanently disconnect:
            <br /><br />
            <strong>{confirm.account?.full_account_name}</strong>
            <br />
            Owner: {confirm.account?.user_email}
            <br />
            Item ID: {confirm.account?.item_id}
            <br /><br />
            This cannot be undone. The account row will be preserved but the Plaid token will be removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm({ open: false, account: null })}>Cancel</Button>
          <Button onClick={handleUnlinkConfirm} color="error" variant="contained">
            Unlink
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Admin;
