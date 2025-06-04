
import { Folder, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface FolderCreatorProps {
  onCreateFolder: (name: string) => void;
}

const FolderCreator = ({ onCreateFolder }: FolderCreatorProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [folderName, setFolderName] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a folder name",
        variant: "destructive",
      });
      return;
    }

    onCreateFolder(folderName.trim());
    setFolderName("");
    setIsCreating(false);
    
    toast({
      title: "Success",
      description: `Folder "${folderName}" created successfully`,
    });
  };

  if (!isCreating) {
    return (
      <Button
        onClick={() => setIsCreating(true)}
        variant="outline"
        className="flex items-center space-x-2"
      >
        <Plus className="w-4 h-4" />
        <span>New Folder</span>
      </Button>
    );
  }

  return (
    <Card className="p-4 max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center space-x-2">
          <Folder className="w-5 h-5 text-blue-500" />
          <h3 className="font-medium">Create New Folder</h3>
        </div>
        <Input
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="Enter folder name"
          autoFocus
        />
        <div className="flex space-x-2">
          <Button type="submit" size="sm">Create</Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsCreating(false);
              setFolderName("");
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default FolderCreator;
