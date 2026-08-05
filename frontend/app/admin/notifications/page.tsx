'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
export default function AdminNotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audienceType, setAudience] = useState('ALL_USERS');
  const [targetUserIds, setIds] = useState('');
  const [rows, setRows] = useState<
    Array<{
      id: string;
      title: string;
      status: string;
      processedRecipients: number;
      totalRecipients: number;
    }>
  >([]);
  const load = async () => {
    const r = await apiClient.get<{
      data: Array<{
        id: string;
        title: string;
        status: string;
        processedRecipients: number;
        totalRecipients: number;
      }>;
    }>('/notifications/admin/broadcasts', { cache: 'no-store' });
    setRows(r.data);
  };
  useEffect(() => {
    void load();
  }, []);
  const send = async () => {
    await apiClient.post('/notifications/admin/broadcasts', {
      title,
      body,
      audienceType,
      targetUserIds: targetUserIds
        .split(',')
        .map((v) => Number(v.trim()))
        .filter(Boolean),
      idempotencyKey: crypto.randomUUID(),
    });
    setTitle('');
    setBody('');
    await load();
  };
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <Input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
        <Textarea
          placeholder="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
        />
        <NativeSelect value={audienceType} onChange={(e) => setAudience(e.target.value)}>
          <option value="ALL_USERS">All eligible users</option>
          <option value="SELECTED_USERS">Selected users</option>
          <option value="USER">One user</option>
        </NativeSelect>
        {audienceType !== 'ALL_USERS' && (
          <Input
            placeholder="User IDs, comma separated"
            value={targetUserIds}
            onChange={(e) => setIds(e.target.value)}
          />
        )}
        <Button onClick={send}>Create broadcast</Button>
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold mb-3">Broadcast history</h2>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border p-3 text-sm">
              <b>{r.title}</b>
              <p>
                {r.status} · {r.processedRecipients}/{r.totalRecipients}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
