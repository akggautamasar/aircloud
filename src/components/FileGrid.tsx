
import { File, Download, Archive, Play, Image, Eye, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FileItem {
  id: number;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
  telegram_file_id?: string;
}

interface FileGridProps {
  files: FileItem[];
  viewMode: 'grid' | 'list';
}

const FileGrid = ({ files, viewMode }: FileGridProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<number | null>(null);
  const [viewingFile, setViewingFile] = useState<{ url: string; type: string; name: string; isStream?: boolean } | null>(null);

  const getFileIcon = (type: string, name: string) => {
    const iconClass = "w-8 h-8";
    const fileType = type.toLowerCase();
    const fileName = name.toLowerCase();
    
    if (fileType.startsWith('video/') || fileName.match(/\.(mp4|avi|mov|mkv|webm|m4v)$/i)) {
      return <Play className={`${iconClass} text-blue-500`} />;
    } else if (fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
      return <Image className={`${iconClass} text-green-500`} />;
    } else if (fileType.includes('pdf')) {
      return <File className={`${iconClass} text-red-500`} />;
    } else if (fileType.includes('presentation') || fileName.match(/\.(pptx?|ppt)$/i)) {
      return <File className={`${iconClass} text-orange-500`} />;
    } else {
      return <File className={`${iconClass} text-gray-500`} />;
    }
  };

  const isViewable = (type: string, name: string) => {
    const fileType = type.toLowerCase();
    const fileName = name.toLowerCase();
    return fileType.startsWith('image/') || 
           fileType.startsWith('video/') || 
           fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp|mp4|avi|mov|mkv|webm|m4v)$/i);
  };

  const handleDownload = async (file: FileItem) => {
    if (!user || !file.telegram_file_id) {
      toast({
        title: "Error",
        description: "Cannot download file - missing information",
        variant: "destructive",
      });
      return;
    }

    setDownloading(file.id);
    
    try {
      console.log('Starting download for file:', file.name, 'with ID:', file.telegram_file_id);
      
      const { data: result, error } = await supabase.functions.invoke('telegram-download', {
        body: {
          fileId: file.telegram_file_id,
          fileName: file.name,
        },
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Download failed');
      }

      if (!result?.success) {
        console.error('Download result error:', result);
        throw new Error(result?.error || 'Download failed');
      }

      console.log('Download result:', result);

      // Check if this is a large file URL
      if (result.streamUrl && result.streamUrl.startsWith('tg-large-file://')) {
        toast({
          title: "Large File Detected",
          description: "This file is too large to download directly. Please use a Telegram client to access it.",
          variant: "destructive",
        });
        return;
      }

      console.log('Starting download from stream URL:', result.streamUrl);
      
      // Create a temporary link to download the file
      const a = document.createElement('a');
      a.href = result.streamUrl;
      a.download = file.name;
      a.target = '_blank';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: "File download has been initiated",
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download file",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleView = async (file: FileItem) => {
    if (!user || !file.telegram_file_id) {
      toast({
        title: "Error",
        description: "Cannot view file - missing information",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Starting view for file:', file.name, 'with ID:', file.telegram_file_id);
      
      const { data: result, error } = await supabase.functions.invoke('telegram-download', {
        body: {
          fileId: file.telegram_file_id,
          fileName: file.name,
        },
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to load file');
      }

      if (!result?.success) {
        console.error('View result error:', result);
        throw new Error(result?.error || 'Failed to load file');
      }

      console.log('View result:', result);

      // Check if this is a large file URL
      if (result.streamUrl && result.streamUrl.startsWith('tg-large-file://')) {
        toast({
          title: "Large File Detected",
          description: "This file is too large to view directly. Please use a Telegram client to access it.",
          variant: "destructive",
        });
        return;
      }

      console.log('Using stream URL for viewing:', result.streamUrl);
      setViewingFile({ 
        url: result.streamUrl, 
        type: file.type, 
        name: file.name,
        isStream: true 
      });
    } catch (error: any) {
      console.error('View error:', error);
      toast({
        title: "View Failed",
        description: error.message || "Failed to load file for viewing",
        variant: "destructive",
      });
    }
  };

  const closeViewer = () => {
    setViewingFile(null);
  };

  // Check if file is likely too large (over 20MB based on size string)
  const isLargeFile = (sizeString: string) => {
    const match = sizeString.match(/(\d+\.?\d*)\s*(MB|GB)/i);
    if (!match) return false;
    
    const size = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    if (unit === 'GB') return true;
    if (unit === 'MB' && size > 20) return true;
    
    return false;
  };

  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Files</h3>
        {files.map((file) => (
          <Card key={file.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {getFileIcon(file.type, file.name)}
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900">{file.name}</h4>
                    {isLargeFile(file.size) && (
                      <span title="Large file - may require Telegram client">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{file.size} • {file.uploadedAt}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {isViewable(file.type, file.name) && !isLargeFile(file.size) && (
                  <Button variant="outline" size="sm" onClick={() => handleView(file)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleDownload(file)}
                  disabled={downloading === file.id}
                >
                  <Download className="w-4 h-4" />
                  {downloading === file.id && <span className="ml-1">...</span>}
                </Button>
                <Button variant="outline" size="sm">
                  <Archive className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        
        {/* File Viewer Modal */}
        {viewingFile && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl max-h-full overflow-auto">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">{viewingFile.name}</h3>
                <Button variant="outline" onClick={closeViewer}>
                  Close
                </Button>
              </div>
              <div className="p-4">
                {viewingFile.type.startsWith('image/') ? (
                  <img 
                    src={viewingFile.url} 
                    alt={viewingFile.name}
                    className="max-w-full max-h-96 object-contain mx-auto"
                    onError={(e) => {
                      console.error('Image load error:', e);
                      toast({
                        title: "Image Load Error",
                        description: "Failed to load image",
                        variant: "destructive",
                      });
                    }}
                  />
                ) : viewingFile.type.startsWith('video/') ? (
                  <video 
                    src={viewingFile.url} 
                    controls
                    className="max-w-full max-h-96 mx-auto"
                    preload="metadata"
                    onError={(e) => {
                      console.error('Video load error:', e);
                      toast({
                        title: "Video Load Error",
                        description: "Failed to load video. Try downloading instead.",
                        variant: "destructive",
                      });
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : null}
              </div>
            </div>
          </div>
        )}
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
              <div className="flex items-center justify-center h-16 relative">
                {getFileIcon(file.type, file.name)}
                {isLargeFile(file.size) && (
                  <span title="Large file - may require Telegram client" className="absolute -top-1 -right-1">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                  </span>
                )}
              </div>
              
              <div className="text-center">
                <h4 className="font-medium text-gray-900 truncate">{file.name}</h4>
                <p className="text-sm text-gray-500">{file.size}</p>
                <p className="text-xs text-gray-400">{file.uploadedAt}</p>
              </div>
              
              <div className="flex justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {isViewable(file.type, file.name) && !isLargeFile(file.size) && (
                  <Button variant="outline" size="sm" onClick={() => handleView(file)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleDownload(file)}
                  disabled={downloading === file.id}
                >
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
      
      {/* File Viewer Modal for Grid View */}
      {viewingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-full overflow-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">{viewingFile.name}</h3>
              <Button variant="outline" onClick={closeViewer}>
                Close
              </Button>
            </div>
            <div className="p-4">
              {viewingFile.type.startsWith('image/') ? (
                <img 
                  src={viewingFile.url} 
                  alt={viewingFile.name}
                  className="max-w-full max-h-96 object-contain mx-auto"
                  onError={(e) => {
                    console.error('Image load error:', e);
                    toast({
                      title: "Image Load Error",
                      description: "Failed to load image",
                      variant: "destructive",
                    });
                  }}
                />
              ) : viewingFile.type.startsWith('video/') ? (
                <video 
                  src={viewingFile.url} 
                  controls
                  className="max-w-full max-h-96 mx-auto"
                  preload="metadata"
                  onError={(e) => {
                    console.error('Video load error:', e);
                    toast({
                      title: "Video Load Error",
                      description: "Failed to load video. Try downloading instead.",
                      variant: "destructive",
                    });
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileGrid;
