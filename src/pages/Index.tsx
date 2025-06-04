
import { Upload, Folder, File, Grid, List, Search, Settings } from "lucide-react";
import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import FileGrid from "@/components/FileGrid";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

const Index = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [files, setFiles] = useState([
    { id: 1, name: "document.pdf", size: "2.4 MB", type: "pdf", uploadedAt: "2 hours ago" },
    { id: 2, name: "presentation.pptx", size: "5.1 MB", type: "pptx", uploadedAt: "1 day ago" },
    { id: 3, name: "image.jpg", size: "1.8 MB", type: "jpg", uploadedAt: "3 days ago" },
  ]);

  const handleFileUpload = (newFiles: File[]) => {
    const fileObjects = newFiles.map((file, index) => ({
      id: files.length + index + 1,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      type: file.name.split('.').pop()?.toLowerCase() || 'unknown',
      uploadedAt: "Just now"
    }));
    setFiles([...fileObjects, ...files]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="flex">
        <Sidebar />
        
        <div className="flex-1 flex flex-col">
          <Header viewMode={viewMode} setViewMode={setViewMode} />
          
          <main className="flex-1 p-6 space-y-6">
            <FileUpload onFileUpload={handleFileUpload} />
            <FileGrid files={files} viewMode={viewMode} />
          </main>
        </div>
      </div>
    </div>
  );
};

export default Index;
