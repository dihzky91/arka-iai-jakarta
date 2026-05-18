"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
import { GripVertical, RotateCcw, Settings2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_WIDGETS,
  resolveVisibleWidgets,
  type UserWidgetPreference,
} from "@/lib/dashboard-widgets";
import {
  saveUserDashboardPreferences,
  resetDashboardPreferences,
} from "@/server/actions/dashboard-preferences";
import type { Capability } from "@/lib/rbac/capabilities";

interface WidgetItem {
  key: string;
  label: string;
  visible: boolean;
  sortOrder: number;
  alwaysVisible: boolean;
}

interface DashboardCustomizeDrawerProps {
  preferences: UserWidgetPreference[] | null;
  capabilities: Capability[];
  isSuperAdmin: boolean;
  isProjectCentric: boolean;
}

export function DashboardCustomizeDrawer({
  preferences,
  capabilities,
  isSuperAdmin,
  isProjectCentric,
}: DashboardCustomizeDrawerProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [widgets, setWidgets] = useState<WidgetItem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize widget list from resolved preferences
  useEffect(() => {
    const resolved = resolveVisibleWidgets(
      preferences,
      capabilities,
      isSuperAdmin,
      isProjectCentric,
    );

    const widgetDefs = new Map(DASHBOARD_WIDGETS.map((w) => [w.key, w]));

    setWidgets(
      resolved.map((r) => ({
        key: r.key,
        label: widgetDefs.get(r.key)?.label ?? r.key,
        visible: r.visible,
        sortOrder: r.sortOrder,
        alwaysVisible: widgetDefs.get(r.key)?.alwaysVisible ?? false,
      })),
    );
    setHasChanges(false);
  }, [preferences, capabilities, isSuperAdmin, isProjectCentric]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setWidgets((items) => {
      const oldIndex = items.findIndex((i) => i.key === active.id);
      const newIndex = items.findIndex((i) => i.key === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
    setHasChanges(true);
  }, []);

  const toggleVisibility = useCallback((key: string) => {
    setWidgets((items) =>
      items.map((item) =>
        item.key === key ? { ...item, visible: !item.visible } : item,
      ),
    );
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    startTransition(async () => {
      await saveUserDashboardPreferences(
        widgets.map((w, idx) => ({
          widgetKey: w.key,
          visible: w.visible,
          sortOrder: idx,
        })),
      );
      setHasChanges(false);
      setOpen(false);
      window.location.reload();
    });
  }, [widgets]);

  const handleReset = useCallback(() => {
    startTransition(async () => {
      await resetDashboardPreferences();
      setHasChanges(false);
      setOpen(false);
      window.location.reload();
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Atur Tampilan</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atur Tampilan Dashboard</DialogTitle>
          <DialogDescription>
            Atur widget mana yang tampil dan urutannya. Drag untuk mengubah
            urutan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Widget list with drag-and-drop */}
          <div className="max-h-[50vh] overflow-y-auto pr-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={widgets.map((w) => w.key)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {widgets.map((widget) => (
                    <SortableWidgetItem
                      key={widget.key}
                      widget={widget}
                      onToggle={toggleVisibility}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 border-t pt-4">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isPending}
              className="flex-1"
            >
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isPending}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sortable Widget Item ─────────────────────────────────────────────────────

function SortableWidgetItem({
  widget,
  onToggle,
}: {
  widget: WidgetItem;
  onToggle: (key: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 transition-shadow",
        isDragging && "shadow-lg ring-2 ring-primary/20",
        !widget.visible && "opacity-50",
      )}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{widget.label}</p>
      </div>

      {widget.alwaysVisible ? (
        <Eye className="h-4 w-4 shrink-0 text-muted-foreground/40" />
      ) : (
        <Switch
          checked={widget.visible}
          onCheckedChange={() => onToggle(widget.key)}
          className="shrink-0"
        />
      )}
    </div>
  );
}
