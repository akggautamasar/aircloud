import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import FileUpload from "@/components/FileUpload";
import FileGrid from "@/components/FileGrid";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FolderCreator from "@/components/FolderCreator";
import UrlDownloader from "@/components/UrlDownloader";
import TrashManager from "@/components/TrashManager";
import TelegramSetup from "@/components/TelegramSetup";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentView, setCurrentView] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [files, setFiles] = useState([]);
  const [telegramFiles, setTelegramFiles] = useState([]);

  const [trashedItems, setTrashedItems] = useState([
    { id: 4, name: "old_document.pdf", type: "file" as const, size: "1.2 MB", deletedAt: "2 days ago" },
    { id: 5, name: "temp_folder", type: "folder" as const, deletedAt: "1 week ago" },
  ]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else {
      fetchTelegramFiles();
      
      // Set up real-time subscription for new telegram files
      const channel = supabase
        .channel('telegram_files_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'telegram_files',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('New file uploaded via Telegram:', payload)
            fetchTelegramFiles(); // Refresh the file list
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel);
      }
    }
  }, [user, navigate]);

  const fetchTelegramFiles = async () => {
    if (!user) return;

    try {
      console.log('Fetching telegram files for user:', user.id)
      const { data, error } = await supabase
        .from('telegram_files')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Error fetching files:', error);
        return;
      }

      console.log('Fetched files:', data)

      const formattedFiles = data.map(file => ({
        id: file.id,
        name: file.file_name,
        size: file.file_size ? `${(file.file_size / (1024 * 1024)).toFixed(1)} MB` : 'Unknown',
        type: file.file_type || 'unknown',
        uploadedAt: new Date(file.uploaded_at).toLocaleDateString(),
        telegram_file_id: file.telegram_file_id,
      }));

      setTelegramFiles(formattedFiles);
      setFiles(formattedFiles);
    } catch (error) {
      console.error('Error fetching Telegram files:', error);
    }
  };

  const handleFileUpload = (newFiles: File[]) => {
    // Refresh the file list after upload
    fetchTelegramFiles();
  };

  const handleCreateFolder = (name: string) => {
    console.log("Creating folder:", name);
    // Implement folder creation logic
  };

  const handleDownloadFromUrl = async (url: string, filename: string) => {
    console.log("Downloaded from URL:", url, "as", filename);
    // Refresh the file list after URL download
    await fetchTelegramFiles();
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

  if (!user) {
    return null;
  }

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
            ) : currentView === 'settings' ? (
              <TelegramSetup />
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
