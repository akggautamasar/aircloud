
import { Trash2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface TrashItem {
  id: number;
  name: string;
  type: "file" | "folder";
  size?: string;
  deletedAt: string;
}

interface TrashManagerProps {
  trashedItems: TrashItem[];
  onRestore: (id: number) => void;
  onPermanentDelete: (id: number) => void;
}

const TrashManager = ({ trashedItems, onRestore, onPermanentDelete }: TrashManagerProps) => {
  const { toast } = useToast();

  const handleRestore = (item: TrashItem) => {
    onRestore(item.id);
    toast({
      title: "Restored",
      description: `${item.name} has been restored`,
    });
  };

  const handlePermanentDelete = (item: TrashItem) => {
    if (confirm(`Permanently delete "${item.name}"? This action cannot be undone.`)) {
      onPermanentDelete(item.id);
      toast({
        title: "Deleted",
        description: `${item.name} has been permanently deleted`,
      });
    }
  };

  if (trashedItems.length === 0) {
    return (
      <div className="text-center py-8">
        <Trash2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Trash is empty</h3>
        <p className="text-gray-500">Items you delete will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
        <Trash2 className="w-5 h-5" />
        <span>Trash ({trashedItems.length} items)</span>
      </h3>
      
      <div className="space-y-2">
        {trashedItems.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{item.name}</h4>
                <p className="text-sm text-gray-500">
                  {item.type === "file" && item.size && `${item.size} • `}
                  Deleted {item.deletedAt}
                </p>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(item)}
                  className="flex items-center space-x-1"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Restore</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePermanentDelete(item)}
                  className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                  <span>Delete</span>
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TrashManager;
