
import { Download, Link, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface UrlDownloaderProps {
  onDownloadFromUrl: (url: string, filename: string) => void;
}

const UrlDownloader = ({ onDownloadFromUrl }: UrlDownloaderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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

    setIsLoading(true);
    try {
      // Simulate getting file info from URL
      const suggestedFilename = filename || url.split('/').pop() || 'downloaded_file';
      onDownloadFromUrl(url.trim(), suggestedFilename);
      
      toast({
        title: "Download Started",
        description: `Starting download from URL to Telegram`,
      });
      
      setUrl("");
      setFilename("");
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start download",
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
            placeholder="Enter file URL"
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
            {isLoading ? "Starting..." : "Download"}
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
