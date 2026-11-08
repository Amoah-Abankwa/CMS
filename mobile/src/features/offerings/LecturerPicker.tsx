import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { offeringsApi, type LecturerOption, type Offering } from '@/api/offerings';
import { FormError } from '@/components/states/FormError';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { matches } from '@/lib/search';
import { useTheme } from '@/theme/useTheme';

/** Choosing a class's lecturers; one of them is the lead, who submits the results. */
export function LecturerPicker({ o, options, onDone }: { o: Offering; options: LecturerOption[]; onDone: () => void }) {
  const { space } = useTheme();
  const [chosen, setChosen] = useState(o.lecturers.map((l) => ({ userId: l.id, isLead: l.isLead })));
  const [find, setFind] = useState('');
  const { busy, error, run } = useSubmit();
  const name = (id: string) => { const l = options.find((x) => x.id === id); return l ? `${l.staffProfile?.title ?? ''} ${l.firstName} ${l.lastName}`.trim() : 'Lecturer'; };
  const shown = options.filter((l) => !chosen.some((c) => c.userId === l.id) && (!find.trim() || matches(`${l.firstName} ${l.lastName} ${l.staffProfile?.department?.name ?? ''}`, find))).slice(0, 12);
  const noLead = chosen.length > 0 && !chosen.some((c) => c.isLead);
  return (
    <View style={{ gap: space.sm }}>
      <FormError error={error} />
      {chosen.map((c) => (
        <View key={c.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={{ flex: 1 }}>{name(c.userId)}</Text>
          <Chip label={c.isLead ? 'Lead' : 'Make lead'} selected={c.isLead} onPress={() => setChosen(chosen.map((x) => ({ ...x, isLead: x.userId === c.userId })))} />
          <Button label="Remove" variant="ghost" onPress={() => setChosen(chosen.filter((x) => x.userId !== c.userId))} />
        </View>
      ))}
      {noLead ? <Text variant="small" tone="danger">Choose a lead lecturer: they enter and submit the results.</Text> : null}
      <TextField label="Add a lecturer" value={find} onChangeText={setFind} placeholder="Name or department" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {shown.map((l) => <Chip key={l.id} label={`${l.firstName} ${l.lastName}`} onPress={() => setChosen([...chosen, { userId: l.id, isLead: chosen.length === 0 }])} />)}
      </ScrollView>
      <Button label="Save lecturers" disabled={noLead} loading={busy} onPress={() => void run(async () => { await offeringsApi.setLecturers(o.id, chosen); onDone(); })} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </View>
  );
}
