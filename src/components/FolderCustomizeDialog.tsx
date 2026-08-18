import { useState, useEffect } from 'react';
import type { Folder } from '../lib/schema';
import {
  Dialog,
  Button,
  Icon,
  Card,
  CURATED_FOLDER_ICONS,
  RADIX_COLORS,
  type IconName,
  type RadixColorName,
  getFolderColorStyle,
  DEFAULT_FOLDER_COLOR,
  DEFAULT_FOLDER_ICON
} from '../ui';

interface FolderCustomizeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folder: Folder | null;
  onSave: (folderId: string, updates: { icon: string; color: string }) => void;
}

export function FolderCustomizeDialog({
  isOpen,
  onClose,
  folder,
  onSave
}: FolderCustomizeDialogProps) {
  const [selectedIcon, setSelectedIcon] = useState<IconName>(
    (folder?.icon as IconName) || DEFAULT_FOLDER_ICON
  );
  const [selectedColor, setSelectedColor] = useState<RadixColorName>(
    (folder?.color as RadixColorName) || DEFAULT_FOLDER_COLOR
  );

  useEffect(() => {
    if (folder) {
      setSelectedIcon((folder.icon as IconName) || DEFAULT_FOLDER_ICON);
      setSelectedColor((folder.color as RadixColorName) || DEFAULT_FOLDER_COLOR);
    }
  }, [folder]);

  if (!folder) return null;

  const previewColorStyle = getFolderColorStyle(selectedColor);

  const handleSave = () => {
    onSave(folder.id, {
      icon: selectedIcon,
      color: selectedColor
    });
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-1">
        <h3 className="text-lg font-bold text-text">Customize Folder</h3>

        {/* Live Preview Card */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-text-muted">Preview</span>
          <Card
            className="flex flex-col justify-between min-h-card p-3 border transition-colors duration-fast"
            style={previewColorStyle.style}
          >
            <div className="flex items-start justify-between">
              <Icon name={selectedIcon} className="shrink-0" />
              <div className="text-xs px-2 py-0.5 rounded-full bg-surface text-text-muted font-medium">
                Preview
              </div>
            </div>
            <div className="mt-2">
              <div className="font-semibold text-sm truncate">{folder.name}</div>
              <div className="text-xs opacity-75">Folder style</div>
            </div>
          </Card>
        </div>

        {/* Color Palette Picker */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-text-muted">Folder Colour (Radix scale)</span>
          <div className="grid grid-cols-8 gap-2">
            {RADIX_COLORS.map((colorName) => {
              const style = getFolderColorStyle(colorName);
              const isSelected = selectedColor === colorName;
              return (
                <button
                  key={colorName}
                  type="button"
                  aria-label={`Select ${colorName} color`}
                  onClick={() => setSelectedColor(colorName)}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
                    isSelected ? 'ring-2 ring-accent scale-110' : 'hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: style.backgroundColor,
                    borderColor: style.accentColor
                  }}
                >
                  {isSelected && (
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: style.color }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Icon Picker */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-text-muted">Folder Icon ({CURATED_FOLDER_ICONS.length} curated)</span>
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-1 bg-surface rounded-md border border-surface">
            {CURATED_FOLDER_ICONS.map((iconName) => {
              const isSelected = selectedIcon === iconName;
              return (
                <button
                  key={iconName}
                  type="button"
                  aria-label={`Select ${iconName} icon`}
                  onClick={() => setSelectedIcon(iconName)}
                  className={`p-2 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-surface-active ring-2 ring-accent text-accent'
                      : 'hover:bg-surface-active text-text-muted hover:text-text'
                  }`}
                >
                  <Icon name={iconName} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-surface">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
