import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { AssignableRole, RoleChoice, SchoolNode } from '@/api/staff';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';

/** Choosing roles (some tied to one department or school) and which one is used at sign-in. */
export function RolePicker({ roles, structure, value, primary, onChange }: { roles: AssignableRole[]; structure: SchoolNode[]; value: RoleChoice[]; primary: string; onChange: (v: RoleChoice[], primary: string) => void }) {
  const { space } = useTheme();
  const [adding, setAdding] = useState<AssignableRole | null>(null);
  const name = (c: RoleChoice) => {
    const r = roles.find((x) => x.key === c.roleKey);
    const scope = c.scopeId ? structure.flatMap((s) => [{ id: s.id, name: s.name }, ...s.departments]).find((x) => x.id === c.scopeId)?.name : null;
    return `${r?.name ?? c.roleKey}${scope ? ` (${scope})` : ''}`;
  };
  return (
    <View style={{ gap: space.sm }}>
      {value.map((c, i) => (
        <View key={`${c.roleKey}${c.scopeId ?? ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={{ flex: 1 }}>{name(c)}</Text>
          <Chip label={primary === c.roleKey ? 'Used at sign-in' : 'Use at sign-in'} selected={primary === c.roleKey} onPress={() => onChange(value, c.roleKey)} />
          <Button label="Remove" variant="ghost" onPress={() => { const next = value.filter((_, n) => n !== i); onChange(next, primary === c.roleKey ? next[0]?.roleKey ?? '' : primary); }} />
        </View>
      ))}
      {adding ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label">{adding.name}: which {adding.scopeType}?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {(adding.scopeType === 'school' ? structure.map((s) => ({ id: s.id, name: s.name })) : structure.flatMap((s) => s.departments)).map((o) => <Chip key={o.id} label={o.name} onPress={() => { onChange([...value, { roleKey: adding.key, scopeId: o.id }], primary || adding.key); setAdding(null); }} />)}
          </ScrollView>
          <Button label="Cancel" variant="ghost" onPress={() => setAdding(null)} />
        </View>
      ) : (
        <>
          <Text variant="label">Add a role</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {roles.filter((r) => r.scopeType || !value.some((c) => c.roleKey === r.key)).map((r) => <Chip key={r.key} label={r.name} onPress={() => (r.scopeType ? setAdding(r) : onChange([...value, { roleKey: r.key }], primary || r.key))} />)}
          </ScrollView>
        </>
      )}
    </View>
  );
}
