
import { Upload, CloudUpload } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onFileUpload: (files: File[]) => void;
}

const FileUpload = ({ onFileUpload }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      uploadFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      uploadFiles(files);
    }
  };

  const uploadFiles = async (files: File[]) => {
    setIsUploading(true);
    
    // Simulate upload to Telegram
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    onFileUpload(files);
    setIsUploading(false);
    
    toast({
      title: "Upload Successful",
      description: `${files.length} file(s) uploaded to Telegram successfully!`,
    });
  };

  return (
    <div
      className={`
        border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300
        ${isDragging 
          ? 'border-blue-500 bg-blue-50 scale-105' 
          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }
        ${isUploading ? 'pointer-events-none opacity-50' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="space-y-4">
        <div className="flex justify-center">
          {isUploading ? (
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
              <CloudUpload className="w-8 h-8 text-blue-600" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <Upload className="w-8 h-8 text-white" />
            </div>
          )}
        </div>
        
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {isUploading ? 'Uploading to Telegram...' : 'Drop files here or click to upload'}
          </h3>
          <p className="text-gray-500 mb-4">
            Files will be securely stored on Telegram with unlimited space
          </p>
          
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            Choose Files
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
