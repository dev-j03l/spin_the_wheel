"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableItem({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, touchAction: "none" }}
      className={`
        flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm
        ${isDragging ? "opacity-80 shadow-md z-10" : ""}
      `}
      {...attributes}
      {...listeners}
    >
      <span className="text-slate-400 cursor-grab active:cursor-grabbing select-none">⋮⋮</span>
      <span className="font-medium text-slate-800">{name}</span>
    </div>
  );
}

interface SortableTeamListProps {
  items: string[];
  onChange: (newOrder: string[]) => void;
  disabled?: boolean;
}

export function SortableTeamList({ items, onChange, disabled }: SortableTeamListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(items, oldIndex, newIndex));
      }
    }
  }

  if (items.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy} disabled={disabled}>
        <div className="space-y-2">
          {items.map((name) => (
            <SortableItem key={name} id={name} name={name} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
