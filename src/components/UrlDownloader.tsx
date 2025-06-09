
import { Download, Link, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface UrlDownloaderProps {
  onDownloadFromUrl: (url: string, filename: string) => void;
}

const UrlDownloader = ({ onDownloadFromUrl }: UrlDownloaderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "Please log in to download files",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('Starting URL download:', url);
      
      const { data: result, error } = await supabase.functions.invoke('url-download', {
        body: {
          url: url.trim(),
          filename: filename.trim() || undefined,
        },
      });

      if (error) {
        console.error('Download error:', error);
        throw new Error(error.message || 'Download failed');
      }

      if (!result?.success) {
        console.error('Download result error:', result);
        throw new Error(result?.error || 'Download failed');
      }

      console.log('Download successful:', result);
      
      toast({
        title: "Download Successful",
        description: `File "${result.fileName}" has been downloaded and uploaded to Telegram`,
      });
      
      // Call the callback to refresh file list
      onDownloadFromUrl(url.trim(), result.fileName);
      
      setUrl("");
      setFilename("");
      setIsOpen(false);
    } catch (error: any) {
      console.error('URL download error:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download file from URL",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="flex items-center space-x-2"
      >
        <Link className="w-4 h-4" />
        <span>Download from URL</span>
      </Button>
    );
  }

  return (
    <Card className="p-4 max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Download className="w-5 h-5 text-blue-500" />
            <h3 className="font-medium">Download from URL</h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="space-y-3">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter file URL (max 50MB)"
            type="url"
            disabled={isLoading}
          />
          <Input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="Custom filename (optional)"
            disabled={isLoading}
          />
        </div>
        
        <div className="flex space-x-2">
          <Button type="submit" size="sm" disabled={isLoading}>
            {isLoading ? "Downloading..." : "Download"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default UrlDownloader;
