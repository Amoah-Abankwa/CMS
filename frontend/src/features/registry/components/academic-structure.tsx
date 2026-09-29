'use client';

import { useCallback, useEffect, useState } from 'react';
import { suggestIndexCode } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import {
  CATEGORY_LABEL,
  MODE_LABEL,
  registryApi,
  type DepartmentRow,
  type ProgrammeRow,
  type ProgrammeType,
  type SchoolRow,
} from '../api';

type Dlg =
  | { kind: 'school'; s: SchoolRow | null }
  | {
      kind: 'department';
      d: DepartmentRow | null;
      schoolId: string;
    }
  | {
      kind: 'programme';
      p: ProgrammeRow | null;
      departmentId: string;
    };

/** Schools, their departments, and the programmes each department runs. */
export function AcademicStructure() {
  const [data, setData] = useState<{
    schools: SchoolRow[];
    types: ProgrammeType[];
  } | null>(null);

  const [msg, setMsg] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  const [dlg, setDlg] = useState<Dlg | null>(null);

  const load = useCallback(() => {
    registryApi
      .structure()
      .then(setData)
      .catch((err) =>
        setMsg({
          tone: 'danger',
          text: errorMessage(err),
        }),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (
    fn: () => Promise<unknown>,
    ok: string,
  ) => {
    setMsg(null);

    try {
      await fn();
      setMsg({
        tone: 'success',
        text: ok,
      });
      load();
    } catch (err) {
      setMsg({
        tone: 'danger',
        text: errorMessage(err),
      });
    }
  };

  if (!data) {
    return msg ? (
      <Alert tone={msg.tone}>{msg.text}</Alert>
    ) : (
      <Spinner />
    );
  }

  const typeOf = (code: string) =>
    data.types.find((t) => t.code === code);

  return (
    <div className="flex flex-col gap-4">
      {msg && (
        <Alert tone={msg.tone}>{msg.text}</Alert>
      )}

      <div>
        <Button
          size="sm"
          onClick={() =>
            setDlg({
              kind: 'school',
              s: null,
            })
          }
        >
          Add school
        </Button>
      </div>

      {data.schools.length === 0 && (
        <EmptyState title="No schools yet" />
      )}

      {data.schools.map((s) => (
        <Card key={s.id}>
          <CardHeader
            title={`${s.name} (${s.code})`}
            actions={
              <span className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDlg({
                      kind: 'school',
                      s,
                    })
                  }
                >
                  Edit
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setDlg({
                      kind: 'department',
                      d: null,
                      schoolId: s.id,
                    })
                  }
                >
                  Add department
                </Button>
              </span>
            }
          />

          {s.departments.length === 0 ? (
            <CardBody>
              <p className="text-sm text-muted">
                No departments yet.
              </p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-border">
              {s.departments.map((d) => (
                <li
                  key={d.id}
                  className="px-4 py-3 sm:px-5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm">
                      <span className="font-medium">
                        {d.name}
                      </span>{' '}
                      <span className="text-muted">
                        {d.code}. {d.programmes.length}{' '}
                        programmes, {d._count.courses}{' '}
                        courses, {d._count.staff} staff.
                      </span>
                    </span>

                    <span className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setDlg({
                            kind: 'programme',
                            p: null,
                            departmentId: d.id,
                          })
                        }
                      >
                        Add programme
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDlg({
                            kind: 'department',
                            d,
                            schoolId: s.id,
                          })
                        }
                      >
                        Edit
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          remove(
                            () =>
                              registryApi.deleteDepartment(
                                d.id,
                              ),
                            `${d.name} removed.`,
                          )
                        }
                      >
                        Remove
                      </Button>
                    </span>
                  </div>

                  {d.programmes.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1.5 border-l-2 border-border pl-3">
                      {d.programmes.map((p) => {
                        const t = typeOf(p.levelCode);

                        return (
                          <li
                            key={p.id}
                            className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span>
                              {p.name}{' '}
                              <span className="text-muted">
                                {p.code}
                                {p.indexCode
                                  ? `, index code ${p.indexCode}`
                                  : ''}
                                .{' '}
                                {t
                                  ? `${CATEGORY_LABEL[t.category]}, ${MODE_LABEL[
                                      t.mode
                                    ].toLowerCase()}`
                                  : p.levelCode}
                                , {p.semesters ??
                                  t?.semesters ??
                                  '?'}{' '}
                                semesters.{' '}
                                {p._count.students}{' '}
                                students.
                              </span>{' '}
                              {!p.isActive && (
                                <Badge>
                                  not admitting
                                </Badge>
                              )}
                            </span>

                            <span className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setDlg({
                                    kind: 'programme',
                                    p,
                                    departmentId: d.id,
                                  })
                                }
                              >
                                Edit
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  remove(
                                    () =>
                                      registryApi.deleteProgramme(
                                        p.id,
                                      ),
                                    `${p.name} removed.`,
                                  )
                                }
                              >
                                Remove
                              </Button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}

      {dlg && (
        <EditDialog
          dlg={dlg}
          schools={data.schools}
          types={data.types}
          onClose={() => setDlg(null)}
          onDone={() => {
            setDlg(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function EditDialog({
  dlg,
  schools,
  types,
  onClose,
  onDone,
}: {
  dlg: Dlg;
  schools: SchoolRow[];
  types: ProgrammeType[];
  onClose: () => void;
  onDone: () => void;
}) {
  const init: Record<string, string | boolean> =
    dlg.kind === 'school'
      ? {
          code: dlg.s?.code ?? '',
          name: dlg.s?.name ?? '',
        }
      : dlg.kind === 'department'
        ? {
            code: dlg.d?.code ?? '',
            name: dlg.d?.name ?? '',
            schoolId:
              dlg.d?.schoolId ??
              dlg.schoolId ??
              '',
          }
        : {
            code: dlg.p?.code ?? '',
            name: dlg.p?.name ?? '',
            departmentId:
              dlg.p?.departmentId ??
              dlg.departmentId ??
              '',
            levelCode:
              dlg.p?.levelCode ??
              types.find((t) => t.isActive)?.code ??
              '',
            semesters: dlg.p?.semesters
              ? String(dlg.p.semesters)
              : '',
            indexCode: dlg.p?.indexCode ?? '',
            isActive: dlg.p?.isActive ?? true,
          };

  const [f, setF] = useState<
    Record<string, string | boolean>
  >(init);

  const [error, setError] = useState<string | null>(
    null,
  );

  const [busy, setBusy] = useState(false);

  const set = (
    key: string,
    value: string | boolean,
  ) => {
    setF((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const departments = schools.flatMap(
    (school) => school.departments,
  );

  const type = types.find(
    (t) => t.code === String(f.levelCode),
  );

  const save = async () => {
    setBusy(true);
    setError(null);

    try {
      if (dlg.kind === 'school') {
        await registryApi.saveSchool(
          {
            code: String(f.code),
            name: String(f.name),
          },
          dlg.s?.id,
        );
      } else if (dlg.kind === 'department') {
        await registryApi.saveDepartment(
          {
            code: String(f.code),
            name: String(f.name),
            schoolId: String(f.schoolId),
          },
          dlg.d?.id,
        );
      } else {
        await registryApi.saveProgramme(
          {
            code: String(f.code),
            name: String(f.name),
            departmentId: String(f.departmentId),
            levelCode: String(f.levelCode),
            semesters: f.semesters
              ? Number(f.semesters)
              : null,
            indexCode: type?.usesProgrammeCode
              ? String(f.indexCode)
              : null,
            isActive: Boolean(f.isActive),
          },
          dlg.p?.id,
        );
      }

      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const what =
    dlg.kind === 'school'
      ? 'school'
      : dlg.kind === 'department'
        ? 'department'
        : 'programme';

  const editing =
    dlg.kind === 'school'
      ? dlg.s
      : dlg.kind === 'department'
        ? dlg.d
        : dlg.p;

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? `Edit ${what}` : `Add ${what}`}
    >
      <div className="flex flex-col gap-4">
        {error && (
          <Alert tone="danger">{error}</Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Code"
            htmlFor="rs-code"
          >
            <Input
              id="rs-code"
              value={String(f.code)}
              maxLength={20}
              placeholder={
                dlg.kind === 'programme'
                  ? 'BSC-CE'
                  : 'CE'
              }
              onChange={(e) =>
                set(
                  'code',
                  e.target.value.toUpperCase(),
                )
              }
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Name"
              htmlFor="rs-name"
            >
              <Input
                id="rs-name"
                value={String(f.name)}
                maxLength={120}
                placeholder={
                  dlg.kind === 'programme'
                    ? 'BSc Computer Engineering'
                    : ''
                }
                onChange={(e) =>
                  set('name', e.target.value)
                }
              />
            </Field>
          </div>
        </div>

        {dlg.kind === 'department' && (
          <Field
            label="School"
            htmlFor="rs-school"
          >
            <Select
              id="rs-school"
              value={String(f.schoolId)}
              onChange={(e) =>
                set('schoolId', e.target.value)
              }
            >
              {schools.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                >
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {dlg.kind === 'programme' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Department"
                htmlFor="rs-dept"
              >
                <Select
                  id="rs-dept"
                  value={String(f.departmentId)}
                  onChange={(e) =>
                    set(
                      'departmentId',
                      e.target.value,
                    )
                  }
                >
                  {departments.map((d) => (
                    <option
                      key={d.id}
                      value={d.id}
                    >
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Programme type"
                htmlFor="rs-type"
                hint={
                  type
                    ? `${type.semesters} semesters. Index numbers like ${
                        type.example ?? type.indexFormat
                      }.`
                    : undefined
                }
              >
                <Select
                  id="rs-type"
                  value={String(f.levelCode)}
                  onChange={(e) =>
                    set(
                      'levelCode',
                      e.target.value,
                    )
                  }
                >
                  {types
                    .filter(
                      (t) =>
                        t.isActive ||
                        t.code === f.levelCode,
                    )
                    .map((t) => (
                      <option
                        key={t.code}
                        value={t.code}
                      >
                        {t.name}
                      </option>
                    ))}
                </Select>
              </Field>

              {type?.usesProgrammeCode && (
                <Field
                  label="Index code"
                  htmlFor="rs-icode"
                  hint={`Starts every index number on this programme, e.g. ${String(
                    f.indexCode || 'DCE',
                  )}${String(
                    new Date().getUTCFullYear() % 100,
                  )}0001. Cannot be changed once students have numbers.`}
                >
                  <Input
                    id="rs-icode"
                    value={String(f.indexCode)}
                    maxLength={6}
                    placeholder={
                      suggestIndexCode(
                        String(f.name),
                      ) || 'DCE'
                    }
                    onFocus={() => {
                      if (
                        !f.indexCode &&
                        String(f.name).trim()
                      ) {
                        set(
                          'indexCode',
                          suggestIndexCode(
                            String(f.name),
                          ),
                        );
                      }
                    }}
                    onChange={(e) =>
                      set(
                        'indexCode',
                        e.target.value.toUpperCase(),
                      )
                    }
                  />
                </Field>
              )}

              <Field
                label="Semesters (only if different)"
                htmlFor="rs-sem"
                hint="Leave empty to use the programme type's number."
              >
                <Input
                  id="rs-sem"
                  type="number"
                  min={1}
                  max={24}
                  value={String(f.semesters)}
                  onChange={(e) =>
                    set(
                      'semesters',
                      e.target.value,
                    )
                  }
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={Boolean(f.isActive)}
                onChange={(e) =>
                  set(
                    'isActive',
                    e.target.checked,
                  )
                }
              />
              Admitting new students
            </label>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>

          <Button
            loading={busy}
            disabled={
              String(f.code).length < 2 ||
              String(f.name).trim().length < 3 ||
              (dlg.kind === 'programme' &&
                !!type?.usesProgrammeCode &&
                !/^[A-Z][A-Z0-9]{1,5}$/.test(
                  String(f.indexCode),
                ))
            }
            onClick={save}
          >
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}