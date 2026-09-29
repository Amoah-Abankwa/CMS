'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Select, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { accommodationApi } from '../api';

type ComplaintCategory =
  | 'SAFETY'
  | 'SANITATION'
  | 'WATER'
  | 'POWER'
  | 'OWNER_CONDUCT'
  | 'CHARGES'
  | 'OTHER';

const COMPLAINT_CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  SAFETY: 'Safety',
  SANITATION: 'Sanitation',
  WATER: 'Water',
  POWER: 'Power',
  OWNER_CONDUCT: "Owner's conduct",
  CHARGES: 'Charges',
  OTHER: 'Other',
};

type Status = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';

const STATUS: Record<
  Status,
  {
    label: string;
    tone: 'warning' | 'primary' | 'success' | 'neutral';
  }
> = {
  OPEN: {
    label: 'New',
    tone: 'warning',
  },
  IN_REVIEW: {
    label: 'Being looked into',
    tone: 'primary',
  },
  RESOLVED: {
    label: 'Resolved',
    tone: 'success',
  },
  DISMISSED: {
    label: 'Closed',
    tone: 'neutral',
  },
};

interface Complaint {
  id: string;
  category: ComplaintCategory;
  description: string;
  shareName: boolean;
  status: Status;
  officeNote: string | null;
  ownerResponse: string | null;
  createdAt: string;
  hostel: {
    id: string;
    name: string;
  };
  student: {
    firstName: string;
    lastName: string;
    indexNumber: string | null;
    phone: string | null;
  } | null;
}

/** Students: report a problem with a private hostel, and follow it. */
export function MyHostelComplaints() {
  const [list, setList] = useState<Complaint[] | null>(null);

  const [hostels, setHostels] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const [f, setF] = useState({
    hostelId: '',
    category: 'SAFETY' as ComplaintCategory,
    description: '',
    shareName: false,
  });

  const [open, setOpen] = useState(false);

  const [msg, setMsg] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  const load = useCallback(() => {
    api
      .get<Complaint[]>('/hostel-complaints/mine')
      .then((r) => setList(r.data))
      .catch(() => setList([]));
  }, []);

  useEffect(() => {
    load();

    accommodationApi
      .privateHostels()
      .then((h: Array<{ id: string; name: string }>) =>
        setHostels(
          h.map((x) => ({
            id: x.id,
            name: x.name,
          }))
        )
      )
      .catch(() => undefined);
  }, [load]);

  const send = () =>
    api
      .post('/hostel-complaints', {
        ...f,
        description: f.description.trim(),
      })
      .then(() => {
        setMsg({
          tone: 'success',
          text: 'Sent to the Hostel Office.',
        });

        setOpen(false);

        setF({
          ...f,
          description: '',
        });

        load();
      })
      .catch((err) =>
        setMsg({
          tone: 'danger',
          text: errorMessage(err),
        })
      );

  if (!list) return null;

  return (
    <Card>
      <CardHeader
        title="Problems with a private hostel"
        description="Report safety, sanitation, water or power, the owner's conduct, or charges. The Hostel Office follows it up."
        actions={
          !open && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setOpen(true)}
            >
              Report a problem
            </Button>
          )
        }
      />

      <CardBody className="flex flex-col gap-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

        {open && (
          <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Hostel" htmlFor="hc-h">
                <Select
                  id="hc-h"
                  value={f.hostelId}
                  onChange={(e) =>
                    setF({
                      ...f,
                      hostelId: e.target.value,
                    })
                  }
                >
                  <option value="">Choose</option>

                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="What about" htmlFor="hc-c">
                <Select
                  id="hc-c"
                  value={f.category}
                  onChange={(e) =>
                    setF({
                      ...f,
                      category: e.target.value as ComplaintCategory,
                    })
                  }
                >
                  {(
                    Object.keys(
                      COMPLAINT_CATEGORY_LABEL
                    ) as ComplaintCategory[]
                  ).map((c) => (
                    <option key={c} value={c}>
                      {COMPLAINT_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label="What happened"
              htmlFor="hc-d"
              hint="At least 20 characters. Include dates and what you have already tried."
            >
              <Textarea
                id="hc-d"
                value={f.description}
                maxLength={2000}
                onChange={(e) =>
                  setF({
                    ...f,
                    description: e.target.value,
                  })
                }
              />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={f.shareName}
                onChange={(e) =>
                  setF({
                    ...f,
                    shareName: e.target.checked,
                  })
                }
              />
              The owner may see my name (otherwise only the Hostel Office
              does)
            </label>

            <div className="flex gap-2">
              <Button
                disabled={
                  !f.hostelId ||
                  f.description.trim().length < 20
                }
                onClick={send}
              >
                Send
              </Button>

              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {list.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {list.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-1 px-3 py-2 text-sm"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {c.hostel.name}:{' '}
                    {COMPLAINT_CATEGORY_LABEL[c.category]}
                  </span>

                  <Badge tone={STATUS[c.status].tone}>
                    {STATUS[c.status].label}
                  </Badge>
                </span>

                {c.officeNote && (
                  <span className="text-xs">
                    Hostel Office: {c.officeNote}
                  </span>
                )}

                {c.ownerResponse && (
                  <span className="text-xs text-muted">
                    Owner: {c.ownerResponse}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/** Hostel Office: all complaints. Owners: complaints about their hostels, to respond to. */
export function HostelComplaintsDesk({
  owner = false,
}: {
  owner?: boolean;
}) {
  const [status, setStatus] = useState<string>(
    owner ? '' : 'OPEN'
  );

  const [list, setList] = useState<Complaint[] | null>(null);

  const [msg, setMsg] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  const load = useCallback(() => {
    setList(null);

    api
      .get<Complaint[]>('/hostel-complaints', {
        params: status ? { status } : {},
      })
      .then((r) => setList(r.data))
      .catch((err) =>
        setMsg({
          tone: 'danger',
          text: errorMessage(err),
        })
      );
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const act = (
    c: Complaint,
    next: Exclude<Status, 'OPEN'>
  ) => {
    const note =
      next === 'IN_REVIEW'
        ? undefined
        : window.prompt(
            next === 'RESOLVED'
              ? 'What was done? (the student and owner see this)'
              : 'Why is it being closed? (the student and owner see this)'
          ) ?? '';

    if (next !== 'IN_REVIEW' && !note) return;

    api
      .post(`/hostel-complaints/${c.id}/handle`, {
        status: next,
        note,
      })
      .then(load)
      .catch((err) =>
        setMsg({
          tone: 'danger',
          text: errorMessage(err),
        })
      );
  };

  const respond = (c: Complaint) => {
    const r = window.prompt(
      'Your response (the Hostel Office and the student see it)',
      c.ownerResponse ?? ''
    );

    if (r && r.trim().length >= 5) {
      api
        .post(`/hostel-complaints/${c.id}/respond`, {
          response: r.trim(),
        })
        .then(() => {
          setMsg({
            tone: 'success',
            text: 'Response saved.',
          });

          load();
        })
        .catch((err) =>
          setMsg({
            tone: 'danger',
            text: errorMessage(err),
          })
        );
    }
  };

  return (
    <Card>
      <CardHeader
        title={
          owner
            ? 'Complaints about your hostels'
            : 'Private hostel complaints'
        }
        description={
          owner
            ? 'You see who complained only if the student agreed.'
            : 'Look into each one, contact the owner, then resolve or close it with a note.'
        }
        actions={
          <Select
            aria-label="Show"
            className="w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>

            {(Object.keys(STATUS) as Status[]).map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </Select>
        }
      />

      {msg && (
        <div className="px-4 pb-2">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}

      {!list ? (
        <CardBody>
          <Spinner />
        </CardBody>
      ) : list.length === 0 ? (
        <CardBody>
          <EmptyState title="No complaints" />
        </CardBody>
      ) : (
        <ul className="divide-y divide-border">
          {list.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 px-4 py-3 text-sm sm:px-5"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="font-medium">
                    {c.hostel.name}:{' '}
                    {COMPLAINT_CATEGORY_LABEL[c.category]}
                  </span>{' '}
                  <span className="text-muted">
                    {formatDate(c.createdAt)}.{' '}
                    {c.student
                      ? `${c.student.firstName} ${c.student.lastName} (${
                          c.student.indexNumber ?? ''
                        })${
                          owner
                            ? ''
                            : `, ${c.student.phone ?? ''}`
                        }`
                      : 'Name not shared'}
                    .
                  </span>
                </span>

                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS[c.status].tone}>
                    {STATUS[c.status].label}
                  </Badge>

                  {!owner && c.status === 'OPEN' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => act(c, 'IN_REVIEW')}
                    >
                      Look into it
                    </Button>
                  )}

                  {!owner &&
                    (c.status === 'OPEN' ||
                      c.status === 'IN_REVIEW') && (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            act(c, 'RESOLVED')
                          }
                        >
                          Resolved
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            act(c, 'DISMISSED')
                          }
                        >
                          Close
                        </Button>
                      </>
                    )}

                  {owner &&
                    (c.status === 'OPEN' ||
                      c.status === 'IN_REVIEW') && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => respond(c)}
                      >
                        {c.ownerResponse
                          ? 'Change response'
                          : 'Respond'}
                      </Button>
                    )}
                </span>
              </div>

              <p className="rounded-md bg-surface-muted px-3 py-2">
                {c.description}
              </p>

              {c.ownerResponse && (
                <p className="text-xs">
                  Owner: {c.ownerResponse}
                </p>
              )}

              {c.officeNote && (
                <p className="text-xs text-muted">
                  Hostel Office: {c.officeNote}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}