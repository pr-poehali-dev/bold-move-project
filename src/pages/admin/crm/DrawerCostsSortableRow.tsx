import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Icon from "@/components/ui/icon";
import { RowWithToggle } from "./DrawerFinRowHelpers";

// Одна строка затрат, которую можно перетаскивать за ручку в режиме редактирования.
// Обёртка над RowWithToggle: добавляет drag-ручку (dnd-kit) и прокидывает пропсы дальше.
export function CostsSortableRow({
  rowKey, visible, editMode, editableLabel, onToggle, onLabelChange, onDelete, children,
}: {
  rowKey: string;
  visible: boolean;
  editMode: boolean;
  editableLabel: string;
  onToggle: (key: string) => void;
  onLabelChange: (label: string) => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rowKey });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };

  const dragHandle = editMode ? (
    <button
      {...attributes}
      {...listeners}
      title="Перетащите, чтобы изменить порядок"
      className="p-0.5 rounded cursor-grab active:cursor-grabbing text-white/25 hover:text-white/60 transition"
      style={{ touchAction: "none" }}>
      <Icon name="GripVertical" size={13} />
    </button>
  ) : undefined;

  return (
    <div ref={setNodeRef} style={style}>
      <RowWithToggle
        rowKey={rowKey}
        visible={visible}
        editMode={editMode}
        editableLabel={editableLabel}
        onToggle={onToggle}
        onLabelChange={onLabelChange}
        onDelete={onDelete}
        dragHandle={dragHandle}>
        {children}
      </RowWithToggle>
    </div>
  );
}

export default CostsSortableRow;