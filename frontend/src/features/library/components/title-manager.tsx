'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { libraryApi } from '../api';
import type { TitleInput } from '../api';
import { TitleFormDialog } from './title-form';

type LibraryTitle = TitleInput & {
  id: string;
  subtitle?: string | null;
  isbn?: string | null;
  publisher?: string | null;
  year?: number | null;
  edition?: string | null;
  callNumber?: string | null;
  description?: string | null;
};

export function TitleManager({ titleId }: { titleId?: string }) {
  const [titles, setTitles] = useState<LibraryTitle[]>([]);
  const [selected, setSelected] = useState<LibraryTitle | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await libraryApi.search({
        page: 1,
        pageSize: 100,
      });

      const items = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
          ? data.items
          : [];

      setTitles(items as LibraryTitle[]);

      if (titleId) {
        setSelected(
          (items as LibraryTitle[]).find((t) => t.id === titleId) ?? null,
        );
      } else {
        setSelected(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load titles.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [titleId]);

  const createTitle = async (dto: TitleInput) => {
    return libraryApi.saveTitle(dto);
  };

  const updateTitle = async (dto: TitleInput) => {
    if (!selected) return null;
    return libraryApi.saveTitle(dto, selected.id);
  };

  if (loading) {
    return <div className="p-6">Loading titles...</div>;
  }

  return (
    <div className="space-y-6">
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Library Titles</h1>
          <p className="text-sm text-muted-foreground">
            Manage books and other library titles.
          </p>
        </div>

        <Button
          onClick={() => {
            setSelected(null);
            setEditing(true);
          }}
        >
          Add title
        </Button>
      </div>

      <div className="grid gap-4">
        {titles.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">{t.title}</h2>

                {t.subtitle && (
                  <p className="text-sm text-muted-foreground">
                    {t.subtitle}
                  </p>
                )}

                {t.authors?.length > 0 && (
                  <p className="mt-1 text-sm">
                    {t.authors.join(', ')}
                  </p>
                )}

                {t.description && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t.description}
                  </p>
                )}
              </div>

              <Button
                variant="secondary"
                onClick={() => {
                  setSelected(t);
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            </div>
          </Card>
        ))}

        {!titles.length && (
          <Card className="p-8 text-center text-muted-foreground">
            No titles found.
          </Card>
        )}
      </div>

      <TitleFormDialog
        open={editing}
        initial={
          selected
            ? {
                ...selected,
                subtitle: selected.subtitle ?? undefined,
                isbn: selected.isbn ?? undefined,
                publisher: selected.publisher ?? undefined,
                year: selected.year ?? undefined,
                edition: selected.edition ?? undefined,
                callNumber: selected.callNumber ?? undefined,
                description: selected.description ?? undefined,
              }
            : undefined
        }
        onCloseAction={() => setEditing(false)}
        onSaveAction={selected ? updateTitle : createTitle}
        onSavedAction={() => {
          setEditing(false);
          setNotice('Title saved.');
          void load();
        }}
      />
    </div>
  );
}