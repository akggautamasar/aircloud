
import { Upload, Folder, File, Archive, ArchiveRestore, Cloud, Trash2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const Sidebar = ({ currentView, onViewChange }: SidebarProps) => {
  const menuItems = [
    { icon: Cloud, label: "All Files", view: "all", active: currentView === "all" },
    { icon: Upload, label: "Recent", view: "recent", active: currentView === "recent" },
    { icon: Folder, label: "Folders", view: "folders", active: currentView === "folders" },
    { icon: Archive, label: "Archive", view: "archive", active: currentView === "archive" },
    { icon: ArchiveRestore, label: "Shared", view: "shared", active: currentView === "shared" },
    { icon: Trash2, label: "Trash", view: "trash", active: currentView === "trash" },
    { icon: Settings, label: "Settings", view: "settings", active: currentView === "settings" },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Cloud className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">TeleCloud</h1>
            <p className="text-sm text-gray-500">Cloud Storage</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => onViewChange(item.view)}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 hover:bg-gray-50",
              item.active && "bg-blue-50 text-blue-600 border border-blue-200"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Storage</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Used</span>
              <span className="text-gray-900">2.4 GB</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full w-1/3"></div>
            </div>
            <p className="text-xs text-gray-500">Unlimited via Telegram</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
