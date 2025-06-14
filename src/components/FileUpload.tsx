
import { Upload, CloudUpload } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface FileUploadProps {
  onFileUpload: (files: File[]) => void;
}

const FileUpload = ({ onFileUpload }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

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
    if (!user) {
      toast({
        title: "Error",
        description: "Please log in to upload files",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const successfulUploads: File[] = [];
      const failedUploads: string[] = [];

      for (const file of files) {
        try {
          console.log(`Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`);
          
          // Check file size limits
          const maxSize = 50 * 1024 * 1024; // 50MB limit
          if (file.size > maxSize) {
            throw new Error(`File "${file.name}" is too large. Maximum size is 50MB`);
          }

          // Convert file to base64
          const fileData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              // Remove the data URL prefix (data:type;base64,)
              const base64Data = result.split(',')[1];
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          // Upload using Supabase edge function
          const { data, error } = await supabase.functions.invoke('telegram-upload', {
            body: {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileData: fileData,
            },
          });

          if (error) {
            throw new Error(error.message || 'Upload failed');
          }

          if (!data?.success) {
            throw new Error(data?.error || 'Upload failed');
          }

          console.log('Upload successful:', data);
          successfulUploads.push(file);
          
        } catch (error: any) {
          console.error(`Upload error for ${file.name}:`, error);
          failedUploads.push(`${file.name}: ${error.message}`);
        }
      }

      if (successfulUploads.length > 0) {
        onFileUpload(successfulUploads);
        toast({
          title: "Upload Successful",
          description: `${successfulUploads.length} file(s) uploaded to Telegram successfully!`,
        });
      }

      if (failedUploads.length > 0) {
        toast({
          title: "Some Uploads Failed",
          description: failedUploads.join('\n'),
          variant: "destructive",
        });
      }
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload files to Telegram",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
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
          <p className="text-gray-500 mb-2">
            Files will be securely stored on your Telegram channel with unlimited space
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Max size: 50MB per file
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
