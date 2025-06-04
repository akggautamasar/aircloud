
import { File, Download, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FileItem {
  id: number;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
}

interface FileGridProps {
  files: FileItem[];
  viewMode: 'grid' | 'list';
}

const FileGrid = ({ files, viewMode }: FileGridProps) => {
  const getFileIcon = (type: string) => {
    const iconClass = "w-8 h-8";
    switch (type.toLowerCase()) {
      case 'pdf':
        return <File className={`${iconClass} text-red-500`} />;
      case 'jpg':
      case 'jpeg':
      case 'png':
        return <File className={`${iconClass} text-green-500`} />;
      case 'pptx':
      case 'ppt':
        return <File className={`${iconClass} text-orange-500`} />;
      default:
        return <File className={`${iconClass} text-gray-500`} />;
    }
  };

  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Files</h3>
        {files.map((file) => (
          <Card key={file.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {getFileIcon(file.type)}
                <div>
                  <h4 className="font-medium text-gray-900">{file.name}</h4>
                  <p className="text-sm text-gray-500">{file.size} • {file.uploadedAt}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <Archive className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Recent Files</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {files.map((file) => (
          <Card key={file.id} className="p-4 hover:shadow-lg transition-all duration-200 hover:scale-105 group">
            <div className="space-y-3">
              <div className="flex items-center justify-center h-16">
                {getFileIcon(file.type)}
              </div>
              
              <div className="text-center">
                <h4 className="font-medium text-gray-900 truncate">{file.name}</h4>
                <p className="text-sm text-gray-500">{file.size}</p>
                <p className="text-xs text-gray-400">{file.uploadedAt}</p>
              </div>
              
              <div className="flex justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <Archive className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FileGrid;
