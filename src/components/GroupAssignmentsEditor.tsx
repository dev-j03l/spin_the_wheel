"use client";

import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

const GROUP_PREFIX = "group:";

function DraggableTeam({
  team,
  groupName,
}: {
  team: string;
  groupName: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: team,
    data: { team, groupName },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        flex items-center gap-2 p-2 rounded border bg-white text-sm
        ${isDragging ? "opacity-70 shadow-lg z-10" : ""}
      `}
      style={{ touchAction: "none" }}
    >
      <span className="text-slate-400 cursor-grab">⋮⋮</span>
      <span className="font-medium text-slate-800">{team}</span>
    </div>
  );
}

function GroupColumn({
  groupName,
  teams,
  targetSize,
  disabled,
}: {
  groupName: string;
  teams: string[];
  targetSize?: number;
  disabled?: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: GROUP_PREFIX + groupName,
    disabled,
  });
  const title = targetSize != null ? `${groupName} (${teams.length}/${targetSize})` : groupName;
  const valid = targetSize == null || teams.length === targetSize;
  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[120px] rounded-lg border-2 border-dashed p-3 transition-colors
        ${isOver ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50"}
        ${disabled ? "opacity-60" : ""}
      `}
    >
      <h3 className={`text-sm font-semibold mb-2 ${valid ? "text-slate-700" : "text-amber-600"}`}>{title}</h3>
      <div className="space-y-1">
        {teams.map((team) => (
          <DraggableTeam key={team} team={team} groupName={groupName} />
        ))}
      </div>
    </div>
  );
}

function buildRoundRobin(teams: string[], groupNames: string[]): Record<string, string[]> {
  const acc: Record<string, string[]> = {};
  groupNames.forEach((g) => (acc[g] = []));
  teams.forEach((t, i) => {
    const g = groupNames[i % groupNames.length];
    acc[g].push(t);
  });
  return acc;
}

interface GroupAssignmentsEditorProps {
  groupNames: string[];
  groupSizes?: number[];
  teams: string[];
  value: Record<string, string[]>;
  onChange: (value: Record<string, string[]>) => void;
  disabled?: boolean;
}

export function GroupAssignmentsEditor({
  groupNames,
  groupSizes,
  teams,
  value,
  onChange,
  disabled,
}: GroupAssignmentsEditorProps) {
  const assignments = Object.keys(value).length > 0
    ? value
    : buildRoundRobin(teams, groupNames);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || disabled) return;
    const team = active.id as string;
    const overId = String(over.id);
    if (!overId.startsWith(GROUP_PREFIX)) return;
    const targetGroup = overId.slice(GROUP_PREFIX.length);
    const sourceGroup = (active.data.current as { groupName?: string } | undefined)?.groupName;
    if (!sourceGroup || sourceGroup === targetGroup) return;

    const next = { ...assignments };
    next[sourceGroup] = (next[sourceGroup] || []).filter((t) => t !== team);
    next[targetGroup] = [...(next[targetGroup] || []), team];
    groupNames.forEach((g) => {
      if (!next[g]) next[g] = [];
    });
    onChange(next);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${groupNames.length}, minmax(0, 1fr))` }}>
        {groupNames.map((g, i) => (
          <GroupColumn
            key={g}
            groupName={g}
            teams={assignments[g] || []}
            targetSize={groupSizes?.[i]}
            disabled={disabled}
          />
        ))}
      </div>
    </DndContext>
  );
}
