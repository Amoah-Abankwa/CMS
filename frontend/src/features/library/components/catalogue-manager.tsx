// frontend/src/features/library/components/catalogue-manager.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { libraryApi } from '../api';
import type { TitleInput } from '../api';
import { CatalogueSearch } from './catalogue-search';
import { TitleFormDialog } from './title-form';

export function CatalogueManager() {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button size="sm" onClick={() => setAdding(true)}>
          Add a title
        </Button>
      </div>

      <CatalogueSearch
        manageHref={(t) => `/library/catalogue/${t.id}`}
      />

      <TitleFormDialog
        open={adding}
        onCloseAction={() => setAdding(false)}
        onSaveAction={(dto: TitleInput) => libraryApi.saveTitle(dto)}
        onSavedAction={(t: unknown) => {
          setAdding(false);

          if (
            t &&
            typeof t === 'object' &&
            'id' in t &&
            typeof t.id === 'string'
          ) {
            router.push(`/library/catalogue/${t.id}`);
          }
        }}
      />
    </div>
  );
}