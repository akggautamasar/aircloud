
import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import FileGrid from "@/components/FileGrid";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FolderCreator from "@/components/FolderCreator";
import UrlDownloader from "@/components/UrlDownloader";
import TrashManager from "@/components/TrashManager";

const Index = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentView, setCurrentView] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [files, setFiles] = useState([
    { id: 1, name: "document.pdf", size: "2.4 MB", type: "pdf", uploadedAt: "2 hours ago" },
    { id: 2, name: "presentation.pptx", size: "5.1 MB", type: "pptx", uploadedAt: "1 day ago" },
    { id: 3, name: "image.jpg", size: "1.8 MB", type: "jpg", uploadedAt: "3 days ago" },
  ]);

  const [trashedItems, setTrashedItems] = useState([
    { id: 4, name: "old_document.pdf", type: "file" as const, size: "1.2 MB", deletedAt: "2 days ago" },
    { id: 5, name: "temp_folder", type: "folder" as const, deletedAt: "1 week ago" },
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

  const handleCreateFolder = (name: string) => {
    console.log("Creating folder:", name);
    // Implement folder creation logic
  };

  const handleDownloadFromUrl = (url: string, filename: string) => {
    console.log("Downloading from URL:", url, "as", filename);
    // Implement URL download logic
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    console.log("Searching for:", query);
    // Implement search logic
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    console.log("Clearing search");
  };

  const handleRestoreItem = (id: number) => {
    const item = trashedItems.find(item => item.id === id);
    if (item && item.type === "file") {
      setFiles([...files, { ...item, uploadedAt: "Restored now" }]);
    }
    setTrashedItems(trashedItems.filter(item => item.id !== id));
  };

  const handlePermanentDelete = (id: number) => {
    setTrashedItems(trashedItems.filter(item => item.id !== id));
  };

  const filteredFiles = searchQuery 
    ? files.filter(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="flex">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        
        <div className="flex-1 flex flex-col">
          <Header 
            viewMode={viewMode} 
            setViewMode={setViewMode}
            onSearch={handleSearch}
            onClearSearch={handleClearSearch}
          />
          
          <main className="flex-1 p-6 space-y-6">
            {currentView === 'trash' ? (
              <TrashManager 
                trashedItems={trashedItems}
                onRestore={handleRestoreItem}
                onPermanentDelete={handlePermanentDelete}
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-4">
                  <FileUpload onFileUpload={handleFileUpload} />
                </div>
                
                <div className="flex flex-wrap gap-4">
                  <FolderCreator onCreateFolder={handleCreateFolder} />
                  <UrlDownloader onDownloadFromUrl={handleDownloadFromUrl} />
                </div>
                
                {searchQuery && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-blue-800">
                      Showing results for: <strong>"{searchQuery}"</strong>
                    </p>
                  </div>
                )}
                
                <FileGrid files={filteredFiles} viewMode={viewMode} />
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Index;
