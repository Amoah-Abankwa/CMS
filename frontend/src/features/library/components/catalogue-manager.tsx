'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { libraryApi } from '../api';
import { CatalogueSearch } from './catalogue-search';
import { TitleFormDialog } from './title-form';

export function CatalogueManager() {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div><Button size="sm" onClick={() => setAdding(true)}>Add a title</Button></div>
      <CatalogueSearch manageHref={(t) => `/library/catalogue/${t.id}`} />
      <TitleFormDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSave={(dto) => libraryApi.saveTitle(dto)}
        onSaved={(t) => { setAdding(false); router.push(`/library/catalogue/${(t as { id: string }).id}`); }}
      />
    </div>
  );
}
