// frontend/src/features/library/components/catalogue-manager.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { libraryApi, type TitleInput } from '../api';
import { CatalogueSearch } from './catalogue-search';
import { TitleFormDialog } from './title-form';

type SavedTitle = {
  id: string;
};

export function CatalogueManager() {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  const handleSaved = (result: unknown) => {
    setAdding(false);

    const title = result as SavedTitle;

    router.push(`/library/catalogue/${title.id}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button size="sm" onClick={() => setAdding(true)}>
          Add a title
        </Button>
      </div>

      <CatalogueSearch manageHrefAction={(t) => `/library/catalogue/${t.id}`} />

      <TitleFormDialog
        open={adding}
        onCloseAction={() => setAdding(false)}
        onSaveAction={(dto: TitleInput) => libraryApi.saveTitle(dto)}
        onSavedAction={handleSaved}
      />
    </div>
  );
}