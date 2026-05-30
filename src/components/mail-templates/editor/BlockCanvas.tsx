"use client";

import { useCallback } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { SortableBlock } from "./SortableBlock";
import type { TemplateBlock } from "@/lib/email/template-engine/types";
import type { VariableDefinition } from "@/lib/email/template-engine/types";

interface Props {
  blocks: TemplateBlock[];
  onBlocksChange: (blocks: TemplateBlock[]) => void;
  variables: VariableDefinition[];
}

export function BlockCanvas({ blocks, onBlocksChange, variables }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      onBlocksChange(arrayMove(blocks, oldIndex, newIndex));
    },
    [blocks, onBlocksChange],
  );

  const handleUpdateBlock = useCallback(
    (id: string, updated: TemplateBlock) => {
      onBlocksChange(blocks.map((b) => (b.id === id ? updated : b)));
    },
    [blocks, onBlocksChange],
  );

  const handleRemoveBlock = useCallback(
    (id: string) => {
      onBlocksChange(blocks.filter((b) => b.id !== id));
    },
    [blocks, onBlocksChange],
  );

  const handleDuplicateBlock = useCallback(
    (id: string) => {
      const index = blocks.findIndex((b) => b.id === id);
      if (index === -1) return;
      const original = blocks[index]!;
      const duplicate = { ...original, id: crypto.randomUUID() };
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, duplicate as TemplateBlock);
      onBlocksChange(newBlocks);
    },
    [blocks, onBlocksChange],
  );

  return (
    <div className="rounded-lg border bg-card p-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {blocks.length === 0 ? (
              <div className="flex items-center justify-center rounded border border-dashed p-8 text-sm text-muted-foreground">
                Tambahkan block dari palette di bawah
              </div>
            ) : (
              blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  variables={variables}
                  onUpdate={(updated) => handleUpdateBlock(block.id, updated)}
                  onRemove={() => handleRemoveBlock(block.id)}
                  onDuplicate={() => handleDuplicateBlock(block.id)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
